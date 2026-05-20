from sqlalchemy import Boolean, Column, Integer, String, Text
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
