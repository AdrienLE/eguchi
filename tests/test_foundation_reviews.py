import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Event as ThreadEvent
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models, foundation_reviews as reviews, foundation_reminders as reminders
from backend.foundation_protocol import derive, iso
from backend.foundation_review_evidence import build_evidence, review_schedule
from backend.main import app, get_db, verify_jwt
from scripts.eguchi_review_cases import NOW, record


@pytest.fixture
def setup(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'reviews.db'}", connect_args={"check_same_thread": False}
    )
    models.Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    monkeypatch.setenv("EGUCHI_AI_REVIEWS_ENABLED", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "test-only")
    monkeypatch.setenv("EGUCHI_REMINDERS_ENABLED", "false")
    owner = {"sub": "parent"}

    def get_test_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[verify_jwt] = lambda: owner
    yield factory, TestClient(app), owner
    app.dependency_overrides.clear()
    engine.dispose()


def save(factory, events, user="parent"):
    with factory() as db:
        reviews.lock_account(db, user)
        for e in events:
            db.add(
                models.FoundationEvent(
                    user_id=user,
                    event_id=e["id"],
                    kind=e["kind"],
                    occurred_at=e["at"],
                    payload=reviews.canonical(e),
                )
            )
        db.commit()


def decision(kind="advance", confidence="high"):
    return reviews.Decision(
        decision=kind,
        confidence=confidence,
        reason="Comfortable regular practice supports the next sound.",
        nextStep="Introduce the next sound gently.",
        uncertainties=[],
        sourceIds=["B2-Q9"],
    )


def run(factory, result=None, now=NOW):
    calls = []

    def reviewer(evidence, **kwargs):
        calls.append((evidence, kwargs))
        return result or decision(), {"input_tokens": 20, "output_tokens": 10}

    reviews.run_review_for_user("parent", factory, now, reviewer)
    return calls


def events_for(factory):
    with factory() as db:
        return reviews.read_events(db, "parent")


def test_due_only_after_fourteen_local_days_and_independent_of_checkin():
    events = record(1)
    first = events[0]["at"]
    assert review_schedule(events, NOW) == "2026-09-12"
    events.append(
        {
            **events[0],
            "id": "checkin",
            "kind": "checkIn",
            "at": iso(NOW),
            "data": {"date": "2026-09-12", "timeZone": "UTC", "note": "fine"},
        }
    )
    assert review_schedule(events, NOW) == "2026-09-12"
    assert first.startswith("2026-08-29")
    assert review_schedule([], NOW) is None
    events.append({**events[0], "id": "manual", "at": iso(NOW), "data": {"stage": 2}})
    assert review_schedule(events, NOW) == "2026-09-26"


def test_server_advance_sync_and_one_decision_per_fortnight(setup):
    factory, client, _ = setup
    save(factory, record(1))
    assert not run(factory, now=NOW - timedelta(days=1))
    assert len(run(factory)) == 1
    state = derive(events_for(factory))
    assert state["preferences"]["stage"] == 2
    assert state["preferences"]["introductionChordId"] == "C-F-A"
    assert len(state["aiReviews"]) == 1
    assert not run(factory)
    assert not run(factory, now=NOW + timedelta(days=13))
    data = client.post("/api/foundation/sync", json={"cursor": 0}).json()
    # Paginated sync ultimately includes the server event.
    while data["hasMore"]:
        data = client.post("/api/foundation/sync", json={"cursor": data["cursor"]}).json()
    assert data["events"][-1]["kind"] == "aiReview"
    exported = client.get("/api/foundation/review-record").json()
    assert exported["assessment"] == "ai-reviewed"
    assert exported["aiReviews"][0]["data"]["stageAfter"] == 2


@pytest.mark.parametrize(
    "stage,confidence,custom",
    [(9, "high", False), (14, "high", False), (2, "low", False), (2, "high", True)],
)
def test_model_cannot_bypass_server_guards(setup, stage, confidence, custom):
    factory, _, _ = setup
    events = record(stage)
    if custom:
        events[0]["data"]["activeChordIds"] = ["C-E-G"]
    save(factory, events)
    run(factory, decision(confidence=confidence))
    state = derive(events_for(factory))
    assert state["preferences"]["stage"] == stage
    assert state["aiReviews"][-1]["data"]["decision"] == "hold"
    assert state["aiReviews"][-1]["data"]["guardReasons"]


def test_help_annotations_and_confusion_groups_are_preserved():
    events = record(6, variant="inversions")
    evidence = build_evidence(events, NOW)
    assert evidence["confusions"] and all(c["sameTriadInversion"] for c in evidence["confusions"])
    mixed = build_evidence(record(6, variant="mixed-errors"), NOW)
    assert any(not c["sameTriadInversion"] for c in mixed["confusions"])
    target = next(
        e for e in events if e["kind"] == "trial" and e["data"]["response"] == "incorrect"
    )
    events.append(
        {
            **target,
            "kind": "trialAssistance",
            "id": "help",
            "at": iso(NOW),
            "data": {
                "sessionId": target["data"]["sessionId"],
                "trialId": target["id"],
                "helped": True,
            },
        }
    )
    updated = build_evidence(events, NOW)
    assert (
        sum(c["count"] for c in updated["confusions"])
        == sum(c["count"] for c in evidence["confusions"]) - 1
    )
    assert updated["byChord"][target["data"]["chordId"]]["responses"]["helped"] == 1
    assert len(updated["daily"]) == 15
    assert "user_id" not in reviews.canonical(updated)


def test_sparse_missing_days_references_and_inconsistent_trials():
    events = record(2, days=2)
    for e in events:
        if e["kind"] == "sessionStarted":
            e["data"]["recentPitchReference"] = "unknown"
    evidence = build_evidence(events, NOW)
    assert evidence["cleanFirstSounds"] == 0
    assert sum(d["trials"] == 0 for d in evidence["daily"]) == 13
    next(e for e in events if e["kind"] == "trial")["data"]["chordId"] = "E-G-C"
    assert "inconsistent-trial-records" in build_evidence(events, NOW)["advanceBlockers"]


def test_disabled_and_incomplete_upload_do_not_spend(setup):
    factory, _, _ = setup
    events = record(1)
    events[0]["data"]["aiReviewEnabled"] = False
    save(factory, events)
    assert not run(factory)


def test_pending_upload_defers_enabled_review_and_medium_decision_reaches_older_clients(setup):
    factory, _, _ = setup
    save(factory, record(1))
    with factory() as db:
        account = reviews.lock_account(db, "parent")
        account.upload_pending = True
        db.commit()
    assert not run(factory)
    with factory() as db:
        db.get(models.FoundationReviewAccount, "parent").upload_pending = False
        db.commit()
    assert run(factory, decision(confidence="medium"))
    events = events_for(factory)
    legacy_events = [e for e in events if e["kind"] != "aiReview"]
    assert derive(legacy_events)["preferences"]["stage"] == 2
    assert derive(events)["aiReviews"][0]["data"]["confidence"] == "medium"
    with factory() as db:
        account = reviews.lock_account(db, "parent")
        account.upload_pending = True
        db.commit()
    assert not run(factory)


def test_concurrent_workers_share_claim_and_stale_input_is_not_applied(setup):
    factory, _, _ = setup
    save(factory, record(1))
    entered, finish = ThreadEvent(), ThreadEvent()

    def slow(evidence, **kwargs):
        entered.set()
        assert finish.wait(10)
        return decision(), {}

    with ThreadPoolExecutor() as pool:
        future = pool.submit(reviews.run_review_for_user, "parent", factory, NOW, slow)
        assert entered.wait(5)
        assert not run(factory)
        save(
            factory,
            [
                {
                    "id": "manual-override",
                    "kind": "preferences",
                    "at": iso(NOW),
                    "protocol": "eguchi-foundation-1",
                    "data": {"aiReviewEnabled": False},
                }
            ],
        )
        finish.set()
        future.result(10)
    assert not derive(events_for(factory))["aiReviews"]
    with factory() as db:
        assert db.query(models.FoundationReview).one().status == "superseded"


def test_failure_stays_put_and_daily_retries_are_bounded(setup):
    factory, _, _ = setup
    save(factory, record(1))
    calls = []

    def fail(*args, **kwargs):
        calls.append(1)
        raise TimeoutError("sensitive provider detail")

    for days in [0, 0, 1, 2, 3, 4]:
        reviews.run_review_for_user("parent", factory, NOW + timedelta(days=days), fail)
    assert len(calls) == 3
    assert not derive(events_for(factory))["aiReviews"]
    with factory() as db:
        row = db.query(models.FoundationReview).one()
        assert "sensitive" not in row.failure
        assert row.status == "failed"


def test_client_cannot_forge_review_and_other_account_cannot_read_it(setup):
    factory, client, owner = setup
    save(factory, record(1))
    run(factory)
    event = derive(events_for(factory))["aiReviews"][0]
    assert client.post("/api/foundation/sync", json={"events": [event]}).status_code == 422
    owner["sub"] = "someone-else"
    assert client.get("/api/foundation/ai-review").json()["status"] == "waiting"
    assert client.get("/api/foundation/review-record").json()["events"] == []


@pytest.mark.parametrize("kind", ["advance", "hold", "needs-guidance"])
def test_decision_email_is_atomic_unique_and_rechecks_verified_optin(setup, monkeypatch, kind):
    factory, _, _ = setup
    save(factory, record(1))
    with factory() as db:
        db.add(
            models.FoundationContact(user_id="parent", email="parent@example.test", verified=True)
        )
        db.commit()
    run(factory, decision(kind))
    run(factory)
    sent = []
    monkeypatch.setattr(reminders, "send_email", lambda *args: sent.append(args) or "ticket")
    with factory() as db:
        assert db.query(models.FoundationDelivery).count() == 1
        reminders.dispatch_pending(db, NOW)
        reminders.dispatch_pending(db, NOW)
        assert db.query(models.FoundationDelivery).one().status == "accepted"
    assert len(sent) == 1
    assert "Next AI review: 2026-09-26" in sent[0][2]
    assert ("moved from level" in sent[0][2]) == (kind == "advance")


def test_unverified_email_not_queued_and_optout_cancels_queued_email(setup, monkeypatch):
    factory, _, _ = setup
    save(factory, record(1))
    with factory() as db:
        db.add(
            models.FoundationContact(user_id="parent", email="parent@example.test", verified=False)
        )
        db.commit()
    run(factory)
    with factory() as db:
        assert db.query(models.FoundationDelivery).count() == 0
        db.get(models.FoundationContact, "parent").verified = True
        event = derive(reviews.read_events(db, "parent"))["aiReviews"][0]
        reminders.enqueue_review_decision(db, "parent", event, NOW)
        db.commit()
        db.get(models.FoundationContact, "parent").verified = False
        db.commit()
        monkeypatch.setattr(reminders, "send_email", lambda *a: pytest.fail("must not send"))
        reminders.dispatch_pending(db, NOW)
        assert db.query(models.FoundationDelivery).one().status == "cancelled"


@pytest.mark.parametrize(
    "status,text",
    [("incomplete", "{}"), ("completed", ""), ("completed", '{"decision":"advance"}')],
)
def test_provider_incomplete_refusal_invalid_shape_fail_closed(status, text):
    fake = SimpleNamespace(
        responses=SimpleNamespace(
            create=lambda **kwargs: SimpleNamespace(status=status, output_text=text)
        )
    )
    with pytest.raises(ValueError):
        reviews.request_decision({}, client=fake)


def test_provider_request_uses_astra_structured_output_and_bounded_tokens(monkeypatch):
    monkeypatch.delenv("EGUCHI_REVIEW_MODEL", raising=False)
    monkeypatch.delenv("EGUCHI_REVIEW_REASONING", raising=False)
    captured = {}

    def create(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(
            status="completed", output_text=decision().model_dump_json(), usage=None
        )

    reviews.request_decision({}, client=SimpleNamespace(responses=SimpleNamespace(create=create)))
    assert captured["model"] == "gpt-6-astra"
    assert captured["reasoning"] == {"effort": "medium"}
    assert captured["store"] is False
    assert captured["max_output_tokens"] == 2400
    assert captured["text"]["format"]["strict"] is True
    assert "temperature" not in captured and "tools" not in captured
