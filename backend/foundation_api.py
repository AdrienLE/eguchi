"""Authenticated first-phase sync and parent notification settings."""

import hashlib
import hmac
import json
import re
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from . import models
from .foundation_protocol import Event, StrictModel, iso, utc_now


class SyncIn(StrictModel):
    events: list[Event] = Field(default_factory=list, max_length=100)
    cursor: int = Field(default=0, ge=0)


class EmailIn(StrictModel):
    email: str = Field(min_length=3, max_length=254)


class CodeIn(StrictModel):
    code: str = Field(pattern=r"^\d{6}$")


class DeviceIn(StrictModel):
    token: str = Field(
        pattern=r"^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$", max_length=250
    )


def read_events(db, user_id):
    return [
        json.loads(row.payload)
        for row in db.query(models.FoundationEvent)
        .filter_by(user_id=user_id)
        .order_by(models.FoundationEvent.sequence)
        .all()
    ]


def create_foundation_router(get_db, verify_jwt):
    router = APIRouter(prefix="/api/foundation", tags=["foundation"])

    @router.post("/sync")
    def sync(body: SyncIn, payload=Depends(verify_jwt), db: Session = Depends(get_db)):
        user_id = payload["sub"]
        acknowledged = []
        try:
            for event in body.events:
                serialized = json.dumps(event.model_dump(), sort_keys=True, separators=(",", ":"))
                existing = (
                    db.query(models.FoundationEvent)
                    .filter_by(user_id=user_id, event_id=event.id)
                    .first()
                )
                if existing and existing.payload != serialized:
                    raise HTTPException(409, "An existing practice event cannot be changed")
                if not existing:
                    db.add(
                        models.FoundationEvent(
                            user_id=user_id,
                            event_id=event.id,
                            kind=event.kind,
                            occurred_at=event.at,
                            payload=serialized,
                        )
                    )
                    db.flush()
                acknowledged.append(event.id)
            db.commit()
        except IntegrityError:
            db.rollback()
            # A concurrent retry won the unique constraint. Let the client retry safely.
            raise HTTPException(409, "Concurrent sync; retry the unchanged events")
        rows = (
            db.query(models.FoundationEvent)
            .filter(
                models.FoundationEvent.user_id == user_id,
                models.FoundationEvent.sequence > body.cursor,
            )
            .order_by(models.FoundationEvent.sequence)
            .limit(501)
            .all()
        )
        page = rows[:500]
        return {
            "acknowledged": acknowledged,
            "events": [json.loads(row.payload) for row in page],
            "cursor": page[-1].sequence if page else body.cursor,
            "hasMore": len(rows) > 500,
        }

    @router.get("/contact")
    def contact(payload=Depends(verify_jwt), db: Session = Depends(get_db)):
        from .foundation_reminders import email_configured, reminders_enabled

        row = db.get(models.FoundationContact, payload["sub"])
        return {
            "email": row.email if row else "",
            "verified": bool(row and row.verified),
            "emailAvailable": email_configured() and reminders_enabled(),
        }

    @router.post("/contact/request-code")
    def request_code(body: EmailIn, payload=Depends(verify_jwt), db: Session = Depends(get_db)):
        from .foundation_reminders import email_configured, send_email

        if not email_configured():
            raise HTTPException(503, "Email delivery is not configured")
        email = body.email.strip()
        if not re.fullmatch(r"[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+", email):
            raise HTTPException(422, "Enter a valid email address")
        now = utc_now()
        row = db.get(models.FoundationContact, payload["sub"])
        if row and row.requested_at and row.requested_at > iso(now - timedelta(minutes=1)):
            raise HTTPException(429, "Wait one minute before requesting another code")
        if row is None:
            row = models.FoundationContact(user_id=payload["sub"])
            db.add(row)
        code = f"{secrets.randbelow(1000000):06d}"
        row.email, row.verified = email, False
        row.code_hash = hashlib.sha256((email + ":" + code).encode()).hexdigest()
        row.requested_at, row.expires_at, row.attempts = (
            iso(now),
            iso(now + timedelta(minutes=10)),
            0,
        )
        db.commit()
        try:
            send_email(
                email,
                "Your Eguchi Ears parent email code",
                f"Your verification code is {code}.\n\nEnter it in Parent settings within 10 minutes. This confirms the parent email address; reminder categories remain under your control.\n\nIf you did not request this, you can ignore this email.",
            )
        except Exception:
            raise HTTPException(
                503, "We could not confirm email delivery. Check your inbox or retry in a minute."
            )
        return {"ok": True}

    @router.post("/contact/verify")
    def verify(body: CodeIn, payload=Depends(verify_jwt), db: Session = Depends(get_db)):
        row = db.get(models.FoundationContact, payload["sub"])
        if not row or not row.code_hash or row.attempts >= 5 or row.expires_at < iso(utc_now()):
            raise HTTPException(400, "Request a new verification code")
        row.attempts += 1
        matches = hmac.compare_digest(
            row.code_hash, hashlib.sha256((row.email + ":" + body.code).encode()).hexdigest()
        )
        if matches:
            row.verified, row.code_hash = True, None
        db.commit()
        if not matches:
            raise HTTPException(400, "That code did not match")
        return {"ok": True}

    @router.delete("/contact")
    def remove_contact(payload=Depends(verify_jwt), db: Session = Depends(get_db)):
        db.query(models.FoundationContact).filter_by(user_id=payload["sub"]).delete()
        db.commit()
        return {"ok": True}

    @router.post("/device")
    def device(body: DeviceIn, payload=Depends(verify_jwt), db: Session = Depends(get_db)):
        from .foundation_reminders import remote_push_enabled

        if not remote_push_enabled():
            raise HTTPException(503, "Remote push is not configured; use device reminders")
        row = db.get(models.FoundationDevice, body.token)
        if row is None:
            row = models.FoundationDevice(token=body.token)
            db.add(row)
        row.user_id, row.updated_at = payload["sub"], iso(utc_now())
        db.commit()
        return {"ok": True}

    @router.post("/device/remove")
    def remove_device(body: DeviceIn, payload=Depends(verify_jwt), db: Session = Depends(get_db)):
        db.query(models.FoundationDevice).filter_by(
            token=body.token, user_id=payload["sub"]
        ).delete()
        db.commit()
        return {"ok": True}

    @router.get("/review-record")
    def export(payload=Depends(verify_jwt), db: Session = Depends(get_db)):
        return {
            "protocol": "eguchi-foundation-1",
            "phase": "chord-colors",
            "assessment": "not-performed",
            "interpretation": "One-choice trials measure participation only. Multi-choice trials preserve unaided choices and confusion pairs.",
            "events": read_events(db, payload["sub"]),
        }

    return router
