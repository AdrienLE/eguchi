"""Server-owned fortnightly AI decisions, durable claims, and atomic plan changes."""

import asyncio
import hashlib
import json
import logging
import os
from datetime import date, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo
from typing import Literal

from openai import OpenAI
from pydantic import Field
from sqlalchemy.exc import IntegrityError

from . import models
from .database import SessionLocal
from .foundation_protocol import StrictModel, derive, iso, utc_now, PROTOCOL
from .foundation_review_evidence import CHORDS, build_evidence, review_schedule
from .foundation_review_policy import POLICY_VERSION, SOURCES, SYSTEM_PROMPT

logger = logging.getLogger(__name__)
DEFAULT_MODEL = "gpt-6-astra"
DEFAULT_EFFORT = "medium"
MAX_OUTPUT_TOKENS = 2400


class Decision(StrictModel):
    decision: Literal["advance", "hold", "needs-guidance"]
    confidence: Literal["high", "medium", "low"]
    reason: str = Field(min_length=1, max_length=1400)
    nextStep: str = Field(min_length=1, max_length=700)
    uncertainties: list[str] = Field(max_length=6)
    sourceIds: list[str] = Field(min_length=1, max_length=9)


def reviews_enabled():
    return (
        bool(os.getenv("OPENAI_API_KEY"))
        and os.getenv("EGUCHI_AI_REVIEWS_ENABLED", "true").lower() == "true"
    )


def model_config():
    return os.getenv("EGUCHI_REVIEW_MODEL", DEFAULT_MODEL), os.getenv(
        "EGUCHI_REVIEW_REASONING", DEFAULT_EFFORT
    )


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def lock_account(db, user_id):
    """An UPDATE locks on PostgreSQL and SQLite, including during the final stale-input check."""
    if db.get(models.FoundationReviewAccount, user_id) is None:
        try:
            with db.begin_nested():
                db.add(models.FoundationReviewAccount(user_id=user_id, revision=0))
                db.flush()
        except IntegrityError:
            pass  # Another worker created it; serialize on its existing row below.
    db.query(models.FoundationReviewAccount).filter_by(user_id=user_id).update(
        {"revision": models.FoundationReviewAccount.revision + 1}, synchronize_session=False
    )
    return db.get(models.FoundationReviewAccount, user_id, populate_existing=True)


def read_events(db, user_id):
    return [
        json.loads(row.payload)
        for row in db.query(models.FoundationEvent)
        .filter_by(user_id=user_id)
        .order_by(models.FoundationEvent.sequence)
        .all()
    ]


def request_decision(evidence, model=None, effort=None, client=None):
    """No tools, no response storage, no SDK retries; quota is bounded by durable job attempts."""
    default_model, default_effort = model_config()
    model, effort = model or default_model, effort or default_effort
    if effort not in {"low", "medium", "high", "xhigh", "max"}:
        raise ValueError("Unsupported review reasoning effort")
    schema = Decision.model_json_schema()
    # The provider validates the shape; enforce enum membership for our source IDs too.
    schema["properties"]["sourceIds"]["items"] = {"type": "string", "enum": list(SOURCES)}
    owned = client is None
    client = client or OpenAI(timeout=90, max_retries=0)
    try:
        response = client.responses.create(
            model=model,
            reasoning={"effort": effort},
            max_output_tokens=MAX_OUTPUT_TOKENS,
            store=False,
            instructions=SYSTEM_PROMPT,
            input=canonical(evidence),
            text={
                "format": {
                    "type": "json_schema",
                    "name": "eguchi_review",
                    "strict": True,
                    "schema": schema,
                }
            },
        )
        if response.status != "completed" or not response.output_text:
            raise ValueError("Review was refused or incomplete")
        decision = Decision.model_validate_json(response.output_text)
        if not set(decision.sourceIds).issubset(SOURCES):
            raise ValueError("Unknown rule reference")
        usage = response.usage.model_dump() if response.usage else {}
        return decision, usage
    finally:
        if owned:
            client.close()


def review_status(db, user_id, now=None):
    now = now or utc_now()
    events = read_events(db, user_id)
    state = derive(events)
    row = (
        db.query(models.FoundationReview)
        .filter_by(user_id=user_id)
        .order_by(models.FoundationReview.due_on.desc())
        .first()
    )
    return {
        "available": reviews_enabled(),
        "enabled": state["preferences"]["aiReviewEnabled"],
        "nextReviewOn": review_schedule(events, now),
        "status": row.status if row else "waiting",
        "failure": row.failure if row else None,
    }


def run_review_for_user(user_id, session_factory=SessionLocal, now=None, reviewer=request_decision):
    now = now or utc_now()
    if not reviews_enabled():
        return
    with session_factory() as db:
        account = lock_account(db, user_id)
        events = read_events(db, user_id)
        state = derive(events)
        due = review_schedule(events, now)
        today = now.astimezone(ZoneInfo(state["preferences"]["timeZone"])).date().isoformat()
        if (
            not due
            or due > today
            or not state["preferences"]["aiReviewEnabled"]
            or account.upload_pending
            or account.uploaded_at
            and account.uploaded_at > iso(now - timedelta(seconds=30))
        ):
            db.commit()
            return
        row = db.query(models.FoundationReview).filter_by(user_id=user_id, due_on=due).first()
        if row and row.status == "running":
            if row.claimed_at < iso(now - timedelta(minutes=10)):
                row.status, row.failure, row.retry_at = (
                    "failed",
                    "worker-interrupted",
                    iso(now + timedelta(hours=24)),
                )
            db.commit()
            return
        if row and (row.status == "completed" or row.attempts >= 3 or row.retry_at > iso(now)):
            db.commit()
            return
        model, effort = model_config()
        if row is None:
            row = models.FoundationReview(
                id=str(uuid4()),
                user_id=user_id,
                due_on=due,
                status="pending",
                retry_at=iso(now),
                attempts=0,
                model=model,
                effort=effort,
            )
            db.add(row)
        evidence = build_evidence(events, now)
        snapshot_hash = digest(events)
        row.status, row.claimed_at = "running", iso(now)
        row.attempts += 1
        row.evidence_json, row.evidence_hash = canonical(evidence), snapshot_hash
        row.model, row.effort, row.failure = model, effort, None
        review_id = row.id
        db.commit()  # Never hold a DB lock while waiting for the provider.
    try:
        result, usage = reviewer(evidence, model=model, effort=effort)
        result = Decision.model_validate(result)
        if not set(result.sourceIds).issubset(SOURCES):
            raise ValueError("Unknown rule reference")
    except Exception:
        with session_factory() as db:
            lock_account(db, user_id)
            row = db.get(models.FoundationReview, review_id)
            row.status, row.failure = "failed", "provider-unavailable-or-invalid-response"
            row.retry_at = iso(now + timedelta(hours=24))
            db.commit()
        return  # Do not log sensitive prompts, notes, credentials or provider response bodies.
    with session_factory() as db:
        lock_account(db, user_id)
        row = db.get(models.FoundationReview, review_id)
        current = read_events(db, user_id)
        row.result_json, row.usage_json = canonical(result.model_dump()), canonical(usage)
        if digest(current) != snapshot_hash or not reviews_enabled():
            row.status, row.failure, row.retry_at = (
                "superseded",
                "record-changed-during-review",
                iso(now + timedelta(hours=1)),
            )
            db.commit()
            return
        blockers = list(evidence["advanceBlockers"])
        if result.decision == "advance" and result.confidence == "low":
            blockers.append("advancement-confidence-too-low")
        applied = result.decision == "advance" and not blockers
        stage = evidence["stage"]
        reviewed_on = evidence["reviewedOn"]
        data = {
            **result.model_dump(),
            "applied": applied,
            "stageBefore": stage,
            "stageAfter": stage + int(applied),
            "reviewedOn": reviewed_on,
            "nextReviewOn": (date.fromisoformat(reviewed_on) + timedelta(days=14)).isoformat(),
            "model": model,
            "reasoningEffort": effort,
            "policyVersion": POLICY_VERSION,
            "guardReasons": blockers,
            "evidenceHash": snapshot_hash,
        }
        data["sourceReferences"] = [SOURCES[source].split(":", 1)[0] for source in result.sourceIds]
        if result.decision == "advance" and blockers:
            data["decision"] = "hold"
            data["reason"] = (
                "The proposed advance was not applied: "
                + ", ".join(blockers)
                + ". "
                + result.reason
            )
        event = {
            "id": "ai-review:" + review_id,
            "kind": "aiReview",
            "at": iso(now),
            "protocol": PROTOCOL,
            "data": data,
        }
        if applied:
            # Existing native releases understand preferences but not the new audit kind.
            plan_event = {
                "id": "ai-plan:" + review_id,
                "kind": "preferences",
                "at": iso(now),
                "protocol": PROTOCOL,
                "data": {
                    "stage": stage + 1,
                    "activeChordIds": CHORDS[: stage + 1],
                    "introductionChordId": CHORDS[stage],
                },
            }
            db.add(
                models.FoundationEvent(
                    user_id=user_id,
                    event_id=plan_event["id"],
                    kind="preferences",
                    occurred_at=plan_event["at"],
                    payload=canonical(plan_event),
                )
            )
            db.flush()
        db.add(
            models.FoundationEvent(
                user_id=user_id,
                event_id=event["id"],
                kind="aiReview",
                occurred_at=event["at"],
                payload=canonical(event),
            )
        )
        row.status, row.completed_at = "completed", iso(now)
        db.flush()
        # The delivery is queued atomically with the decision; the outbox rechecks email opt-in.
        from .foundation_reminders import enqueue_review_decision

        enqueue_review_decision(db, user_id, event, now)
        db.commit()


def run_reviews_once(session_factory=SessionLocal, now=None, reviewer=request_decision):
    if not reviews_enabled():
        return
    with session_factory() as db:
        users = [row[0] for row in db.query(models.FoundationEvent.user_id).distinct().all()]
    for user_id in users:
        try:
            run_review_for_user(user_id, session_factory, now, reviewer)
        except Exception:
            logger.error("A practice review could not finish; durable state retained")


async def review_worker():
    while True:
        try:
            await asyncio.to_thread(run_reviews_once)
        except Exception:
            logger.error("Practice review worker failed; it will retry on the next tick")
        await asyncio.sleep(60)
