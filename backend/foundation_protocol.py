"""Versioned first-phase record contract, shared by sync and reminder delivery."""

from datetime import datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PROTOCOL = "eguchi-foundation-1"
LESSONS = {"purpose", "routine", "sound", "respond", "care", "review"}


def utc_now():
    return datetime.now(timezone.utc)


def iso(value: datetime):
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Preferences(StrictModel):
    timeZone: str | None = None
    dailyGoal: Literal[4, 5] | None = None
    practiceTimes: list[str] | None = Field(None, min_length=4, max_length=5)
    dailyEmailTime: str | None = None
    dailyEmail: bool | None = None
    reviewEmail: bool | None = None
    dailyPush: bool | None = None
    reviewPush: bool | None = None

    @field_validator("timeZone")
    @classmethod
    def valid_zone(cls, value):
        if value is not None:
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError):
                raise ValueError("Choose a valid time zone")
        return value

    @field_validator("dailyEmailTime")
    @classmethod
    def valid_time(cls, value):
        if value is not None:
            import re

            if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", value):
                raise ValueError("Use HH:MM in 24-hour time")
        return value

    @field_validator("practiceTimes")
    @classmethod
    def valid_times(cls, value):
        if value is not None:
            for item in value:
                cls.valid_time(item)
            minutes = sorted(int(t[:2]) * 60 + int(t[3:]) for t in value)
            if any(b - a < 20 for a, b in zip(minutes, minutes[1:])):
                raise ValueError("Reminder times need a twenty-minute gap")
            if any(b - a < 60 for a, b in zip(minutes, minutes[2:])):
                raise ValueError("No more than two sessions per hour")
        return value


class Background(StrictModel):
    ageMonths: int | None = Field(default=None, ge=0, le=216)
    priorTraining: Literal["none", "some", "unknown"]
    note: str = Field(max_length=2000)


class Preparation(StrictModel):
    lessonId: Literal["purpose", "routine", "sound", "respond", "care", "review"]


class Pause(StrictModel):
    date: str
    paused: bool

    @field_validator("date")
    @classmethod
    def valid_date(cls, value):
        from datetime import date

        if date.fromisoformat(value).isoformat() != value:
            raise ValueError("Use YYYY-MM-DD")
        return value


class SessionStarted(StrictModel):
    sessionId: str = Field(min_length=1, max_length=120)
    timeZone: str
    date: str
    target: Literal[10]
    recentPitchReference: Literal["yes", "no", "unknown"]

    _zone = field_validator("timeZone")(Preferences.valid_zone.__func__)
    _date = field_validator("date")(Pause.valid_date.__func__)


class Trial(StrictModel):
    sessionId: str = Field(min_length=1, max_length=120)
    index: int = Field(ge=0, le=9)
    chordId: Literal["C-E-G"]
    selectedChordId: Literal["C-E-G"] | None
    response: Literal["independent", "helped", "no-response"]
    responseMs: int = Field(ge=0, le=3600000)
    replays: int = Field(ge=0, le=50)
    firstSound: bool
    audioFile: str = Field(min_length=1, max_length=120)
    audioHash: str = Field(pattern=r"^[a-f0-9]{64}$")

    @model_validator(mode="after")
    def consistent_response(self):
        if self.firstSound != (self.index == 0):
            raise ValueError("First sound must identify the first presentation")
        if (self.selectedChordId is not None) != (self.response == "independent"):
            raise ValueError("The first unaided choice must match the response type")
        return self


class SessionEnded(StrictModel):
    sessionId: str = Field(min_length=1, max_length=120)
    reason: Literal["completed", "stopped", "interrupted"]
    observation: Literal["settled", "distracted", "tired", "upset", "listening-only"]
    note: str = Field(max_length=2000)


PAYLOAD_TYPES = {
    "background": Background,
    "preferences": Preferences,
    "preparation": Preparation,
    "pause": Pause,
    "sessionStarted": SessionStarted,
    "trial": Trial,
    "sessionEnded": SessionEnded,
}


class Event(StrictModel):
    id: str = Field(min_length=1, max_length=120)
    kind: Literal[
        "background",
        "preferences",
        "preparation",
        "pause",
        "sessionStarted",
        "trial",
        "sessionEnded",
    ]
    at: str
    protocol: Literal["eguchi-foundation-1"]
    data: dict

    @model_validator(mode="after")
    def valid_event(self):
        parsed = datetime.fromisoformat(self.at.replace("Z", "+00:00"))
        if parsed.tzinfo is None or parsed > utc_now() + timedelta(minutes=5):
            raise ValueError("Event time must have a time zone and cannot be in the future")
        self.at = iso(parsed)
        self.data = PAYLOAD_TYPES[self.kind].model_validate(self.data).model_dump(exclude_none=True)
        if self.kind == "background" and "ageMonths" not in self.data:
            self.data["ageMonths"] = None
        # Keep the explicit null that denotes no unaided selection.
        if self.kind == "trial" and "selectedChordId" not in self.data:
            self.data["selectedChordId"] = None
        if self.kind == "sessionStarted":
            local = parsed.astimezone(ZoneInfo(self.data["timeZone"])).date().isoformat()
            if self.data["date"] != local:
                raise ValueError("Session date must match its time zone")
        return self


def derive(events: list[dict]):
    """Match the client projection; preserve gaps and do not infer pitch mastery."""
    prefs = {
        "timeZone": "UTC",
        "dailyGoal": 4,
        "practiceTimes": ["07:30", "08:15", "16:00", "18:00"],
        "dailyEmailTime": "17:00",
        "dailyEmail": False,
        "reviewEmail": False,
        "dailyPush": False,
        "reviewPush": False,
    }
    prepared, paused, sessions = set(), set(), {}
    ordered = sorted(events, key=lambda e: (e["at"], e["id"]))
    for event in ordered:
        data, kind = event["data"], event["kind"]
        if kind == "preferences":
            prefs.update(data)
        elif kind == "preparation":
            prepared.add(data["lessonId"])
        elif kind == "pause":
            if data["paused"]:
                paused.add(data["date"])
            else:
                paused.discard(data["date"])
        elif kind == "sessionStarted":
            sessions.setdefault(data["sessionId"], {"start": event, "trials": {}, "end": None})
    for event in ordered:
        data, kind = event["data"], event["kind"]
        session = sessions.get(data.get("sessionId"))
        if session and kind == "trial":
            session["trials"].setdefault(data["index"], event)
        elif session and kind == "sessionEnded" and session["end"] is None:
            session["end"] = event
    started = next((s["start"]["data"]["date"] for s in sessions.values() if s["trials"]), None)
    review = (
        (datetime.fromisoformat(started) + timedelta(days=14)).date().isoformat()
        if started
        else None
    )
    return {
        "preferences": prefs,
        "prepared": prepared == LESSONS,
        "paused": paused,
        "sessions": list(sessions.values()),
        "startedOn": started,
        "reviewOn": review,
    }


def daily_status(state, now):
    local = now.astimezone(ZoneInfo(state["preferences"]["timeZone"]))
    date = local.date().isoformat()
    completed = sum(
        1
        for s in state["sessions"]
        if s["start"]["data"]["date"] == date
        and s["end"]
        and s["end"]["data"]["reason"] == "completed"
        and len(s["trials"]) == 10
    )
    return {
        "date": date,
        "time": local.strftime("%H:%M"),
        "completed": completed,
        "remaining": max(0, state["preferences"]["dailyGoal"] - completed),
        "paused": date in state["paused"],
    }
