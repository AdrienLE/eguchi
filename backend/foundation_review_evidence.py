"""Bounded review input; omit account identifiers and contact details."""

from collections import Counter
from datetime import date, datetime, timedelta
from typing import get_args
from zoneinfo import ZoneInfo

from .foundation_protocol import ChordId, derive
from .foundation_review_policy import POLICY_VERSION

CHORDS = list(get_args(ChordId))
TRIADS = [set(CHORDS[i] for i in group) for group in [(0, 5, 8), (1, 3, 6), (2, 4, 7)]]
PLAN_FIELDS = {"stage", "activeChordIds", "introductionChordId"}


def plan_changed_on(events, state):
    zone = ZoneInfo(state["preferences"]["timeZone"])
    changes = [
        e
        for e in events
        if (e["kind"] == "preferences" and PLAN_FIELDS.intersection(e["data"]))
        or (e["kind"] == "aiReview" and e["data"]["applied"])
    ]
    return (
        max(
            [state["startedOn"]]
            + [
                datetime.fromisoformat(e["at"].replace("Z", "+00:00"))
                .astimezone(zone)
                .date()
                .isoformat()
                for e in changes
            ]
        )
        if state["startedOn"]
        else None
    )


def review_schedule(events, now):
    state = derive(events)
    if not state["startedOn"]:
        return None
    today = now.astimezone(ZoneInfo(state["preferences"]["timeZone"])).date()
    reviews = [e["data"]["reviewedOn"] for e in events if e["kind"] == "aiReview"]
    base = date.fromisoformat(max([plan_changed_on(events, state)] + reviews))
    # Coalesce missed periods into one current review rather than spending on a backlog.
    periods = max(1, (today - base).days // 14)
    return (base + timedelta(days=14 * periods)).isoformat()


def build_evidence(events, now):
    events = sorted(events, key=lambda e: (e["at"], e["id"]))
    state = derive(events)
    prefs = state["preferences"]
    today = now.astimezone(ZoneInfo(prefs["timeZone"])).date()
    start = today - timedelta(days=14)
    changed = plan_changed_on(events, state)
    stage, active = prefs["stage"], prefs["activeChordIds"]
    blockers = []
    if not state["prepared"]:
        blockers.append("parent-preparation-incomplete")
    if not changed or (today - date.fromisoformat(changed)).days < 14:
        blockers.append("current-plan-less-than-fourteen-days")
    if active != CHORDS[:stage]:
        blockers.append("parent-customized-active-set")
    if stage >= 9:
        blockers.append("next-response-phase-not-implemented")

    days = {
        (start + timedelta(days=i)).isoformat(): {
            "date": (start + timedelta(days=i)).isoformat(),
            "partialDay": i == 14,
            "restDay": (start + timedelta(days=i)).isoformat() in state["paused"],
            "sessions": 0,
            "completed": 0,
            "unfinished": 0,
            "trials": 0,
            "responses": Counter(),
            "observations": Counter(),
        }
        for i in range(15)
    }
    by_chord = {
        c: {
            "responses": Counter(),
            "firstWithoutReference": Counter(),
            "firstWithOrUnknownReference": Counter(),
            "replayedTrials": 0,
            "responseMsTotal": 0,
            "recordedDays": set(),
        }
        for c in active
    }
    confusions, observations, notes = Counter(), Counter(), []
    current_sessions, other_sessions, invalid_trials, total, clean_first = 0, 0, 0, 0, 0
    for session in state["sessions"]:
        s = session["start"]["data"]
        day = days.get(s["date"])
        if day is None:
            continue
        day["sessions"] += 1
        ended = session["end"]["data"] if session["end"] else None
        complete = (
            ended and ended["reason"] == "completed" and len(session["trials"]) == s["target"]
        )
        day["completed"] += bool(complete)
        day["unfinished"] += not bool(complete)
        observation = ended["observation"] if ended else "not-recorded"
        observations[observation] += 1
        day["observations"][observation] += 1
        if ended and ended["note"]:
            notes.append({"date": s["date"], "note": ended["note"][:500]})
        same_plan = s.get("activeChordIds") == active and s["date"] >= (changed or "")
        if not same_plan:
            other_sessions += 1
            continue
        current_sessions += 1
        for trial in session["trials"].values():
            t = trial["data"]
            if (
                t["chordId"] not in active
                or t["index"] >= s["target"]
                or t.get("selectedChordId") is not None
                and t["selectedChordId"] not in active
                or s.get("presentationPlan")
                and s["presentationPlan"][t["index"]] != t["chordId"]
            ):
                invalid_trials += 1
                continue
            response = (
                "helped"
                if trial.get("assistance", {}).get("data", {}).get("helped")
                else t["response"]
            )
            chord = by_chord[t["chordId"]]
            chord["responses"][response] += 1
            chord["recordedDays"].add(s["date"])
            chord["responseMsTotal"] += t["responseMs"]
            chord["replayedTrials"] += t["replays"] > 0
            day["responses"][response] += 1
            day["trials"] += 1
            total += 1
            if t["firstSound"]:
                clean = s["recentPitchReference"] == "no" and t["replays"] == 0
                chord["firstWithoutReference" if clean else "firstWithOrUnknownReference"][
                    response
                ] += 1
                clean_first += clean
            if response == "incorrect":
                confusions[(t["chordId"], t["selectedChordId"])] += 1
    if not total:
        blockers.append("no-current-plan-trials")
    if any(not c["responses"] for c in by_chord.values()):
        blockers.append("unobserved-active-chords")
    if invalid_trials:
        blockers.append("inconsistent-trial-records")
    for chord in by_chord.values():
        chord["recordedDays"] = len(chord["recordedDays"])
    background = next((e["data"] for e in reversed(events) if e["kind"] == "background"), None)
    checkins = [
        {"date": e["data"]["date"], "note": e["data"]["note"][:500]}
        for e in events
        if e["kind"] == "checkIn" and e["data"]["date"] >= start.isoformat()
    ]
    return {
        "policyVersion": POLICY_VERSION,
        "reviewedOn": today.isoformat(),
        "windowStart": start.isoformat(),
        "windowIncludesPartialToday": True,
        "stage": stage,
        "activeChordIds": active,
        "planChangedOn": changed,
        "nextChordId": CHORDS[stage] if stage < 14 else None,
        "introductionChordId": prefs["introductionChordId"],
        "dailyGoal": prefs["dailyGoal"],
        "oneChoiceParticipationOnly": len(active) == 1,
        "advanceBlockers": blockers,
        "currentPlanSessions": current_sessions,
        "otherOrUnknownPlanSessions": other_sessions,
        "invalidTrials": invalid_trials,
        "currentPlanTrials": total,
        "cleanFirstSounds": clean_first,
        "daily": list(days.values()),
        "byChord": by_chord,
        "confusions": [
            {
                "heard": a,
                "chosen": b,
                "count": n,
                "sameTriadInversion": any(a in group and b in group for group in TRIADS),
            }
            for (a, b), n in sorted(confusions.items())
        ],
        "observations": observations,
        # No account/contact fields or full books. Notes are bounded untrusted observations.
        "parentNotesPresent": bool(notes or checkins or background and background.get("note")),
        "parentNotes": sorted(notes + checkins, key=lambda note: note["date"])[-6:],
        "background": (
            {
                **{k: background[k] for k in ("ageMonths", "priorTraining") if k in background},
                "note": background.get("note", "")[:500],
            }
            if background
            else None
        ),
        "dataLimitations": [
            "Only synced records are visible.",
            "Only the six latest short note excerpts are included; other notes may exist.",
            "Session-level distraction does not classify individual errors.",
            "One-choice responses cannot establish discrimination.",
        ],
    }
