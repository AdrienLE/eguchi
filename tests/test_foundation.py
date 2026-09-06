import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models
from backend.main import app, get_db, verify_jwt
from backend import foundation_reminders as reminders
from backend.foundation_protocol import derive, daily_status, iso

NOW = datetime(2026, 9, 5, 17, 0, tzinfo=timezone.utc)


def event(kind, data, event_id=None, at=None):
    return {
        "id": event_id or kind,
        "kind": kind,
        "data": data,
        "at": iso(at or NOW - timedelta(days=20)),
        "protocol": "eguchi-foundation-1",
    }


def ready_events(**preferences):
    prefs = {"timeZone": "UTC", "dailyEmail": True, "reviewEmail": True, **preferences}
    return [event("preferences", prefs)] + [
        event("preparation", {"lessonId": lesson}, lesson)
        for lesson in ["purpose", "routine", "sound", "respond", "care", "review"]
    ]


def session_events(session_id="session", count=10, at=None, reason="completed"):
    at = at or NOW - timedelta(hours=3)
    result = [
        event(
            "sessionStarted",
            {
                "sessionId": session_id,
                "timeZone": "UTC",
                "date": at.date().isoformat(),
                "target": 10,
                "recentPitchReference": "unknown",
            },
            session_id,
            at,
        )
    ]
    for index in range(count):
        result.append(
            event(
                "trial",
                {
                    "sessionId": session_id,
                    "index": index,
                    "chordId": "C-E-G",
                    "selectedChordId": "C-E-G",
                    "response": "independent",
                    "responseMs": 1200,
                    "replays": 0,
                    "firstSound": index == 0,
                    "audioFile": "red-C4-E4-G4.mp3",
                    "audioHash": "a" * 64,
                },
                f"{session_id}-{index}",
                at + timedelta(seconds=5 * index),
            )
        )
    result.append(
        event(
            "sessionEnded",
            {"sessionId": session_id, "reason": reason, "observation": "settled", "note": ""},
            session_id + "-end",
            at + timedelta(minutes=2),
        )
    )
    return result


@pytest.fixture
def setup(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'foundation.db'}", connect_args={"check_same_thread": False}
    )
    factory = sessionmaker(bind=engine)
    models.Base.metadata.create_all(engine)
    owner = {"sub": "parent-a"}

    def db_override():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[verify_jwt] = lambda: owner
    monkeypatch.setenv("POSTMARK_API_TOKEN", "test-only")
    monkeypatch.setenv("POSTMARK_FROM_EMAIL", "test@example.test")
    monkeypatch.setenv("EGUCHI_REMINDERS_ENABLED", "false")
    monkeypatch.setenv("EGUCHI_REMOTE_PUSH_ENABLED", "true")
    sent = []
    monkeypatch.setattr(reminders, "send_email", lambda *args: sent.append(args) or "email-ticket")
    monkeypatch.setattr(reminders, "send_push", lambda *args: sent.append(args) or "push-ticket")
    yield TestClient(app), factory, owner, sent
    app.dependency_overrides.clear()
    engine.dispose()


def add_contact(factory, verified=True):
    with factory() as db:
        db.add(
            models.FoundationContact(
                user_id="parent-a", email="parent@example.test", verified=verified
            )
        )
        db.commit()


def upload(client, events, cursor=0):
    response = client.post("/api/foundation/sync", json={"events": events, "cursor": cursor})
    assert response.status_code == 200, response.text
    return response.json()


def test_sync_retries_immutable_records_and_account_isolation(setup):
    client, factory, owner, _ = setup
    events = ready_events() + session_events()
    first = upload(client, events)
    retry = upload(client, events, first["cursor"])
    assert retry["acknowledged"] == [e["id"] for e in events]
    assert retry["events"] == []
    changed = {**events[0], "data": {"dailyGoal": 5}}
    assert client.post("/api/foundation/sync", json={"events": [changed]}).status_code == 409
    owner["sub"] = "parent-b"
    assert upload(client, [])["events"] == []
    assert client.get("/api/foundation/review-record").json()["events"] == []
    # Event IDs from another owner cannot expose or alter that owner's data.
    upload(client, [changed])
    owner["sub"] = "parent-a"
    assert upload(client, [])["events"][0]["data"]["dailyEmail"] is True


def test_sync_pagination_does_not_skip_events(setup):
    client, _, _, _ = setup
    for batch in range(6):
        upload(
            client,
            [
                event("pause", {"date": "2026-09-05", "paused": False}, f"p-{batch}-{i}")
                for i in range(100)
            ],
        )
    first = upload(client, [])
    assert len(first["events"]) == 500 and first["hasMore"]
    second = upload(client, [], first["cursor"])
    assert len(second["events"]) == 100 and not second["hasMore"]
    assert len({e["id"] for e in first["events"] + second["events"]}) == 600


def test_help_annotation_sync_preserves_tap_and_supports_correction(setup):
    client, _, _, _ = setup
    session = session_events(count=1, reason="stopped")
    tap = session[1]
    help_note = event(
        "trialAssistance",
        {"sessionId": "session", "trialId": tap["id"], "helped": True},
        "help-note",
        NOW - timedelta(hours=2),
    )
    upload(client, [help_note])
    upload(client, session + [help_note])
    events = client.get("/api/foundation/review-record").json()["events"]
    projected = derive(events)["sessions"][0]["trials"][0]
    assert projected["assistance"]["data"]["helped"] is True
    assert projected["data"]["selectedChordId"] == "C-E-G"
    assert "assistance" not in tap
    assert len([e for e in events if e["kind"] == "trial"]) == 1
    correction = event(
        "trialAssistance",
        {**help_note["data"], "helped": False},
        "undo-help",
        NOW - timedelta(hours=1),
    )
    unrelated = event(
        "trialAssistance",
        {**help_note["data"], "sessionId": "other"},
        "unrelated",
        NOW,
    )
    assert (
        derive([correction, unrelated] + events)["sessions"][0]["trials"][0]["assistance"]["data"][
            "helped"
        ]
        is False
    )


@pytest.mark.parametrize(
    "kind,data",
    [
        ("preferences", {"timeZone": "Nowhere/Invalid"}),
        ("preferences", {"dailyEmailTime": "25:00"}),
        ("preferences", {"practiceTimes": ["07:00", "07:20", "07:40", "18:00"]}),
        ("trial", {**session_events()[1]["data"], "chordId": "F-A-C"}),
        ("trial", {**session_events()[1]["data"], "firstSound": False}),
        ("trial", {**session_events()[1]["data"], "response": "helped"}),
        ("sessionStarted", {**session_events()[0]["data"], "date": "2026-09-04"}),
    ],
)
def test_invalid_protocol_data_is_rejected(setup, kind, data):
    client, _, _, _ = setup
    assert (
        client.post(
            "/api/foundation/sync", json={"events": [event(kind, data, at=NOW)]}
        ).status_code
        == 422
    )


def test_email_verification_is_explicit_separate_and_bounded(setup, monkeypatch):
    client, factory, _, sent = setup
    monkeypatch.setattr("backend.foundation_api.secrets.randbelow", lambda _: 123456)
    response = client.post(
        "/api/foundation/contact/request-code", json={"email": "parent@example.test"}
    )
    assert response.status_code == 200
    assert len(sent) == 1 and "123456" in sent[0][2]
    assert client.get("/api/foundation/contact").json()["verified"] is False
    assert (
        client.post(
            "/api/foundation/contact/request-code", json={"email": "second@example.test"}
        ).status_code
        == 429
    )
    assert client.post("/api/foundation/contact/verify", json={"code": "999999"}).status_code == 400
    assert client.post("/api/foundation/contact/verify", json={"code": "123456"}).status_code == 200
    assert client.get("/api/foundation/contact").json()["verified"] is True
    with factory() as db:
        assert db.get(models.FoundationContact, "parent-a").code_hash is None
    assert client.delete("/api/foundation/contact").status_code == 200
    assert client.get("/api/foundation/contact").json()["email"] == ""


def test_verification_locks_after_five_failures_and_expires(setup, monkeypatch):
    client, factory, _, _ = setup
    monkeypatch.setattr("backend.foundation_api.secrets.randbelow", lambda _: 123456)
    client.post("/api/foundation/contact/request-code", json={"email": "parent@example.test"})
    for _ in range(5):
        assert (
            client.post("/api/foundation/contact/verify", json={"code": "000000"}).status_code
            == 400
        )
    assert client.post("/api/foundation/contact/verify", json={"code": "123456"}).status_code == 400
    with factory() as db:
        row = db.get(models.FoundationContact, "parent-a")
        row.attempts = 0
        row.expires_at = iso(NOW - timedelta(days=100))
        db.commit()
    assert client.post("/api/foundation/contact/verify", json={"code": "123456"}).status_code == 400


def test_daily_email_runs_once_with_remaining_work_and_respects_goal(setup):
    client, factory, _, sent = setup
    upload(client, ready_events() + session_events())
    add_contact(factory)
    reminders.run_reminders_once(factory, NOW)
    reminders.run_reminders_once(factory, NOW + timedelta(minutes=1))
    assert len(sent) == 1
    assert "3 short sessions" in sent[0][1]
    assert "1 of 4" in sent[0][2]
    upload(client, sum((session_events(f"s{i}") for i in range(3)), []))
    with factory() as db:
        assert reminders.candidates(db, "parent-a", reminders.user_state(db, "parent-a"), NOW) == []


def test_queued_email_is_cancelled_when_parent_pauses_or_unsubscribes(setup):
    client, factory, _, sent = setup
    upload(client, ready_events())
    add_contact(factory)
    with factory() as db:
        reminders.enqueue_due(db, NOW)
    upload(client, [event("pause", {"date": "2026-09-05", "paused": True}, "rest", NOW)])
    with factory() as db:
        reminders.dispatch_pending(db, NOW)
        assert db.query(models.FoundationDelivery).one().status == "cancelled"
    assert sent == []


def test_unverified_email_and_incomplete_preparation_never_receive_reminders(setup):
    client, factory, _, sent = setup
    upload(client, ready_events())
    add_contact(factory, verified=False)
    reminders.run_reminders_once(factory, NOW)
    assert sent == []
    with factory() as db:
        db.get(models.FoundationContact, "parent-a").verified = True
        db.query(models.FoundationEvent).filter_by(event_id="care").delete()
        db.commit()
    reminders.run_reminders_once(factory, NOW)
    assert sent == []


def test_review_reminder_is_once_per_review_and_never_claims_assessment(setup):
    client, factory, _, sent = setup
    upload(client, ready_events(dailyEmail=False) + session_events(at=NOW - timedelta(days=14)))
    add_contact(factory)
    reminders.run_reminders_once(factory, NOW)
    reminders.run_reminders_once(factory, NOW + timedelta(days=1))
    assert len(sent) == 1
    assert "check-in is due" in sent[0][1]
    assert "not available" in sent[0][2] and "parent can change" in sent[0][2]
    assert client.get("/api/foundation/review-record").json()["assessment"] == "not-performed"


def test_rate_limit_retries_but_ambiguous_delivery_does_not_duplicate(setup, monkeypatch):
    client, factory, _, sent = setup
    upload(client, ready_events())
    add_contact(factory)
    attempts = []

    def limited(*args):
        attempts.append(args)
        raise reminders.DeliveryError("provider-rate-limit", retryable=True)

    monkeypatch.setattr(reminders, "send_email", limited)
    reminders.run_reminders_once(factory, NOW)
    reminders.run_reminders_once(factory, NOW + timedelta(minutes=1))
    assert len(attempts) == 1
    reminders.run_reminders_once(factory, NOW + timedelta(minutes=2))
    assert len(attempts) == 2

    def unknown(*args):
        attempts.append(args)
        raise reminders.DeliveryError("delivery-unknown")

    monkeypatch.setattr(reminders, "send_email", unknown)
    reminders.run_reminders_once(factory, NOW + timedelta(minutes=6))
    reminders.run_reminders_once(factory, NOW + timedelta(minutes=12))
    assert len(attempts) == 3
    with factory() as db:
        assert db.query(models.FoundationDelivery).one().status == "unknown"


def test_push_token_removed_after_provider_rejects_device(setup, monkeypatch):
    client, factory, _, _ = setup
    upload(
        client,
        ready_events(
            dailyEmail=False, dailyPush=True, practiceTimes=["07:30", "08:15", "17:00", "18:00"]
        ),
    )
    token = "ExpoPushToken[device123]"
    assert client.post("/api/foundation/device", json={"token": token}).status_code == 200

    def reject(*args):
        raise reminders.DeliveryError("DeviceNotRegistered")

    monkeypatch.setattr(reminders, "send_push", reject)
    reminders.run_reminders_once(factory, NOW)
    with factory() as db:
        assert db.get(models.FoundationDevice, token) is None
        assert db.query(models.FoundationDelivery).one().failure == "DeviceNotRegistered"


def test_timezone_and_dst_use_local_calendar_for_review_and_daily_counts():
    events = ready_events(timeZone="America/Los_Angeles") + session_events()
    state = derive(events)
    assert (
        daily_status(state, datetime(2026, 9, 6, 6, 59, tzinfo=timezone.utc))["date"]
        == "2026-09-05"
    )
    assert (
        daily_status(state, datetime(2026, 9, 6, 7, 0, tzinfo=timezone.utc))["date"] == "2026-09-06"
    )
    events = ready_events() + session_events(at=datetime(2026, 10, 25, 12, tzinfo=timezone.utc))
    assert derive(events)["reviewOn"] == "2026-11-08"


def test_background_metadata_is_preserved_for_future_age_appropriate_review(setup):
    client, _, _, _ = setup
    data = {"ageMonths": 55, "priorTraining": "none", "note": "New to the program"}
    upload(client, [event("background", data)])
    assert client.get("/api/foundation/review-record").json()["events"][0]["data"] == data


def test_reminder_does_not_interrupt_required_break(setup):
    client, factory, _, sent = setup
    upload(client, ready_events() + session_events(at=NOW - timedelta(minutes=5)))
    add_contact(factory)
    reminders.run_reminders_once(factory, NOW)
    assert sent == []


def test_push_receipt_retires_dead_token(setup, monkeypatch):
    client, factory, _, _ = setup
    upload(
        client,
        ready_events(
            dailyEmail=False, dailyPush=True, practiceTimes=["07:30", "08:15", "17:00", "18:00"]
        ),
    )
    client.post("/api/foundation/device", json={"token": "ExpoPushToken[device123]"})
    reminders.run_reminders_once(factory, NOW)

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "data": {
                    "push-ticket": {"status": "error", "details": {"error": "DeviceNotRegistered"}}
                }
            }

    monkeypatch.setattr(reminders.requests, "post", lambda *a, **kw: Response())
    with factory() as db:
        reminders.check_push_receipts(db, NOW + timedelta(minutes=16))
        row = db.query(models.FoundationDelivery).one()
        assert row.receipt_checked and row.status == "failed"
        assert db.query(models.FoundationDevice).count() == 0


def test_full_chord_phase_preserves_choices_and_thirty_trial_completion(setup):
    from typing import get_args
    from backend.foundation_protocol import ChordId

    client, factory, _, _ = setup
    choices = list(get_args(ChordId))
    events = ready_events(stage=14, activeChordIds=choices, introductionChordId="Eb-G-Bb")
    session = session_events(count=30)
    session[0]["data"].update(
        target=30, activeChordIds=choices, presentationPlan=(choices * 3)[:30]
    )
    for i, trial in enumerate(session[1:-1]):
        trial["data"].update(
            chordId=choices[i % 14], selectedChordId=choices[(i + 1) % 14], response="incorrect"
        )
    events += session
    upload(client, events)
    state = derive(events)
    assert daily_status(state, NOW)["completed"] == 1
    exported = client.get("/api/foundation/review-record").json()
    assert exported["phase"] == "chord-colors"
    assert (
        next(e for e in exported["events"] if e["kind"] == "trial")["data"]["selectedChordId"]
        == "C-F-A"
    )
    upload(client, [event("preferences", {"introductionChordId": None}, "balanced", at=NOW)])
    from backend.foundation_api import read_events

    with factory() as db:
        assert derive(read_events(db, "parent-a"))["preferences"]["introductionChordId"] is None


def test_parent_check_in_repeats_fortnight_without_advancement(setup):
    client, factory, _, sent = setup
    events = ready_events(dailyEmail=False) + session_events(at=NOW - timedelta(days=16))
    upload(client, events)
    add_contact(factory)
    reminders.run_reminders_once(factory, NOW)
    assert len(sent) == 1
    check_in = event(
        "checkIn",
        {"date": NOW.date().isoformat(), "timeZone": "UTC", "note": "Happy to keep practicing."},
        at=NOW,
    )
    upload(client, [check_in])
    state = derive(events + [check_in])
    assert state["reviewOn"] == "2026-09-19"
    assert state["preferences"]["activeChordIds"] == ["C-E-G"]
    reminders.run_reminders_once(factory, NOW)
    assert len(sent) == 1
    reminders.run_reminders_once(factory, NOW + timedelta(days=14))
    assert len(sent) == 2


def test_unconfigured_remote_push_falls_back_without_registering_device(setup, monkeypatch):
    client, factory, _, _ = setup
    monkeypatch.setenv("EGUCHI_REMOTE_PUSH_ENABLED", "false")
    assert (
        client.post("/api/foundation/device", json={"token": "ExponentPushToken[test]"}).status_code
        == 503
    )
    with factory() as db:
        assert db.query(models.FoundationDevice).count() == 0
