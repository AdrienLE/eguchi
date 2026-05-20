from fastapi import (
    FastAPI,
    Depends,
    UploadFile,
    File,
    HTTPException,
    Request,
)
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exception_handlers import http_exception_handler
from sqlalchemy.orm import Session
from sqlalchemy import text
from .auth import verify_jwt, AUTH0_DOMAIN
from .eguchi_audio import get_audio_pack_metadata
import os
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from openai import OpenAI
import boto3
from uuid import uuid4
import logging
import requests

from .database import Base, engine, SessionLocal
from . import models


logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logging.getLogger("uvicorn").setLevel(logging.DEBUG)
logging.getLogger("uvicorn.error").setLevel(logging.DEBUG)
logging.getLogger("uvicorn.access").setLevel(logging.DEBUG)

models.Base.metadata.create_all(bind=engine)

# Manual migration to add new columns if they don't exist
try:
    with engine.connect() as connection:
        # Check if nickname column exists
        result = connection.execute(text("PRAGMA table_info(user_settings)"))
        columns = [row[1] for row in result.fetchall()]

        if "nickname" not in columns:
            logger.info("Adding nickname column to user_settings table")
            connection.execute(text("ALTER TABLE user_settings ADD COLUMN nickname TEXT"))
            connection.commit()

        if "email" not in columns:
            logger.info("Adding email column to user_settings table")
            connection.execute(text("ALTER TABLE user_settings ADD COLUMN email TEXT"))
            connection.commit()
except Exception as e:
    logger.error(f"Migration failed: {e}")
    # Continue anyway - columns might already exist

# Initialize optional services with error handling
try:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY")) if os.getenv("OPENAI_API_KEY") else None
except Exception as e:
    logger.warning(f"OpenAI client initialization failed: {e}")
    client = None

try:
    s3_client = boto3.client("s3") if os.getenv("AWS_ACCESS_KEY_ID") else None
    S3_BUCKET = os.getenv("AWS_S3_BUCKET")
except Exception as e:
    logger.warning(f"S3 client initialization failed: {e}")
    s3_client = None
    S3_BUCKET = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("DEBUG_STARTUP") in {"1", "true", "TRUE"}:
        logger.info("🚀 FastAPI application starting up...")
        logger.info(f"Python version: {__import__('sys').version}")
        logger.info(f"Working directory: {os.getcwd()}")
        logger.info(f"Environment variables: PORT={os.getenv('PORT')}")
        logger.info(f"Frontend dist exists: {os.path.exists('frontend/dist')}")
    yield


app = FastAPI(lifespan=lifespan)


# Configure CORS to allow Expo/web dev hosts by default (override via CORS_ALLOW_ORIGINS)
_cors_env = os.getenv("CORS_ALLOW_ORIGINS", "")
if _cors_env:
    allowed_origins = [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
else:
    allowed_origins = [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://localhost:19000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost",
        "http://127.0.0.1",
    ]

if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Startup logs handled by lifespan above


@app.get("/health")
def health_check():
    """Health check endpoint for Railway deployment"""
    return {
        "status": "healthy",
        "service": "base-app-api",
        "openai": "configured" if client else "not configured",
        "s3": "configured" if s3_client else "not configured",
        "database": "connected",
    }


@app.exception_handler(HTTPException)
async def log_http_exception(request: Request, exc: HTTPException):
    logger.error(
        "HTTPException %s %s: %s",
        request.method,
        request.url,
        exc.detail,
        exc_info=True,
    )
    return await http_exception_handler(request, exc)


@app.exception_handler(Exception)
async def log_unhandled_exception(request: Request, exc: Exception):
    logger.exception("Unhandled exception for %s %s", request.method, request.url)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_nugget() -> str:
    if not client:
        return "Wisdom comes from experience, and experience comes from making mistakes."

    prompt = "Provide a short nugget of wisdom in one sentence."
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=30,
    )
    return completion.choices[0].message.content.strip()


@app.get("/api/nugget")
def read_nugget(
    db: Session = Depends(get_db),
    user=Depends(verify_jwt),
):
    nugget = db.query(models.Nugget).first()
    if not nugget:
        text = generate_nugget()
        nugget = models.Nugget(text=text)
        db.add(nugget)
        db.commit()
        db.refresh(nugget)
    return {"text": nugget.text}


@app.post("/api/nugget/regenerate")
def regenerate_nugget(
    db: Session = Depends(get_db),
    user=Depends(verify_jwt),
):
    text = generate_nugget()
    nugget = db.query(models.Nugget).first()
    if not nugget:
        nugget = models.Nugget(text=text)
        db.add(nugget)
    else:
        nugget.text = text
    db.commit()
    db.refresh(nugget)
    return {"text": nugget.text}


class SettingsIn(BaseModel):
    name: str | None = None
    nickname: str | None = None
    email: str | None = None
    imageUrl: str | None = None


class EguchiTrialEventIn(BaseModel):
    id: str
    chordId: str
    correct: bool
    timestamp: str
    clientId: str | None = None
    audioPackName: str | None = None
    audioPackHash: str | None = None


class EguchiProgressStateIn(BaseModel):
    unlockedChordIds: list[str]
    lastAutoUnlockDayKey: str | None = None
    resetAt: str | None = None


class EguchiSyncedValueIn(BaseModel):
    updatedAt: str
    data: dict


class EguchiProgressSyncedValueIn(BaseModel):
    updatedAt: str
    data: EguchiProgressStateIn


class EguchiSyncIn(BaseModel):
    clientId: str
    lastServerEventCursor: str | None = None
    trialEvents: list[EguchiTrialEventIn] = []
    progressState: EguchiProgressSyncedValueIn | None = None
    sessionPreferences: EguchiSyncedValueIn | None = None


ALLOWED_CONTENT_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
}
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", str(5 * 1024 * 1024)))  # 5 MB default


@app.post("/api/upload-profile-picture")
def upload_profile_picture(
    file: UploadFile = File(...),
    user=Depends(verify_jwt),
):
    logger.info(
        f"Upload request - filename: {file.filename}, content_type: {file.content_type}, size: {getattr(file, 'size', 'unknown')}"
    )

    if not S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3 bucket not configured")

    try:
        # Validate content type
        content_type = (file.content_type or "").lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported content type")

        # Determine size (best-effort)
        try:
            current = file.file.tell()
            file.file.seek(0, os.SEEK_END)
            size = file.file.tell()
            file.file.seek(0)
        except Exception:
            size = getattr(file, "size", 0) or 0

        if size and size > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="File too large")

        # Determine extension, prefer MIME-derived when missing
        ext = os.path.splitext(file.filename or "image")[1]
        if not ext:
            ext = ALLOWED_CONTENT_TYPES[content_type]
        key = f"profile_pics/{user['sub']}/{uuid4().hex}{ext}"
        logger.info(f"Uploading to S3 key: {key}")

        s3_client.upload_fileobj(
            file.file,
            S3_BUCKET,
            key,
            ExtraArgs={
                "ContentType": file.content_type,
            },
        )
        url = f"https://{S3_BUCKET}.s3.amazonaws.com/{key}"
        logger.info(f"Upload successful, URL: {url}")
        return {"url": url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


def fetch_auth0_userinfo(access_token: str) -> dict:
    """Fetch user profile information from Auth0 userinfo endpoint"""

    if not AUTH0_DOMAIN:
        return {}

    try:
        response = requests.get(
            f"https://{AUTH0_DOMAIN}/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        if response.status_code == 200:
            userinfo = response.json()
            logger.info(f"Fetched Auth0 userinfo: {userinfo}")
            return userinfo
        else:
            logger.warning(f"Failed to fetch userinfo: {response.status_code}")
            return {}
    except Exception as e:
        logger.error(f"Error fetching Auth0 userinfo: {e}")
        return {}


def _merge_from_profile(settings: "models.UserSettings", profile_data: dict) -> bool:
    updated = False
    if not settings.name and profile_data.get("name"):
        settings.name = profile_data["name"]
        updated = True
    elif not settings.name and profile_data.get("nickname"):
        settings.name = profile_data["nickname"]
        updated = True

    if not settings.nickname and profile_data.get("nickname"):
        settings.nickname = profile_data["nickname"]
        updated = True
    elif not settings.nickname and profile_data.get("name"):
        settings.nickname = profile_data["name"]
        updated = True

    if not settings.email and profile_data.get("email"):
        settings.email = profile_data["email"]
        updated = True

    if not settings.image_url and profile_data.get("picture"):
        settings.image_url = profile_data["picture"]
        updated = True
    return updated


@app.get("/api/settings")
def read_settings(
    db: Session = Depends(get_db),
    user=Depends(verify_jwt),
    request: Request = None,
):
    settings = (
        db.query(models.UserSettings).filter(models.UserSettings.user_id == user["sub"]).first()
    )

    # If no settings exist, create them
    if not settings:
        settings = models.UserSettings(user_id=user["sub"])
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # If any profile fields are missing, try to fetch from Auth0 userinfo endpoint
    needs_userinfo = not all([settings.name, settings.nickname, settings.email, settings.image_url])
    userinfo = {}

    if needs_userinfo and request:
        # Extract access token from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            access_token = auth_header[7:]  # Remove "Bearer " prefix
            userinfo = fetch_auth0_userinfo(access_token)

    # Merge from JWT payload first, then userinfo
    updated = False
    if user:
        updated = _merge_from_profile(
            settings,
            {
                "name": user.get("name"),
                "nickname": user.get("nickname"),
                "email": user.get("email"),
                "picture": user.get("picture"),
            },
        )
    if userinfo:
        updated = _merge_from_profile(settings, userinfo) or updated

    if updated:
        db.commit()
        db.refresh(settings)
        logger.info(
            f"Updated settings for user {user['sub']} with name='{settings.name}', nickname='{settings.nickname}', email='{settings.email}', and picture='{settings.image_url}'"
        )

    return {
        "name": settings.name or "",
        "nickname": settings.nickname or "",
        "email": settings.email or "",
        "imageUrl": settings.image_url or "",
    }


@app.post("/api/settings")
def update_settings(
    data: SettingsIn,
    db: Session = Depends(get_db),
    user=Depends(verify_jwt),
):
    settings = (
        db.query(models.UserSettings).filter(models.UserSettings.user_id == user["sub"]).first()
    )
    if not settings:
        settings = models.UserSettings(user_id=user["sub"])
        db.add(settings)

    # Only update fields that are provided in the request
    if data.name is not None:
        settings.name = data.name
    if data.nickname is not None:
        settings.nickname = data.nickname
    if data.email is not None:
        settings.email = data.email
    if data.imageUrl is not None:
        settings.image_url = data.imageUrl

    db.commit()
    db.refresh(settings)
    return {"ok": True}


@app.get("/api/eguchi/audio-pack")
def get_eguchi_audio_pack():
    try:
        return get_audio_pack_metadata()
    except (FileNotFoundError, ValueError) as error:
        logger.warning(f"Eguchi audio pack metadata unavailable: {error}")
        raise HTTPException(status_code=404, detail="Audio pack metadata unavailable") from error


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _is_newer_or_equal(candidate: str | None, current: str | None) -> bool:
    if not candidate:
        return False
    if not current:
        return True
    return candidate >= current


def _serialize_trial_event(event: models.EguchiTrialEvent) -> dict:
    return {
        "id": event.id,
        "chordId": event.chord_id,
        "correct": event.correct,
        "timestamp": event.timestamp,
        "clientId": event.client_id,
        "audioPackName": event.audio_pack_name,
        "audioPackHash": event.audio_pack_hash,
    }


def _sync_state_payload(
    state: models.EguchiUserSyncState | None,
) -> tuple[dict | None, dict | None]:
    if not state:
        return None, None
    progress_state = None
    if state.progress_state_json and state.progress_updated_at:
        progress_state = {
            "updatedAt": state.progress_updated_at,
            "data": json.loads(state.progress_state_json),
        }
    session_preferences = None
    if state.session_preferences_json and state.session_preferences_updated_at:
        session_preferences = {
            "updatedAt": state.session_preferences_updated_at,
            "data": json.loads(state.session_preferences_json),
        }
    return progress_state, session_preferences


def _pydantic_data(model: BaseModel) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


@app.post("/api/eguchi/sync")
def sync_eguchi_state(
    data: EguchiSyncIn,
    db: Session = Depends(get_db),
    user=Depends(verify_jwt),
):
    user_id = user["sub"]
    server_updated_at = _utc_now_iso()
    accepted_event_ids: list[str] = []

    for event in data.trialEvents:
        existing = (
            db.query(models.EguchiTrialEvent).filter(models.EguchiTrialEvent.id == event.id).first()
        )
        if existing:
            if existing.user_id == user_id:
                accepted_event_ids.append(event.id)
            continue

        db.add(
            models.EguchiTrialEvent(
                id=event.id,
                user_id=user_id,
                client_id=event.clientId or data.clientId,
                chord_id=event.chordId,
                correct=event.correct,
                timestamp=event.timestamp,
                audio_pack_name=event.audioPackName,
                audio_pack_hash=event.audioPackHash,
                server_updated_at=server_updated_at,
            )
        )
        accepted_event_ids.append(event.id)

    sync_state = (
        db.query(models.EguchiUserSyncState)
        .filter(models.EguchiUserSyncState.user_id == user_id)
        .first()
    )
    if not sync_state:
        sync_state = models.EguchiUserSyncState(user_id=user_id)
        db.add(sync_state)

    if data.progressState and _is_newer_or_equal(
        data.progressState.updatedAt, sync_state.progress_updated_at
    ):
        sync_state.progress_updated_at = data.progressState.updatedAt
        sync_state.progress_state_json = json.dumps(_pydantic_data(data.progressState.data))

    if data.sessionPreferences and _is_newer_or_equal(
        data.sessionPreferences.updatedAt,
        sync_state.session_preferences_updated_at,
    ):
        sync_state.session_preferences_updated_at = data.sessionPreferences.updatedAt
        sync_state.session_preferences_json = json.dumps(data.sessionPreferences.data)

    db.commit()
    db.refresh(sync_state)

    event_query = db.query(models.EguchiTrialEvent).filter(
        models.EguchiTrialEvent.user_id == user_id
    )
    if data.lastServerEventCursor:
        event_query = event_query.filter(
            models.EguchiTrialEvent.server_updated_at > data.lastServerEventCursor
        )
    server_events = (
        event_query.order_by(
            models.EguchiTrialEvent.server_updated_at.asc(),
            models.EguchiTrialEvent.timestamp.asc(),
            models.EguchiTrialEvent.id.asc(),
        )
        .limit(5000)
        .all()
    )
    event_cursor = (
        server_events[-1].server_updated_at if server_events else data.lastServerEventCursor
    )
    progress_state, session_preferences = _sync_state_payload(sync_state)

    return {
        "acceptedEventIds": accepted_event_ids,
        "trialEvents": [_serialize_trial_event(event) for event in server_events],
        "serverEventCursor": event_cursor,
        "progressState": progress_state,
        "sessionPreferences": session_preferences,
        "syncedAt": server_updated_at,
    }


# Mount frontend static files AFTER all API routes are defined
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
frontend_eguchi_assets_path = os.path.realpath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "frontend",
        "assets",
        "images",
        "eguchi",
    )
)
if os.path.isdir(frontend_path):
    if os.path.isdir(frontend_eguchi_assets_path):

        @app.get("/assets/images/eguchi/{asset_path:path}")
        async def serve_eguchi_source_asset(asset_path: str):
            resolved_path = os.path.realpath(os.path.join(frontend_eguchi_assets_path, asset_path))
            if (
                os.path.commonpath([resolved_path, frontend_eguchi_assets_path])
                != frontend_eguchi_assets_path
            ):
                raise HTTPException(status_code=404, detail="Not Found")
            if not os.path.isfile(resolved_path):
                raise HTTPException(status_code=404, detail="Not Found")
            return FileResponse(resolved_path)

    assets_dir = os.path.join(frontend_path, "assets")
    expo_static_dir = os.path.join(frontend_path, "_expo", "static")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    if os.path.isdir(expo_static_dir):
        app.mount("/_expo/static", StaticFiles(directory=expo_static_dir), name="expo-static")

    def _resolve_favicon(ext: str | None = None) -> str | None:
        dist_root = os.path.realpath(frontend_path)
        search_paths: list[str] = []
        if ext:
            search_paths.append(os.path.join(dist_root, f"favicon.{ext}"))
            if ext != "ico":
                search_paths.append(os.path.join(dist_root, "favicon.ico"))
        else:
            search_paths.append(os.path.join(dist_root, "favicon.ico"))

        search_paths.append(os.path.join(dist_root, "assets", "images", "favicon.ico"))
        search_paths.append(
            os.path.join(
                os.path.dirname(__file__), "..", "frontend", "assets", "images", "favicon.ico"
            )
        )

        for candidate in search_paths:
            if candidate and os.path.isfile(candidate):
                return candidate
        return None

    @app.get("/favicon.{ext}")
    async def serve_favicon_with_ext(ext: str):
        favicon_path = _resolve_favicon(ext)
        if favicon_path:
            return FileResponse(favicon_path)
        raise HTTPException(status_code=404, detail="Favicon not found")

    @app.get("/favicon.ico")
    async def serve_favicon_ico():
        favicon_path = _resolve_favicon("ico")
        if favicon_path:
            return FileResponse(favicon_path)
        raise HTTPException(status_code=404, detail="Favicon not found")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        # Do not catch API paths
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        # Serve static files in dist root directly when present (e.g., manifest, favicons)
        direct_file = os.path.realpath(os.path.join(frontend_path, path))
        dist_root = os.path.realpath(frontend_path)
        if os.path.commonpath([direct_file, dist_root]) == dist_root and os.path.isfile(
            direct_file
        ):
            return FileResponse(direct_file)
        # Serve HTML for routes (path -> path.html)
        html_file = os.path.realpath(os.path.join(frontend_path, f"{path}.html"))
        if os.path.commonpath([html_file, dist_root]) == dist_root and os.path.isfile(html_file):
            return FileResponse(html_file)

        # Fallback to index.html for SPA routing (client-side routing)
        return FileResponse(os.path.join(frontend_path, "index.html"))

else:
    print("Frontend build not found at", frontend_path)
