"""Durable, opt-in parent reminders. Provider acceptance is not device delivery."""

import asyncio
import hashlib
import html
import json
import logging
import os
from datetime import timedelta

import requests
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from . import models
from .database import SessionLocal
from .foundation_protocol import daily_status, derive, iso, utc_now

logger = logging.getLogger(__name__)


def email_configured():
    return bool(os.getenv("POSTMARK_API_TOKEN") and os.getenv("POSTMARK_FROM_EMAIL"))


def remote_push_enabled():
    return os.getenv("EGUCHI_REMOTE_PUSH_ENABLED", "").lower() in {"1", "true"}


def reminders_enabled():
    return os.getenv("EGUCHI_REMINDERS_ENABLED", "").lower() in {"1", "true"}


class DeliveryError(Exception):
    def __init__(self, code, retryable=False):
        self.code, self.retryable = code, retryable
        super().__init__(code)


def send_email(destination, subject, body):
    if not email_configured():
        raise DeliveryError("email-unconfigured")
    name = os.getenv("POSTMARK_FROM_NAME", "Eguchi Ears")
    sender = os.environ["POSTMARK_FROM_EMAIL"]
    payload = {
        "From": f"{name} <{sender}>",
        "To": destination,
        "Subject": subject,
        "TextBody": body,
        "HtmlBody": "<div style='font-family:system-ui;line-height:1.6'>"
        + "".join(f"<p>{html.escape(p)}</p>" for p in body.split("\n\n"))
        + "</div>",
    }
    if os.getenv("POSTMARK_MESSAGE_STREAM"):
        payload["MessageStream"] = os.environ["POSTMARK_MESSAGE_STREAM"]
    try:
        response = requests.post(
            "https://api.postmarkapp.com/email",
            headers={
                "X-Postmark-Server-Token": os.environ["POSTMARK_API_TOKEN"],
                "Accept": "application/json",
            },
            json=payload,
            timeout=20,
        )
    except requests.RequestException:
        # The provider may have accepted a timed-out request. Do not blindly send it twice.
        raise DeliveryError("delivery-unknown")
    if response.status_code == 429:
        raise DeliveryError("provider-rate-limit", retryable=True)
    if not response.ok:
        raise DeliveryError(f"provider-http-{response.status_code}")
    result = response.json()
    if result.get("ErrorCode") != 0 or not result.get("MessageID"):
        raise DeliveryError("provider-rejected")
    return result["MessageID"]


def push_headers():
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if os.getenv("EXPO_ACCESS_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["EXPO_ACCESS_TOKEN"]
    return headers


def send_push(destination, title, body):
    if not remote_push_enabled():
        raise DeliveryError("push-unconfigured")
    try:
        response = requests.post(
            "https://exp.host/--/api/v2/push/send",
            headers=push_headers(),
            json={
                "to": destination,
                "title": title,
                "body": body,
                "sound": "default",
                "data": {"route": "/"},
                "channelId": "practice",
            },
            timeout=20,
        )
    except requests.RequestException:
        raise DeliveryError("delivery-unknown")
    if response.status_code == 429:
        raise DeliveryError("provider-rate-limit", retryable=True)
    if not response.ok:
        raise DeliveryError(f"provider-http-{response.status_code}")
    ticket = response.json().get("data", {})
    if isinstance(ticket, list):
        ticket = ticket[0] if ticket else {}
    if ticket.get("status") != "ok":
        raise DeliveryError(ticket.get("details", {}).get("error", "provider-rejected"))
    return ticket["id"]


def user_state(db, user_id):
    rows = db.query(models.FoundationEvent).filter_by(user_id=user_id).all()
    return derive([json.loads(row.payload) for row in rows])


def practice_break_over(state, now):
    from datetime import datetime

    starts = sorted((s["start"]["at"] for s in state["sessions"]), reverse=True)
    boundaries = [s["end"]["at"] if s["end"] else s["start"]["at"] for s in state["sessions"]]
    if boundaries and now < datetime.fromisoformat(
        max(boundaries).replace("Z", "+00:00")
    ) + timedelta(minutes=15):
        return False
    return len(starts) < 2 or now >= datetime.fromisoformat(
        starts[1].replace("Z", "+00:00")
    ) + timedelta(hours=1)


def candidates(db, user_id, state, now):
    today = daily_status(state, now)
    prefs = state["preferences"]
    if not state["prepared"] or today["paused"]:
        return []
    contact = db.get(models.FoundationContact, user_id)
    destinations = {
        "email": [contact.email] if contact and contact.verified and email_configured() else [],
        "push": [
            d.token for d in db.query(models.FoundationDevice).filter_by(user_id=user_id).all()
        ],
    }
    result = []
    for channel in ("email", "push"):
        suffix = "Email" if channel == "email" else "Push"
        if prefs["daily" + suffix] and today["remaining"] and practice_break_over(state, now):
            if channel == "email":
                # One daily digest. No old reminder bursts after a deployment or outage.
                times = [prefs["dailyEmailTime"]]
            else:
                times = prefs["practiceTimes"]
            for time in times:
                minutes_late = (
                    int(today["time"][:2]) * 60
                    + int(today["time"][3:])
                    - (int(time[:2]) * 60 + int(time[3:]))
                )
                if 0 <= minutes_late < 15:
                    for destination in destinations[channel]:
                        result.append(("daily", channel, today["date"] + "/" + time, destination))
        if (
            prefs["review" + suffix]
            and state["reviewOn"]
            and today["date"] >= state["reviewOn"]
            and "09:00" <= today["time"] < "20:00"
        ):
            for destination in destinations[channel]:
                result.append(("review", channel, state["reviewOn"], destination))
    return result


def enqueue_due(db, now):
    users = [row[0] for row in db.query(models.FoundationEvent.user_id).distinct().all()]
    for user_id in users:
        for kind, channel, period, destination in candidates(
            db, user_id, user_state(db, user_id), now
        ):
            key = hashlib.sha256(
                json.dumps([user_id, kind, channel, period, destination]).encode()
            ).hexdigest()
            if db.get(models.FoundationDelivery, key):
                continue
            try:
                with db.begin_nested():
                    db.add(
                        models.FoundationDelivery(
                            id=key,
                            user_id=user_id,
                            kind=kind,
                            channel=channel,
                            period=period,
                            destination=destination,
                            status="pending",
                            attempts=0,
                            next_attempt_at=iso(now),
                            receipt_checked=False,
                        )
                    )
                    db.flush()
            except IntegrityError:
                pass
    db.commit()


def still_allowed(db, row, now):
    state = user_state(db, row.user_id)
    today = daily_status(state, now)
    prefs = state["preferences"]
    if (
        not state["prepared"]
        or today["paused"]
        or not prefs[row.kind + ("Email" if row.channel == "email" else "Push")]
    ):
        return False, state, today
    if row.channel == "email":
        contact = db.get(models.FoundationContact, row.user_id)
        if not contact or not contact.verified or contact.email != row.destination:
            return False, state, today
    elif (
        not db.query(models.FoundationDevice)
        .filter_by(user_id=row.user_id, token=row.destination)
        .first()
    ):
        return False, state, today
    if row.kind == "daily" and not practice_break_over(state, now):
        return False, state, today
    if row.kind == "daily" and (not today["remaining"] or row.period[:10] != today["date"]):
        return False, state, today
    return True, state, today


def message_for(row, state, today):
    if row.kind == "review":
        subject = "Your two-week Eguchi check-in is due"
        body = "Your next two-week practice check-in is ready. Open Eguchi Ears to view or share the practice record.\n\nAn automated assessment is not available yet. The app keeps your current animals. A parent can change the practice set in Parent settings; this reminder does not recommend advancing."
    else:
        remaining = today["remaining"]
        subject = (
            f"Eguchi Ears: {remaining} short session{'s' if remaining != 1 else ''} left today"
        )
        body = f"Your synced practice record shows {today['completed']} of {state['preferences']['dailyGoal']} full sessions today. There {'are' if remaining != 1 else 'is'} {remaining} remaining.\n\nWhen your child is ready, spend a couple of minutes with your animal sounds. Leave at least 15 minutes between sessions, and no more than two sessions in an hour. Rest if needed; there is no catch-up debt."
    body += "\n\nOpen Eguchi Ears → Parent settings → Reminders to change or turn off these messages. Offline practice may not appear here until the app syncs."
    return subject, body


def dispatch_pending(db, now):
    # A crashed worker may have sent the request. Quarantine its lease rather than duplicate it.
    db.query(models.FoundationDelivery).filter(
        models.FoundationDelivery.status == "sending",
        models.FoundationDelivery.claimed_at < iso(now - timedelta(minutes=10)),
    ).update({"status": "unknown", "failure": "worker-interrupted"}, synchronize_session=False)
    db.commit()
    ids = [
        row[0]
        for row in db.query(models.FoundationDelivery.id)
        .filter(
            models.FoundationDelivery.status == "pending",
            models.FoundationDelivery.next_attempt_at <= iso(now),
        )
        .limit(100)
        .all()
    ]
    for delivery_id in ids:
        claim = db.execute(
            update(models.FoundationDelivery)
            .where(
                models.FoundationDelivery.id == delivery_id,
                models.FoundationDelivery.status == "pending",
            )
            .values(
                status="sending",
                claimed_at=iso(now),
                attempts=models.FoundationDelivery.attempts + 1,
            )
        )
        db.commit()
        if claim.rowcount != 1:
            continue
        db.expire_all()
        row = db.get(models.FoundationDelivery, delivery_id)
        allowed, state, today = still_allowed(db, row, now)
        if not allowed:
            row.status = "cancelled"
            db.commit()
            continue
        title, body = message_for(row, state, today)
        try:
            row.provider_id = (send_email if row.channel == "email" else send_push)(
                row.destination, title, body
            )
            row.status = "accepted"
        except DeliveryError as error:
            row.failure = error.code
            if error.code == "DeviceNotRegistered":
                db.query(models.FoundationDevice).filter_by(token=row.destination).delete()
            row.status = "pending" if error.retryable and row.attempts < 3 else "failed"
            if error.code == "delivery-unknown":
                row.status = "unknown"
            row.next_attempt_at = iso(now + timedelta(minutes=2**row.attempts))
        except Exception:
            row.status, row.failure = "unknown", "unexpected-provider-response"
        db.commit()


def check_push_receipts(db, now):
    rows = (
        db.query(models.FoundationDelivery)
        .filter(
            models.FoundationDelivery.channel == "push",
            models.FoundationDelivery.status == "accepted",
            models.FoundationDelivery.receipt_checked.is_(False),
            models.FoundationDelivery.claimed_at < iso(now - timedelta(minutes=15)),
        )
        .limit(100)
        .all()
    )
    if not rows:
        return
    try:
        response = requests.post(
            "https://exp.host/--/api/v2/push/getReceipts",
            headers=push_headers(),
            json={"ids": [r.provider_id for r in rows]},
            timeout=20,
        )
        response.raise_for_status()
        receipts = response.json().get("data", {})
    except (requests.RequestException, ValueError):
        return
    for row in rows:
        receipt = receipts.get(row.provider_id)
        if not receipt:
            if row.claimed_at < iso(now - timedelta(hours=23)):
                row.receipt_checked, row.failure = True, "receipt-unavailable"
            continue
        row.receipt_checked = True
        if receipt.get("status") == "error":
            row.status = "failed"
            row.failure = receipt.get("details", {}).get("error", "receipt-error")
            if row.failure == "DeviceNotRegistered":
                db.query(models.FoundationDevice).filter_by(token=row.destination).delete()
    db.commit()


def run_reminders_once(session_factory=SessionLocal, now=None):
    now = now or utc_now()
    with session_factory() as db:
        enqueue_due(db, now)
        dispatch_pending(db, now)
        check_push_receipts(db, now)


async def reminder_worker():
    while True:
        try:
            await asyncio.to_thread(run_reminders_once)
        except Exception:
            # Do not log addresses, tokens, request headers, or event payloads.
            logger.error("Parent reminder worker failed; it will retry on the next tick")
        await asyncio.sleep(60)
