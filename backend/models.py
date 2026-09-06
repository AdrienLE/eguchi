from sqlalchemy import Boolean, Column, Integer, String, Text, UniqueConstraint
from .database import Base


class UserSettings(Base):
    __tablename__ = "user_settings"
    user_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=True)
    nickname = Column(String, nullable=True)
    email = Column(String, nullable=True)
    image_url = Column(String, nullable=True)


class Nugget(Base):
    __tablename__ = "nugget"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, nullable=False)


class EguchiTrialEvent(Base):
    __tablename__ = "eguchi_trial_events"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    client_id = Column(String, nullable=False, index=True)
    chord_id = Column(String, nullable=False)
    correct = Column(Boolean, nullable=False)
    outcome = Column(String, nullable=True)
    prompt_delay_ms = Column(Integer, nullable=True)
    timestamp = Column(String, nullable=False)
    audio_pack_name = Column(String, nullable=True)
    audio_pack_hash = Column(String, nullable=True)
    server_updated_at = Column(String, nullable=False, index=True)


class EguchiUserSyncState(Base):
    __tablename__ = "eguchi_user_sync_state"
    user_id = Column(String, primary_key=True, index=True)
    progress_state_json = Column(Text, nullable=True)
    progress_updated_at = Column(String, nullable=True)
    session_preferences_json = Column(Text, nullable=True)
    session_preferences_updated_at = Column(String, nullable=True)


class FoundationEvent(Base):
    __tablename__ = "foundation_events"
    sequence = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    event_id = Column(String, nullable=False)
    kind = Column(String, nullable=False)
    occurred_at = Column(String, nullable=False)
    payload = Column(Text, nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "event_id"),)


class FoundationContact(Base):
    __tablename__ = "foundation_contacts"
    user_id = Column(String, primary_key=True)
    email = Column(String, nullable=False, default="")
    verified = Column(Boolean, nullable=False, default=False)
    code_hash = Column(String, nullable=True)
    requested_at = Column(String, nullable=True)
    expires_at = Column(String, nullable=True)
    attempts = Column(Integer, nullable=False, default=0)


class FoundationDevice(Base):
    __tablename__ = "foundation_devices"
    token = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    updated_at = Column(String, nullable=False)


class FoundationDelivery(Base):
    __tablename__ = "foundation_deliveries"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    kind = Column(String, nullable=False)
    channel = Column(String, nullable=False)
    period = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(String, nullable=False)
    claimed_at = Column(String, nullable=True)
    provider_id = Column(String, nullable=True)
    receipt_checked = Column(Boolean, nullable=False, default=False)
    failure = Column(String, nullable=True)
