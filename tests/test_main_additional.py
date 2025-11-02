"""
Additional tests for main.py to improve coverage
"""

import pytest
from unittest.mock import patch, Mock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models
from backend.main import app, get_db, verify_jwt, generate_nugget


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


class TestNuggetGeneration:
    """Test nugget generation functionality"""

    @patch("backend.main.client")
    def test_generate_nugget_success(self, mock_openai_client):
        """Test successful nugget generation"""
        mock_completion = Mock()
        mock_completion.choices = [Mock()]
        mock_completion.choices[0].message.content = "Test nugget content"
        mock_openai_client.chat.completions.create.return_value = mock_completion

        result = generate_nugget()
        assert result == "Test nugget content"

    @patch("backend.main.client")
    def test_generate_nugget_openai_error(self, mock_openai_client):
        """Test nugget generation with OpenAI error"""
        mock_openai_client.chat.completions.create.side_effect = Exception("OpenAI Error")

        # The current implementation doesn't handle exceptions, so it will raise
        with pytest.raises(Exception):
            generate_nugget()

    @patch("backend.main.client")
    def test_generate_nugget_empty_response(self, mock_openai_client):
        """Test nugget generation with empty response"""
        mock_completion = Mock()
        mock_completion.choices = [Mock()]
        mock_completion.choices[0].message.content = ""
        mock_openai_client.chat.completions.create.return_value = mock_completion

        result = generate_nugget()
        assert result == ""


class TestErrorHandling:
    """Test error handling scenarios"""

    @patch("backend.main.s3_client")
    def test_upload_s3_error(self, mock_s3, client):
        """Test S3 upload error handling"""
        c, _ = client
        mock_s3.upload_fileobj.side_effect = Exception("S3 Error")

        response = c.post(
            "/api/upload-profile-picture",
            files={"file": ("test.png", b"fake png data", "image/png")},
        )

        assert response.status_code == 500
        assert "Upload failed" in response.json()["detail"]

    def test_upload_without_s3_config(self, client, monkeypatch):
        """Test upload fails when S3 is not configured"""
        # Remove S3 configuration
        monkeypatch.setattr("backend.main.S3_BUCKET", None)
        monkeypatch.setattr("backend.main.s3_client", None)
        c, _ = client
        response = c.post(
            "/api/upload-profile-picture",
            files={"file": ("test.png", b"data", "image/png")},
        )
        assert response.status_code == 500
        assert response.json().get("detail") == "S3 bucket not configured"


class TestHealthCheck:
    """Test health check functionality"""

    def test_health_check_endpoint_exists(self, client):
        """Test that the app starts successfully"""
        c, _ = client
        # Just test that we can make a request to settings
        # which proves the app is healthy
        response = c.get("/api/settings")
        assert response.status_code == 200


import os
from backend.main import frontend_path


class TestHealthAndSPA:
    """Test health check and SPA static file serving"""

    def test_health_endpoint(self, client):
        c, _ = client
        resp = c.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "healthy"
        assert data.get("service") == "base-app-api"
        assert data.get("database") == "connected"
        assert "openai" in data and "s3" in data

    def test_spa_index_and_fallback(self, client):
        c, _ = client
        # Root serves index.html
        r_index = c.get("/")
        assert r_index.status_code == 200
        assert "text/html" in r_index.headers.get("content-type", "")
        # Unknown path falls back to same index content
        r_fallback = c.get("/nonexistent-path")
        assert r_fallback.status_code == 200
        assert r_fallback.content == r_index.content

    def test_serve_specific_html_file(self, client):
        c, _ = client
        # Path matching an existing HTML file
        r = c.get("/index")
        assert r.status_code == 200
        # Load actual index.html file
        index_file = os.path.join(frontend_path, "index.html")
        with open(index_file, "rb") as f:
            expected = f.read()
        assert r.content == expected

    def test_static_file_not_found(self, client):
        c, _ = client
        # Assets missing file returns 404
        r = c.get("/assets/nonexistent-file.txt")
        assert r.status_code == 404
        body = r.json()
        assert "detail" in body

    def test_expo_static_file(self, client):
        c, _ = client
        # Serve an existing Expo static JS file
        js_dir = os.path.join(frontend_path, "_expo", "static", "js", "web")
        files = os.listdir(js_dir)
        assert files, "No Expo static JS files found"
        js_file = files[0]
        path = f"/_expo/static/js/web/{js_file}"
        r = c.get(path)
        assert r.status_code == 200

    def test_expo_static_file_not_found(self, client):
        c, _ = client
        # Missing Expo static file returns 404
        r = c.get("/_expo/static/js/web/nonexistent-file.js")
        assert r.status_code == 404
        # Starlette returns its default 404 JSON for mounted static
        body = r.json()
        assert "detail" in body

    def test_api_paths_not_caught_by_spa(self, client):
        c, _ = client
        r = c.get("/api/unknown")
        assert r.status_code == 404
        # Should be JSON 404, not HTML fallback
        assert r.headers.get("content-type", "").startswith("application/json")


class TestSettingsMerging:
    def test_user_overrides_preserved(self, client, monkeypatch):
        from backend import models
        from backend.main import get_db

        c, _ = client
        # Set a user-provided name
        resp = c.post("/api/settings", json={"name": "User Name"})
        assert resp.status_code == 200

        # Mock userinfo to a different name
        import backend.main as main_module
        import requests

        class MockResp:
            status_code = 200

            def json(self):
                return {
                    "name": "Auth0 Name",
                    "nickname": "nick",
                    "email": "e@x.com",
                    "picture": "p",
                }

        monkeypatch.setattr(main_module, "AUTH0_DOMAIN", "example.auth0.com")
        monkeypatch.setattr(requests, "get", lambda *a, **k: MockResp())

        # Now GET should keep user-provided name
        r2 = c.get("/api/settings")
        assert r2.status_code == 200
        data = r2.json()
        assert data["name"] == "User Name"

    def test_jwt_precedence_over_userinfo(self, client, monkeypatch):
        # If JWT has fields, we shouldn't need userinfo
        import backend.auth as auth_module
        import requests

        calls = {"userinfo": 0}

        def fake_get(*args, **kwargs):
            calls["userinfo"] += 1

            class R:
                status_code = 200

                def json(self):
                    return {"name": "UI Name"}

            return R()

        monkeypatch.setattr(requests, "get", fake_get)

        jwt_user = {
            "sub": "test_user",
            "name": "JWT Name",
            "nickname": "n",
            "email": "e",
            "picture": "p",
        }
        auth_module.jwt.decode = lambda *a, **k: jwt_user

        c, _ = client
        r = c.get("/api/settings")
        assert r.status_code == 200
        assert calls["userinfo"] == 0

    def test_row_created_on_first_get(self, client):
        # A first GET should succeed and return the expected shape (implies row exists)
        c, _ = client
        r = c.get("/api/settings")
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) == {"name", "nickname", "email", "imageUrl"}
