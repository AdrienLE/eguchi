from sqlalchemy import Column, Integer, String
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
