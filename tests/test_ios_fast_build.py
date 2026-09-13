from datetime import datetime, timedelta
import importlib.util
import json
import os
from pathlib import Path
import plistlib
import subprocess
from contextlib import contextmanager

import pytest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("ios_fast_build", ROOT / "scripts/ios_fast_build.py")
build = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build)
CONFIG = json.loads((ROOT / "frontend/ios-fast-build.json").read_text())


def profile(bundle_id="com.eguchi.app"):
    return {
        "UUID": "test-profile",
        "TeamIdentifier": ["TEAM"],
        "ExpirationDate": datetime.now() + timedelta(days=1),
        "ProvisionedDevices": ["test-device"],
        "Entitlements": {
            "application-identifier": f"TEAM.{bundle_id}",
            "get-task-allow": False,
            "com.apple.security.application-groups": ["group.com.eguchi.app"],
        },
    }


def test_profile_inheritance_and_explicit_api_override():
    eas = {
        "build": {
            "base": {"distribution": "internal", "env": {"EXPO_PUBLIC_ENVIRONMENT": "staging"}},
            "preview": {"extends": "base", "env": {"EXPO_PUBLIC_API_URL_STAGING": "https://old"}},
        }
    }
    selected = build.load_profile(eas, "preview")
    env = build.build_environment(selected, {"PATH": "/bin", "SKIP_BUNDLING": "1"}, "https://new")
    assert selected["distribution"] == "internal"
    assert env["EXPO_PUBLIC_API_URL_STAGING"] == "https://new"
    assert env["EXPO_PUBLIC_API_URL"] == "https://new"
    assert env["FORCE_BUNDLING"] == "1"
    assert env["EXPO_NO_DOTENV"] == "1"
    assert "SKIP_BUNDLING" not in env


def test_profile_inheritance_errors():
    with pytest.raises(build.BuildError, match="Unknown"):
        build.load_profile({"build": {}}, "missing")
    with pytest.raises(build.BuildError, match="Circular"):
        build.load_profile({"build": {"a": {"extends": "b"}, "b": {"extends": "a"}}}, "a")


def test_selected_profile_drives_update_channel_and_invalidates_prebuild(tmp_path):
    (tmp_path / "package.json").write_text("{}")
    production = build.build_environment({}, {}, profile_name="production")
    staging = build.build_environment(
        {}, {"EAS_BUILD_PROFILE": "production"}, profile_name="staging"
    )
    assert staging["EAS_BUILD_PROFILE"] == "staging"
    assert build.prebuild_fingerprint(tmp_path, {}, production) != build.prebuild_fingerprint(
        tmp_path, {}, staging
    )


def test_release_rejects_dev_auth_and_unsafe_profile_environment():
    with pytest.raises(build.BuildError, match="AUTH_OVERRIDE"):
        build.build_environment({}, {"EXPO_PUBLIC_AUTH_OVERRIDE_TOKEN": "test-token"})
    with pytest.raises(build.BuildError, match="only public"):
        build.build_environment({"env": {"PATH": "/other/bin"}}, {})


def test_flat_credentials_support_the_single_eguchi_target():
    item = {"provisioningProfilePath": "main.mobileprovision"}
    assert build.credential_targets({"ios": item}, CONFIG) == {"EguchiEarTrainer": item}


MULTI_CONFIG = {
    **CONFIG,
    "targets": {**CONFIG["targets"], "ExampleWidgetExtension": "com.example.app.Widget"},
}


def test_requires_credentials_for_each_configured_target():
    with pytest.raises(build.BuildError, match="ExampleWidgetExtension"):
        build.credential_targets(
            {"ios": {"provisioningProfilePath": "main.mobileprovision"}}, MULTI_CONFIG
        )
    credentials = {
        name: {"provisioningProfilePath": f"{name}.mobileprovision"} for name in CONFIG["targets"]
    }
    assert build.credential_targets({"ios": credentials}, CONFIG) == credentials


@pytest.mark.parametrize(
    "invalid", ["expired", "wrong_bundle", "development", "app_store", "group"]
)
def test_invalid_signing_profile_is_rejected(invalid):
    data = profile()
    if invalid == "expired":
        data["ExpirationDate"] = datetime.now() - timedelta(days=1)
    elif invalid == "wrong_bundle":
        data["Entitlements"]["application-identifier"] = "TEAM.some.other.app"
    elif invalid == "development":
        data["Entitlements"]["get-task-allow"] = True
    elif invalid == "app_store":
        data.pop("ProvisionedDevices")
    else:
        data["Entitlements"]["com.apple.security.application-groups"] = []
    with pytest.raises(build.BuildError):
        build.validate_profile(
            data,
            "com.eguchi.app",
            {"com.apple.security.application-groups": ["group.com.eguchi.app"]},
        )


@pytest.mark.parametrize("allowed", ["*", ["*"], ["applinks:example.com"]])
def test_profile_accepts_associated_domains_permission_formats(allowed):
    data = profile()
    data["Entitlements"]["com.apple.developer.associated-domains"] = allowed
    build.validate_profile(
        data,
        "com.eguchi.app",
        {"com.apple.developer.associated-domains": ["applinks:example.com"]},
    )


@pytest.mark.parametrize("allowed", [None, False, ["applinks:other.example"]])
def test_profile_rejects_missing_or_incompatible_associated_domains(allowed):
    data = profile()
    data["Entitlements"]["com.apple.developer.associated-domains"] = allowed
    with pytest.raises(build.BuildError, match="associated-domains"):
        build.validate_profile(
            data,
            "com.eguchi.app",
            {"com.apple.developer.associated-domains": ["applinks:example.com"]},
        )


def test_signed_app_still_requires_concrete_associated_domains():
    with pytest.raises(build.BuildError, match="associated-domains"):
        build.verify_signed_entitlements(
            {"com.apple.developer.associated-domains": "*"},
            {"com.apple.developer.associated-domains": ["applinks:example.com"]},
        )


def test_export_maps_profiles_by_bundle_id():
    credentials = {
        name: {"profile": {**profile(identifier), "UUID": name}}
        for name, identifier in CONFIG["targets"].items()
    }
    options = build.export_options(credentials, CONFIG, "certificate-hash")
    assert options["provisioningProfiles"] == {
        "com.eguchi.app": "EguchiEarTrainer",
    }
    assert options["method"] == "release-testing"
    assert options["manageAppVersionAndBuildNumber"] is False


def test_archive_retains_cache_and_builds_all_scheme_targets(tmp_path):
    command = build.archive_command(tmp_path, tmp_path / "cache", CONFIG, build_number="123")
    assert "install" in command and "archive" not in command and "clean" not in command
    assert command[command.index("-scheme") + 1] == "EguchiEarTrainer"
    assert command[command.index("-derivedDataPath") + 1] == str(tmp_path / "cache/DerivedData")
    assert "CURRENT_PROJECT_VERSION=123" in command
    assert "generic/platform=iOS" in command
    assert command[command.index("-jobs") + 1] == "4"
    paths = build.native_paths(tmp_path / "cache", CONFIG)
    assert f"DSTROOT={paths['installed']}" in command
    assert f"OBJROOT={paths['objects']}" in command


def test_archive_packaging_preserves_build_cache(tmp_path, monkeypatch):
    paths = build.native_paths(tmp_path, CONFIG)
    app = paths["installed"] / "Applications/EguchiEarTrainer.app"
    app.mkdir(parents=True)
    (app / "Info.plist").write_bytes(
        plistlib.dumps(
            {
                "CFBundleIdentifier": "com.eguchi.app",
                "CFBundleExecutable": "EguchiEarTrainer",
                "CFBundleShortVersionString": "1.0",
                "CFBundleVersion": "123",
            }
        )
    )
    (app / "main.jsbundle").write_bytes(b"current JavaScript")
    objects = paths["objects"] / "cached.o"
    objects.parent.mkdir(parents=True)
    objects.write_bytes(b"compiled dependency")
    monkeypatch.setattr(build, "verify_bundles", lambda *_: app)

    def copy(command, **_):
        if command[0] == "lipo":
            return "arm64\n"
        if command[0] == "codesign":
            return "Authority=Apple Distribution: Test\n"
        build.shutil.copytree(command[1], command[2], dirs_exist_ok=True)

    monkeypatch.setattr(build, "run", copy)
    for credentials in (None, {"EguchiEarTrainer": {"profile": {"TeamIdentifier": ["TEAM"]}}}):
        archive = build.assemble_archive(tmp_path, CONFIG, credentials)
        assert (
            archive / "Products/Applications/EguchiEarTrainer.app/main.jsbundle"
        ).read_bytes() == b"current JavaScript"
        assert objects.read_bytes() == b"compiled dependency"
        assert app.is_dir()
        info = build.read_plist(archive / "Info.plist")
        assert (
            info["ApplicationProperties"]["ApplicationPath"] == "Applications/EguchiEarTrainer.app"
        )
        assert info["ApplicationProperties"]["CFBundleVersion"] == "123"
        assert info["ApplicationProperties"]["Architectures"] == ["arm64"]
        if credentials:
            assert info["ApplicationProperties"]["SigningIdentity"] == "Apple Distribution: Test"
            assert info["ApplicationProperties"]["Team"] == "TEAM"


def test_signed_archive_selects_each_targets_own_profile(tmp_path):
    credentials = {
        name: {"profile": {**profile(identifier), "UUID": f"profile-{name}"}}
        for name, identifier in CONFIG["targets"].items()
    }
    command = build.archive_command(
        tmp_path,
        tmp_path / "cache",
        CONFIG,
        signing=(credentials, "certificate-hash", tmp_path / "build.keychain-db"),
    )
    assert "PROVISIONING_PROFILE_SPECIFIER=$(FAST_PROFILE_$(TARGET_NAME))" in command
    for name in CONFIG["targets"]:
        assert f"FAST_PROFILE_{name}=profile-{name}" in command
    assert "CODE_SIGN_IDENTITY=certificate-hash" in command
    assert "DEVELOPMENT_TEAM=TEAM" in command
    assert "CODE_SIGNING_ALLOWED=NO" not in command


def test_export_requires_app_group_in_actual_signature():
    required = {"com.apple.security.application-groups": ["group.com.eguchi.app"]}
    with pytest.raises(build.BuildError, match="application-groups"):
        build.verify_signed_entitlements({}, required)
    with pytest.raises(build.BuildError, match="debugging"):
        build.verify_signed_entitlements({**required, "get-task-allow": True}, required)
    build.verify_signed_entitlements(required, required)


def test_bundle_verification_detects_missing_js_and_optional_extensions(tmp_path):
    app = tmp_path / "EguchiEarTrainer.app"
    app.mkdir()
    (app / "Info.plist").write_bytes(
        plistlib.dumps({"CFBundleIdentifier": "com.eguchi.app", "CFBundleVersion": "123"})
    )
    with pytest.raises(build.BuildError, match="JavaScript"):
        build.verify_bundles(tmp_path, CONFIG)
    (app / "main.jsbundle").write_bytes(b"bundled-js")
    assert build.verify_bundles(tmp_path, CONFIG) == app
    with pytest.raises(build.BuildError, match="all extensions"):
        build.verify_bundles(tmp_path, MULTI_CONFIG)
    widget = app / "PlugIns/ExampleWidgetExtension.appex"
    widget.mkdir(parents=True)
    (widget / "Info.plist").write_bytes(
        plistlib.dumps({"CFBundleIdentifier": "com.example.app.Widget", "CFBundleVersion": "123"})
    )
    assert build.verify_bundles(tmp_path, MULTI_CONFIG) == app
    with pytest.raises(build.BuildError, match="all extensions"):
        build.verify_bundles(tmp_path, CONFIG)


def test_keychain_cleanup_preserves_concurrent_additions(tmp_path, monkeypatch):
    calls = []
    der = b"test-certificate"
    identity = build.hashlib.sha1(der).hexdigest().upper()
    keychain = str(tmp_path / "build.keychain-db")
    keychains = ["/login.keychain-db"]

    def fake_run(command, **kwargs):
        nonlocal keychains
        calls.append(command)
        if command[1] == "list-keychains":
            if "-s" in command:
                keychains = command[command.index("-s") + 1 :]
            return "\n".join(json.dumps(path) for path in keychains)
        if command[1] == "find-identity":
            return f'1) {identity} "Apple Distribution"'
        return ""

    monkeypatch.setattr(build, "run", fake_run)
    credentials = {
        "app": {
            "certificate": tmp_path / "cert.p12",
            "password": "secret",
            "profile": {"DeveloperCertificates": [der]},
        }
    }
    with pytest.raises(RuntimeError, match="export failure"):
        with build.signing_keychain(credentials, tmp_path) as selected:
            assert selected == identity
            keychains.append("/other-build.keychain-db")
            raise RuntimeError("export failure")
    assert keychains == ["/login.keychain-db", "/other-build.keychain-db"]
    assert ["security", "delete-keychain", keychain] in calls


@pytest.mark.parametrize(
    "version, directory",
    [
        ("15.4", "Library/MobileDevice/Provisioning Profiles"),
        ("26.5", "Library/Developer/Xcode/UserData/Provisioning Profiles"),
    ],
)
def test_profile_installation_matches_xcode_and_preserves_existing_files(
    tmp_path, monkeypatch, version, directory
):
    monkeypatch.setattr(build.Path, "home", classmethod(lambda cls: tmp_path))
    monkeypatch.setattr(build, "run", lambda *_: f"Xcode {version}\n")
    source = tmp_path / "download.mobileprovision"
    source.write_bytes(b"profile contents")
    credentials = {
        "EguchiEarTrainer": {"profile": {"UUID": "test-profile"}, "profile_path": source}
    }
    build.install_profiles(credentials)
    installed = tmp_path / directory / "test-profile.mobileprovision"
    assert installed.read_bytes() == b"profile contents"
    assert installed.stat().st_mode & 0o777 == 0o600
    source.write_bytes(b"different profile")
    with pytest.raises(build.BuildError, match="same UUID"):
        build.install_profiles(credentials)
    assert installed.read_bytes() == b"profile contents"


@pytest.fixture
def native_project(tmp_path):
    app = tmp_path / "frontend"
    app.mkdir()
    (app / "package.json").write_text(json.dumps({"dependencies": {"expo": "53.0.0"}}))
    (app / "app.json").write_text('{"expo": {"name": "Eguchi"}}')
    (app / "plugins").mkdir()
    (app / "plugins/native.js").write_text("native plugin")
    (app / "ios/EguchiEarTrainer.xcodeproj").mkdir(parents=True)
    cache = app / "builds/native-cache"
    cache.mkdir(parents=True)
    return app, cache


def test_prebuild_on_fresh_checkout_then_reuses_native_project(native_project, monkeypatch):
    app, cache = native_project
    project = app / "ios/EguchiEarTrainer.xcodeproj"
    project.rmdir()
    (app / "ios/local-work.txt").write_text("preserve this native work")
    calls = []

    def prebuild(command, **kwargs):
        calls.append(command)
        assert "--clean" not in command
        assert "--no-install" in command
        assert kwargs["cwd"] == app
        project.mkdir()

    monkeypatch.setattr(build, "run", prebuild)
    build.prepare_project(app, cache, CONFIG, {})
    assert (app / "ios/local-work.txt").read_text() == "preserve this native work"
    # On first prebuild the workspace only appears after pod install.
    (app / CONFIG["workspace"]).mkdir()
    build.prepare_project(app, cache, CONFIG, {})
    assert len(calls) == 1


def test_stale_update_settings_force_prebuild_and_never_get_cached(native_project, monkeypatch):
    app, cache = native_project
    (app / CONFIG["workspace"]).mkdir()
    (app / "app.json").write_text(
        json.dumps({"expo": {"updates": {"url": "https://u.expo.dev/test"}}})
    )
    (app / "eas.json").write_text(json.dumps({"build": {"production": {"channel": "production"}}}))
    path = app / CONFIG["updatesPlist"]
    path.parent.mkdir(parents=True)
    path.write_bytes(plistlib.dumps({"EXUpdatesEnabled": False}))
    stamp = cache / "prebuild-inputs.sha256"
    calls = []
    monkeypatch.setattr(build, "run", lambda command, **kwargs: calls.append(command))
    with pytest.raises(build.BuildError, match="update settings"):
        build.prepare_project(app, cache, CONFIG, {})
    assert len(calls) == 1
    assert not stamp.exists()

    valid = {
        "EXUpdatesEnabled": True,
        "EXUpdatesURL": "https://u.expo.dev/test",
        "EXUpdatesRequestHeaders": {"expo-channel-name": "production"},
    }
    path.write_bytes(plistlib.dumps(valid))
    build.prepare_project(app, cache, CONFIG, {})
    assert stamp.exists()
    # A stale plist must invalidate even an otherwise matching cache stamp.
    valid["EXUpdatesRequestHeaders"]["expo-channel-name"] = "staging"
    path.write_bytes(plistlib.dumps(valid))
    with pytest.raises(build.BuildError, match="update settings"):
        build.prepare_project(app, cache, CONFIG, {})
    assert len(calls) == 3


@pytest.mark.parametrize("change", ["js", "scripts", "dependency", "plugin", "app", "env", "force"])
def test_prebuild_invalidates_native_inputs_only(native_project, monkeypatch, change):
    app, cache = native_project
    (app / CONFIG["workspace"]).mkdir()
    calls = []
    monkeypatch.setattr(build, "run", lambda command, **_: calls.append(command))
    build.prepare_project(app, cache, CONFIG, {})
    env = {}
    if change == "js":
        (app / "index.ts").write_text("changed JavaScript")
    elif change in ("scripts", "dependency"):
        package = build.read_json(app / "package.json")
        if change == "scripts":
            package["scripts"] = {"new-command": "echo hello"}
        else:
            package["dependencies"]["expo"] = "53.0.1"
        (app / "package.json").write_text(json.dumps(package))
    elif change == "plugin":
        (app / "plugins/native.js").write_text("updated plugin")
    elif change == "app":
        (app / "app.json").write_text('{"expo": {"name": "New name"}}')
    elif change == "env":
        env["EXPO_PUBLIC_API_URL"] = "https://new.example.com"
    build.prepare_project(app, cache, CONFIG, env, force=change == "force")
    assert len(calls) == (1 if change in ("js", "scripts") else 2)


def test_pods_cache_reused_until_native_inputs_or_installation_change(native_project, monkeypatch):
    app, cache = native_project
    (app / "ios/Pods").mkdir()
    lock = app / "ios/Podfile.lock"
    manifest = app / "ios/Pods/Manifest.lock"
    calls = []

    def pod_install(command, **_):
        calls.append(command)
        lock.write_text("current lock")
        manifest.write_bytes(lock.read_bytes())

    monkeypatch.setattr(build, "run", pod_install)
    build.prepare_native(app, cache, {})
    build.prepare_native(app, cache, {})
    assert len(calls) == 1
    (app / "ios/Podfile").write_text("new native dependency")
    build.prepare_native(app, cache, {})
    assert len(calls) == 2
    manifest.unlink()
    build.prepare_native(app, cache, {})
    assert len(calls) == 3


@pytest.mark.parametrize("profile_name", ["development", "production-simulator", "app-store"])
def test_fast_builder_rejects_incompatible_eas_profiles(profile_name):
    with pytest.raises(build.BuildError, match="internal release"):
        build.main(["--profile", profile_name, "--check"])


def test_production_profile_uses_eguchi_production_configuration():
    profile = build.load_profile(build.read_json(ROOT / "frontend/eas.json"), "production")
    env = build.build_environment(profile, {})
    assert env["EXPO_PUBLIC_ENVIRONMENT"] == "production"
    assert env["EXPO_PUBLIC_API_URL_PRODUCTION"] == "https://eguchi-api-production.up.railway.app"
    assert CONFIG["targets"] == {"EguchiEarTrainer": "com.eguchi.app"}


@pytest.mark.parametrize(
    "args, expected, custom_api",
    [
        (["ios"], ["fast"], False),
        (["ios", "--archive-only"], ["fast", "--archive-only"], False),
        (
            ["ios", "https://custom.example", "--jobs", "2"],
            ["fast", "--api-url", "https://custom.example", "--jobs", "2"],
            False,
        ),
        (
            ["ios", "--eas-build"],
            ["eas", "build", "--platform", "ios", "--profile", "production", "--local"],
            False,
        ),
        (
            ["android", "https://custom.example"],
            ["eas", "build", "--platform", "android", "--profile", "production"],
            True,
        ),
    ],
)
def test_production_entrypoint_routes_arguments_from_any_directory(
    tmp_path, args, expected, custom_api
):
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    frontend = tmp_path / "frontend"
    frontend.mkdir()
    helper = scripts / "build-prod.sh"
    helper.write_text((ROOT / "scripts/build-prod.sh").read_text())
    fast = scripts / "build-ios-ipa-fast.sh"
    fast.write_text('#!/bin/bash\nprintf "%s\\n" fast "$@"\n')
    fast.chmod(0o755)
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    npx = bin_dir / "npx"
    npx.write_text(
        '#!/bin/bash\nprintf "%s\\n" "$@"\n'
        'test "$PWD" = "$EXPECTED_APP" || exit 13\n'
        'if [[ "$EXPECT_API" = yes ]]; then\n'
        '  test "$EXPO_PUBLIC_API_URL_PRODUCTION" = https://custom.example || exit 14\n'
        "fi\n"
    )
    npx.chmod(0o755)
    env = {
        **os.environ,
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
        "EXPECTED_APP": str(frontend),
        "EXPECT_API": "yes" if custom_api else "no",
    }
    result = subprocess.run(
        ["/bin/bash", str(helper), *args],
        cwd=tmp_path.parent,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == expected


@pytest.mark.parametrize("fail_at", ["compile", "export", "verify", None])
def test_only_successfully_built_and_verified_ipa_replaces_previous_output(
    native_project, monkeypatch, fail_at
):
    app, cache = native_project
    (app / CONFIG["workspace"]).mkdir()
    (app / "node_modules/react-native").mkdir(parents=True)
    (app / "ios-fast-build.json").write_text(json.dumps(CONFIG))
    (app / "eas.json").write_text('{"build": {"production": {"distribution": "internal"}}}')
    (app / "credentials.json").write_text("{}")
    output = app / "builds/eguchi-ios-fast.ipa"
    output.write_bytes(b"old verified IPA")
    monkeypatch.setattr(build, "APP_DIR", app)
    monkeypatch.setattr(build.shutil, "which", lambda name: name)
    monkeypatch.setattr(build, "prepare_project", lambda *_: None)
    monkeypatch.setattr(build, "prepare_native", lambda *_: None)
    credentials = {"EguchiEarTrainer": {"profile": profile()}}
    monkeypatch.setattr(build, "load_credentials", lambda *_: credentials)

    @contextmanager
    def signing(*_):
        yield "certificate-hash"

    monkeypatch.setattr(build, "signing_keychain", signing)
    monkeypatch.setattr(build, "install_profiles", lambda *_: None)
    monkeypatch.setattr(build, "assemble_archive", lambda *_: cache / "app.xcarchive")
    signed_verified = []

    def verify(*_, signed=False):
        if signed:
            if fail_at == "verify":
                raise build.BuildError("verify failed")
            signed_verified.append(True)

    monkeypatch.setattr(build, "verify_bundles", verify)

    def run(command, **_):
        if command[:2] == ["xcodebuild", "install"] and fail_at == "compile":
            raise build.BuildError("compile failed")
        if "-exportArchive" in command:
            if fail_at == "export":
                raise build.BuildError("export failed")
            export = Path(command[command.index("-exportPath") + 1])
            export.mkdir()
            (export / "fresh.ipa").write_bytes(b"new verified IPA")

    monkeypatch.setattr(build, "run", run)
    if fail_at:
        with pytest.raises(build.BuildError, match=fail_at):
            build.main([])
        assert output.read_bytes() == b"old verified IPA"
    else:
        build.main([])
        assert signed_verified == [True]
        assert output.read_bytes() == b"new verified IPA"


@pytest.mark.parametrize(
    "environment, executable", [("production", "bash"), ("development", "eas")]
)
def test_frontend_build_entrypoint_uses_fast_production_route(tmp_path, environment, executable):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    for name in ("bash", "eas"):
        stub = bin_dir / name
        stub.write_text('#!/bin/sh\nprintf "SELECTED:%s\\n" "' + name + '" "$@"\n')
        stub.chmod(0o755)
    result = subprocess.run(
        [
            "node",
            str(ROOT / "frontend/scripts/build.js"),
            "ios",
            environment,
            "--api-url=https://custom.example",
        ],
        env={**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}"},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert f"SELECTED:{executable}" in result.stdout
    if environment == "production":
        assert "SELECTED:--api-url\nSELECTED:https://custom.example" in result.stdout
