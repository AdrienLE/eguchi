from argparse import Namespace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import plistlib
import subprocess
import threading
from urllib.parse import parse_qs, urlparse
import zipfile

import pytest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("diawi_upload", ROOT / "scripts/diawi_upload.py")
diawi = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(diawi)


@pytest.fixture
def project(tmp_path, monkeypatch):
    app = tmp_path / "frontend"
    (app / "builds").mkdir(parents=True)
    (app / "ios-fast-build.json").write_text(
        json.dumps({"appTarget": "Example", "targets": {"Example": "com.example.app"}})
    )
    monkeypatch.setattr(diawi, "ROOT", tmp_path)
    monkeypatch.setattr(diawi, "APP_DIR", app)
    monkeypatch.setenv("DIAWI_TOKEN", "test-secret")
    return app


def make_ipa(path, identifier="com.example.app", missing=None):
    files = {
        "Info.plist": plistlib.dumps({"CFBundleIdentifier": identifier}),
        "main.jsbundle": b"current JavaScript",
        "embedded.mobileprovision": b"test provisioning file",
        "_CodeSignature/CodeResources": b"test signature resources",
    }
    with zipfile.ZipFile(path, "w") as ipa:
        for name, contents in files.items():
            if name != missing:
                ipa.writestr("Payload/Example.app/" + name, contents)


def options(**kwargs):
    return Namespace(skip_build=False, file=None, eas_build=False, **kwargs)


@pytest.mark.parametrize("fallback", [False, True])
@pytest.mark.parametrize("failure", ["exit", "no_output"])
def test_failed_or_noop_build_cannot_upload_old_ipa(project, monkeypatch, fallback, failure):
    old = project / "builds/eguchi-ios-fast.ipa"
    make_ipa(old)
    previous = old.read_bytes()
    calls = []

    def run(command, **kwargs):
        calls.append(command)
        assert "DIAWI_TOKEN" not in kwargs["env"]
        assert Path(command[command.index("--output") + 1]) != old
        return subprocess.CompletedProcess(command, 23 if failure == "exit" else 0)

    monkeypatch.setattr(diawi.subprocess, "run", run)
    monkeypatch.setattr(diawi, "upload", lambda *_: pytest.fail("must not upload"))
    with pytest.raises(diawi.UploadError, match="failed|No IPA"):
        diawi.main(["--eas-build"] if fallback else [])
    assert old.read_bytes() == previous
    assert len(calls) == 1
    assert ("--eas-build" in calls[0]) == fallback


def test_successful_build_publishes_exact_new_ipa_and_forwards_options(
    project, tmp_path, monkeypatch
):
    stage = tmp_path / "stage"
    stage.mkdir()
    commands = []

    def run(command, **_):
        commands.append(command)
        make_ipa(Path(command[command.index("--output") + 1]))
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(diawi.subprocess, "run", run)
    artifact = diawi.prepare_artifact(options(), ["--build-number", "7"], stage)
    assert artifact.read_bytes() == (project / "builds/eguchi-ios-fast.ipa").read_bytes()
    assert commands[0][-2:] == ["--build-number", "7"]


def test_existing_ipa_upload_uses_snapshot_without_building(project, tmp_path, monkeypatch):
    source = project / "builds/eguchi-ios-fast.ipa"
    make_ipa(source)
    stage = tmp_path / "stage"
    stage.mkdir()
    monkeypatch.setattr(diawi.subprocess, "run", lambda *_a, **_k: pytest.fail("must not build"))
    args = options()
    args.skip_build = True
    artifact = diawi.prepare_artifact(args, [], stage)
    snapshot = artifact.read_bytes()
    source.write_bytes(b"another build replaced the original")
    assert artifact.read_bytes() == snapshot


@pytest.mark.parametrize(
    "flag", ["--check", "--archive-only", "--prepare-only", "--output=old.ipa"]
)
def test_non_build_flags_rejected_before_build(project, tmp_path, monkeypatch, flag):
    monkeypatch.setattr(diawi.subprocess, "run", lambda *_a, **_k: pytest.fail("must not build"))
    with pytest.raises(diawi.UploadError, match="fresh signed IPA"):
        diawi.prepare_artifact(options(), [flag], tmp_path)


@pytest.mark.parametrize(
    "missing", ["main.jsbundle", "embedded.mobileprovision", "_CodeSignature/CodeResources"]
)
def test_rejects_incomplete_ipa(project, missing):
    path = project / "builds/test.ipa"
    make_ipa(path, missing=missing)
    with pytest.raises(diawi.UploadError, match="Invalid IPA"):
        diawi.validate_ipa(path)


def test_rejects_wrong_application(project):
    path = project / "builds/test.ipa"
    make_ipa(path, identifier="some.other.app")
    with pytest.raises(diawi.UploadError, match="not the configured app"):
        diawi.validate_ipa(path)


def test_token_precedence_and_missing_token_before_build(project, monkeypatch):
    default = project / ".signing/diawi-token"
    default.parent.mkdir()
    default.write_text("file-secret\n")
    assert diawi.load_token() == "test-secret"
    assert diawi.load_token(default) == "file-secret"
    monkeypatch.delenv("DIAWI_TOKEN")
    assert diawi.load_token() == "file-secret"
    default.unlink()
    monkeypatch.setattr(diawi, "prepare_artifact", lambda *_: pytest.fail("must not build"))
    with pytest.raises(diawi.UploadError, match="Set DIAWI_TOKEN"):
        diawi.main([])


def test_token_never_in_curl_arguments_environment_or_error_message(monkeypatch):
    monkeypatch.setenv("DIAWI_TOKEN", "test-secret")

    def run(command, **kwargs):
        assert "test-secret" not in repr(command)
        assert "DIAWI_TOKEN" not in kwargs["env"]
        assert 'form-string = "token=test-secret"' in kwargs["input"]
        assert command == ["curl", "--disable", "--config", "-"]
        return subprocess.CompletedProcess(command, 0, "denied test-secret\n401", "")

    monkeypatch.setattr(diawi.subprocess, "run", run)
    with pytest.raises(diawi.UploadError, match="HTTP 401") as error:
        diawi.request(diawi.UPLOAD_URL, [("form-string", "token=test-secret")], "test-secret")
    assert "test-secret" not in str(error.value)


@pytest.mark.parametrize(
    "body", ["File size too large\n400", '{"message":"File size too large"}\n413']
)
def test_size_rejection_is_actionable_without_retries(monkeypatch, body):
    calls = []

    def run(command, **_):
        calls.append(command)
        return subprocess.CompletedProcess(command, 0, body, "")

    monkeypatch.setattr(diawi.subprocess, "run", run)
    with pytest.raises(diawi.UploadError, match="File size too large"):
        diawi.request(diawi.UPLOAD_URL, [], "test-secret")
    assert len(calls) == 1


def test_polling_success_error_and_timeout(project, monkeypatch):
    ipa = project / "builds/app.ipa"
    make_ipa(ipa)
    responses = [
        {"job": "job-1"},
        {"status": 2001},
        {"status": 2000, "link": "https://i.diawi.com/test"},
    ]
    calls = []

    def request(url, settings, *_, **__):
        calls.append((url, settings))
        return responses.pop(0)

    monkeypatch.setattr(diawi, "request", request)
    monkeypatch.setattr(diawi.time, "sleep", lambda *_: None)
    assert diawi.upload(ipa, "test-secret") == {"job": "job-1", "link": "https://i.diawi.com/test"}
    assert [url for url, _ in calls] == [diawi.UPLOAD_URL, diawi.STATUS_URL, diawi.STATUS_URL]
    assert ("form-string", "wall_of_apps=0") in calls[0][1]
    assert ("form-string", "find_by_udid=0") in calls[0][1]
    responses[:] = [
        {"job": "job-1"},
        {"status": 4000, "message": "bad signing", "link": "https://i.diawi.com/stale"},
    ]
    with pytest.raises(diawi.UploadError, match="bad signing"):
        diawi.upload(ipa, "test-secret")
    responses[:] = [{"job": "job-1"}]
    times = iter([0, 2])
    monkeypatch.setattr(diawi.time, "monotonic", lambda: next(times))
    with pytest.raises(diawi.UploadError, match="Timed out"):
        diawi.upload(ipa, "test-secret", timeout=1)


def test_upload_failure_keeps_new_ipa_and_previous_success_record(project, monkeypatch):
    success = project / "builds/diawi-last-success.json"
    success.write_text('{"link":"https://i.diawi.com/previous"}')

    def build(command, **_):
        make_ipa(Path(command[command.index("--output") + 1]))
        return subprocess.CompletedProcess(command, 0)

    def fail(*_):
        raise diawi.UploadError("File size too large")

    monkeypatch.setattr(diawi.subprocess, "run", build)
    monkeypatch.setattr(diawi, "upload", fail)
    with pytest.raises(diawi.UploadError, match="too large"):
        diawi.main([])
    diawi.validate_ipa(project / "builds/eguchi-ios-fast.ipa")
    assert json.loads(success.read_text())["link"] == "https://i.diawi.com/previous"


def test_success_records_digest_and_link(project, monkeypatch, capsys):
    artifact = project / "builds/eguchi-ios-fast.ipa"
    make_ipa(artifact)
    monkeypatch.setattr(
        diawi, "upload", lambda *_: {"link": "https://i.diawi.com/test", "job": "job-1"}
    )
    diawi.main(["--skip-build", "--no-qr"])
    result = json.loads((project / "builds/diawi-last-success.json").read_text())
    assert result["ipa_sha256"] == diawi.hashlib.sha256(artifact.read_bytes()).hexdigest()
    assert result["link"] in capsys.readouterr().out


def test_real_curl_multipart_and_get_config(project, monkeypatch):
    """Exercise curl's actual config/multipart quoting against a local server."""
    received = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            received.append((self.path, self.rfile.read(int(self.headers["Content-Length"]))))
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"job":"test-job"}')

        def do_GET(self):
            received.append((self.path, b""))
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":2000,"link":"https://i.diawi.com/test"}')

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    monkeypatch.setattr(diawi, "UPLOAD_URL", f"http://127.0.0.1:{server.server_port}/")
    monkeypatch.setattr(diawi, "STATUS_URL", f"http://127.0.0.1:{server.server_port}/status")
    artifact = project / 'builds/app ; "quoted".ipa'
    make_ipa(artifact)
    try:
        result = diawi.upload(artifact, "test+secret")
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
    assert result["link"] == "https://i.diawi.com/test"
    assert len(received) == 2
    assert b"test+secret" in received[0][1]
    assert artifact.read_bytes() in received[0][1]
    parsed = urlparse(received[1][0])
    assert parsed.path == "/status"
    assert parse_qs(parsed.query) == {"token": ["test+secret"], "job": ["test-job"]}


def test_encoded_token_redaction_handles_curl_escape_case():
    assert diawi.redact("denied test%2bsecret and test+secret", "test+secret") == (
        "denied [redacted] and [redacted]"
    )
