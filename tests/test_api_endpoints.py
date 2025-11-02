"""
Additional comprehensive API endpoint tests
"""

import io
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("OPENAI_API_KEY", "test")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models
from backend.main import app, get_db, verify_jwt


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Create test client with isolated database"""
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    def mock_auth():
        return {"sub": "test_user"}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[verify_jwt] = mock_auth

    # Mock S3 operations
    uploads = {}

    class DummyS3:
        def upload_fileobj(self, fileobj, bucket, key, ExtraArgs=None):
            uploads[key] = fileobj.read()

    monkeypatch.setattr("backend.main.s3_client", DummyS3())
    monkeypatch.setattr("backend.main.S3_BUCKET", "test-bucket")

    client = TestClient(app)
    yield client, uploads
    app.dependency_overrides.clear()


class TestUserSettings:
    """Test user settings endpoints"""

    def test_get_empty_settings(self, client):
        """Test getting settings for new user"""
        c, _ = client
        response = c.get("/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == ""
        assert data["imageUrl"] == ""
        assert "nickname" in data
        assert "email" in data

    def test_update_all_settings(self, client):
        """Test updating all user settings"""
        c, _ = client
        settings_data = {
            "name": "John Doe",
            "nickname": "johnny",
            "email": "john@example.com",
            "imageUrl": "https://example.com/pic.jpg",
        }

        response = c.post("/api/settings", json=settings_data)
        assert response.status_code == 200
        assert response.json() == {"ok": True}

        # Verify settings were saved
        response = c.get("/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "John Doe"
        assert data["nickname"] == "johnny"
        assert data["email"] == "john@example.com"
        assert data["imageUrl"] == "https://example.com/pic.jpg"

    def test_partial_settings_update(self, client):
        """Test updating only some settings"""
        c, _ = client

        # Set initial settings
        c.post("/api/settings", json={"name": "Initial Name", "email": "initial@test.com"})

        # Update only name
        response = c.post("/api/settings", json={"name": "Updated Name"})
        assert response.status_code == 200

        # Verify only name was updated
        response = c.get("/api/settings")
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["email"] == "initial@test.com"


class TestFileUpload:
    """Test file upload endpoints"""

    def test_upload_profile_picture_png(self, client):
        """Test uploading PNG profile picture"""
        c, uploads = client
        file_data = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"

        response = c.post(
            "/api/upload-profile-picture",
            files={"file": ("test.png", io.BytesIO(file_data), "image/png")},
        )

        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "test-bucket.s3.amazonaws.com" in data["url"]
        assert "profile_pics/test_user/" in data["url"]

        # Verify file was "uploaded"
        assert len(uploads) == 1

    def test_upload_profile_picture_jpg(self, client):
        """Test uploading JPG profile picture"""
        c, uploads = client
        file_data = b"\xff\xd8\xff\xe0\x00\x10JFIF"

        response = c.post(
            "/api/upload-profile-picture",
            files={"file": ("test.jpg", io.BytesIO(file_data), "image/jpeg")},
        )

        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert data["url"].endswith(".jpg")

    def test_upload_without_file(self, client):
        """Test upload endpoint without file"""
        c, _ = client
        response = c.post("/api/upload-profile-picture")
        assert response.status_code == 422  # Validation error


class TestNuggetAPI:
    """Test nugget generation endpoints"""

    def test_nugget_persistence(self, client, monkeypatch):
        """Test that nuggets persist between requests"""
        c, _ = client
        monkeypatch.setattr("backend.main.generate_nugget", lambda: "persistent nugget")

        # First request generates nugget
        response = c.get("/api/nugget")
        assert response.status_code == 200
        assert response.json() == {"text": "persistent nugget"}

        # Second request returns same nugget (not regenerated)
        monkeypatch.setattr("backend.main.generate_nugget", lambda: "different nugget")
        response = c.get("/api/nugget")
        assert response.status_code == 200
        assert response.json() == {"text": "persistent nugget"}

    def test_nugget_regeneration_changes_content(self, client, monkeypatch):
        """Test that regeneration actually changes the nugget"""
        c, _ = client

        # Set initial nugget
        monkeypatch.setattr("backend.main.generate_nugget", lambda: "first nugget")
        c.get("/api/nugget")

        # Regenerate with different content
        monkeypatch.setattr("backend.main.generate_nugget", lambda: "second nugget")
        response = c.post("/api/nugget/regenerate")
        assert response.status_code == 200
        assert response.json() == {"text": "second nugget"}

        # Verify new nugget persists
        response = c.get("/api/nugget")
        assert response.json() == {"text": "second nugget"}


class TestErrorHandling:
    """Test error handling and edge cases"""

    def test_invalid_json_settings(self, client):
        """Test posting invalid JSON to settings"""
        c, _ = client
        response = c.post(
            "/api/settings",
            data="invalid json",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 422

    def test_oversized_file_upload(self, client):
        """Test uploading very large file"""
        c, _ = client
        large_data = b"x" * (10 * 1024 * 1024)  # 10MB

        response = c.post(
            "/api/upload-profile-picture",
            files={"file": ("large.png", io.BytesIO(large_data), "image/png")},
        )
        # Should either succeed or fail gracefully
        assert response.status_code in [200, 413, 422]


class TestDatabaseIntegrity:
    """Test database operations and data integrity"""

    def test_multiple_users_isolated(self, client, tmp_path, monkeypatch):
        """Test that different users have isolated settings"""
        # This test would require multiple JWT tokens, simplified for now
        c, _ = client

        # Set settings for first user
        c.post("/api/settings", json={"name": "User One"})

        # Mock different user
        def mock_different_user():
            return {"sub": "different_user"}

        app.dependency_overrides[verify_jwt] = mock_different_user

        # Check that new user has empty settings
        response = c.get("/api/settings")
        data = response.json()
        assert data["name"] == ""  # New user should have empty settings
