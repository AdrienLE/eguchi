import importlib.util
import json
from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location("publish_update", ROOT / "scripts/publish_update.py")
update = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(update)
EAS = json.loads((ROOT / "frontend/eas.json").read_text())


def test_publisher_uses_committed_profile_not_shell_or_dotenv():
    channel, env = update.update_environment(
        EAS,
        "production",
        {
            "PATH": "/bin",
            "EXPO_PUBLIC_API_URL": "http://localhost:8000",
            "EXPO_PUBLIC_AUTH0_CLIENT_ID": "wrong",
            "EAS_BUILD_PROFILE": "staging",
        },
    )
    assert channel == "production"
    assert env["EAS_BUILD_PROFILE"] == "production"
    assert "EXPO_PUBLIC_API_URL" not in env
    for key, value in EAS["build"]["production"]["env"].items():
        assert env[key] == value
    assert env["EXPO_NO_DOTENV"] == "1"
    assert env["NODE_ENV"] == "production"
    assert env["PATH"] == "/bin"


def test_inherited_profile_and_channel_match_native_build():
    channel, env = update.update_environment(EAS, "production-simulator", {})
    assert channel == "production"
    assert (
        env["EXPO_PUBLIC_API_URL_PRODUCTION"]
        == EAS["build"]["production"]["env"]["EXPO_PUBLIC_API_URL_PRODUCTION"]
    )


def test_development_client_and_auth_override_cannot_be_published():
    with pytest.raises(update.BuildError, match="release profile"):
        update.update_environment(EAS, "development", {})
    with pytest.raises(update.BuildError, match="AUTH_OVERRIDE"):
        update.update_environment(EAS, "production", {"EXPO_PUBLIC_AUTH_OVERRIDE_TOKEN": "test"})


def test_update_command_uses_selected_channel_and_literal_message(tmp_path):
    command = update.update_command("production", "ios", "fix: parent's timer $(literal)", tmp_path)
    assert command[command.index("--message") + 1] == "fix: parent's timer $(literal)"
    assert command[command.index("--channel") + 1] == "production"
    assert command[command.index("--platform") + 1] == "ios"
    assert "--non-interactive" in command
    assert "--skip-bundler" not in command
    assert "--environment" not in command  # SDK 53 uses the local build profile env.


def test_check_exports_and_resolves_runtime_without_publishing(monkeypatch):
    calls = []
    monkeypatch.setattr(update.subprocess, "run", lambda command, **kwargs: calls.append(command))
    monkeypatch.setattr(
        update.subprocess, "check_output", lambda command, **kwargs: '{"runtimeVersion":"abc"}'
    )
    update.main(["--check"])
    assert len(calls) == 1
    assert "export" in calls[0]
    assert "eas" not in calls[0]
    assert "--output-dir" in calls[0]


def test_dirty_tree_cannot_publish(monkeypatch):
    monkeypatch.setattr(
        update.subprocess, "check_output", lambda *args, **kwargs: " M frontend/app.json"
    )
    monkeypatch.setattr(
        update.subprocess, "run", lambda *args, **kwargs: pytest.fail("Must not publish")
    )
    with pytest.raises(update.BuildError, match="Commit your tested changes"):
        update.main([])


def test_publish_bundles_clean_commit_with_production_environment(monkeypatch):
    outputs = iter(["", "abc123 feat: new animals"])
    monkeypatch.setattr(update.subprocess, "check_output", lambda *args, **kwargs: next(outputs))
    monkeypatch.setattr(update.shutil, "which", lambda name: "/bin/eas")
    calls = []
    monkeypatch.setattr(
        update.subprocess, "run", lambda command, **kwargs: calls.append((command, kwargs))
    )
    update.main([])
    command, options = calls[0]
    assert command[:2] == ["eas", "update"]
    assert command[command.index("--message") + 1] == "abc123 feat: new animals"
    assert options["env"]["EAS_BUILD_PROFILE"] == "production"
    assert options["check"] is True
