#!/usr/bin/env python3
"""Build the persistent Expo iOS workspace with cached Pods and Xcode intermediates.

Adapted from hue-2's incremental install/archive workflow and House Lights'
native-input caching. No sibling checkout is required.
"""

import argparse
from contextlib import ExitStack, contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import shlex
import shutil
import subprocess
import sys
import tempfile
import time


APP_DIR = Path(__file__).resolve().parents[1] / "frontend"


class BuildError(Exception):
    pass


def read_json(path):
    return json.loads(path.read_text())


def read_plist(path):
    return plistlib.loads(path.read_bytes())


def resolve_path(app, value):
    path = Path(value).expanduser()
    return path if path.is_absolute() else app / path


def load_profile(eas, name, seen=()):
    if name in seen:
        raise BuildError("Circular EAS profile inheritance")
    if name not in eas.get("build", {}):
        raise BuildError(f"Unknown EAS profile: {name}")
    profile = eas["build"][name]
    parent = load_profile(eas, profile["extends"], (*seen, name)) if "extends" in profile else {}
    return {**parent, **profile, "env": {**parent.get("env", {}), **profile.get("env", {})}}


def build_environment(profile, inherited, api_url=None):
    env = dict(inherited)
    for key, value in profile.get("env", {}).items():
        if not re.fullmatch(r"EXPO_PUBLIC_[A-Z0-9_]+", key):
            raise BuildError(f"Fast builds support only public EAS environment values: {key}")
        env.setdefault(key, str(value))
    if api_url:
        env["EXPO_PUBLIC_API_URL"] = api_url
        environment = env.get("EXPO_PUBLIC_ENVIRONMENT", "production").upper()
        env[f"EXPO_PUBLIC_API_URL_{environment}"] = api_url
    if env.get("EXPO_PUBLIC_AUTH_OVERRIDE_TOKEN"):
        raise BuildError("Unset EXPO_PUBLIC_AUTH_OVERRIDE_TOKEN before building a release")
    # A release always bundles current JS and uses the selected build environment,
    # rather than silently loading a developer's local .env or skipping bundling.
    env.pop("SKIP_BUNDLING", None)
    env.update(NODE_ENV="production", FORCE_BUNDLING="1", EXPO_NO_DOTENV="1")
    return env


def native_fingerprint(app):
    digest = hashlib.sha256()
    package = read_json(app / "package.json")
    for key in ("dependencies", "devDependencies"):
        digest.update(json.dumps(package.get(key, {}), sort_keys=True).encode())
    for name in ("yarn.lock", "ios/Podfile", "ios/Podfile.properties.json", "ios/Podfile.lock"):
        path = app / name
        digest.update(name.encode())
        digest.update(path.read_bytes() if path.exists() else b"missing")
    return digest.hexdigest()


def prebuild_fingerprint(app, config, env):
    """Only native inputs invalidate prebuild; ordinary JS and scripts do not."""
    digest = hashlib.sha256()
    package = read_json(app / "package.json")
    for key in ("dependencies", "devDependencies"):
        digest.update(json.dumps(package.get(key, {}), sort_keys=True).encode())
    names = ["app.json", "app.config.js", "app.config.ts", "yarn.lock", "ios-fast-build.json"]
    names.extend(config.get("nativeInputs", []))
    for name in sorted(names):
        path = app / name
        files = sorted(path.rglob("*")) if path.is_dir() else [path]
        for file in files:
            if file.is_dir():
                continue
            digest.update(str(file.relative_to(app)).encode())
            digest.update(file.read_bytes() if file.is_file() else b"missing")
    public = {key: value for key, value in env.items() if key.startswith("EXPO_PUBLIC_")}
    digest.update(json.dumps(public, sort_keys=True).encode())
    return digest.hexdigest()


def prepare_project(app, cache, config, env, force=False):
    stamp = cache / "prebuild-inputs.sha256"
    fingerprint = prebuild_fingerprint(app, config, env)
    workspace = app / config["workspace"]
    if force or not workspace.is_dir() or not stamp.exists() or stamp.read_text() != fingerprint:
        print("Updating generated iOS configuration in place...", flush=True)
        run(
            [
                "node",
                str(app / "node_modules/expo/bin/cli"),
                "prebuild",
                "--platform",
                "ios",
                "--no-install",
                "--skip-dependency-update",
                "react,react-native",
            ],
            cwd=app,
            env=env,
            log=cache / "expo-prebuild.log",
        )
        # CocoaPods creates the workspace afterwards on a fresh checkout.
        if not workspace.with_suffix(".xcodeproj").is_dir():
            raise BuildError(f"Expo did not generate the configured Xcode project: {workspace}")
        stamp.write_text(prebuild_fingerprint(app, config, env))
    else:
        print("Reusing generated iOS configuration.", flush=True)


def run(command, *, cwd=None, env=None, log=None, sensitive=False, stderr_output=False):
    if log:
        with log.open("w") as output:
            result = subprocess.run(command, cwd=cwd, env=env, stdout=output, stderr=output)
        if result.returncode:
            raise BuildError(f"{Path(command[0]).name} failed; see {log}")
        return ""
    result = subprocess.run(command, cwd=cwd, env=env, capture_output=True)
    if result.returncode:
        # Never include signing command arguments or password-bearing exceptions.
        detail = "" if sensitive else result.stderr.decode(errors="replace")[-3000:]
        raise BuildError(f"{Path(command[0]).name} failed. {detail}".strip())
    return (result.stderr if stderr_output else result.stdout).decode()


def prepare_native(app, cache, env, force=False):
    stamp = cache / "pods-inputs.sha256"
    fingerprint = native_fingerprint(app)
    lock = app / "ios/Podfile.lock"
    manifest = app / "ios/Pods/Manifest.lock"
    current = lock.exists() and manifest.exists() and lock.read_bytes() == manifest.read_bytes()
    if force or not current or not stamp.exists() or stamp.read_text() != fingerprint:
        pod = "/opt/homebrew/bin/pod" if Path("/opt/homebrew/bin/pod").exists() else "pod"
        print("Installing Pods in place (the native project is preserved)...", flush=True)
        run([pod, "install"], cwd=app / "ios", env=env, log=cache / "pod-install.log")
        stamp.write_text(native_fingerprint(app))
    else:
        print("Reusing Pods and Xcode DerivedData.", flush=True)


def credential_targets(data, config):
    ios = data.get("ios", {})
    if "provisioningProfilePath" in ios:
        ios = {config["appTarget"]: ios}
    missing = set(config["targets"]) - set(ios)
    if missing:
        raise BuildError("Missing local iOS credentials for targets: " + ", ".join(sorted(missing)))
    return {name: ios[name] for name in config["targets"]}


def validate_profile(profile, bundle_id, required_entitlements):
    expires = profile["ExpirationDate"].replace(tzinfo=timezone.utc)
    if expires <= datetime.now(timezone.utc):
        raise BuildError(f"Provisioning profile for {bundle_id} has expired")
    entitlements = profile["Entitlements"]
    identifier = entitlements["application-identifier"].split(".", 1)[1]
    if identifier != bundle_id:
        raise BuildError(f"An explicit provisioning profile for {bundle_id} is required")
    if entitlements.get("get-task-allow") or not profile.get("ProvisionedDevices"):
        raise BuildError(f"{bundle_id} needs an ad hoc internal-distribution profile")
    for key, value in required_entitlements.items():
        allowed = entitlements.get(key)
        if isinstance(value, list):
            # Apple can encode an unrestricted array entitlement (notably
            # associated domains) as the scalar "*" in a provisioning profile.
            if allowed == "*":
                continue
            if not isinstance(allowed, list) or (
                "*" not in allowed and not set(value) <= set(allowed)
            ):
                raise BuildError(f"The {bundle_id} profile does not allow entitlement {key}")
        elif allowed != value:
            raise BuildError(f"The {bundle_id} profile does not allow entitlement {key}")


def load_credentials(app, file, config):
    if not file.exists():
        raise BuildError(
            f"Local iOS credentials not found: {file}. Download credentials with:\n"
            f"  (cd {shlex.quote(str(app))} && eas credentials --platform ios)\n"
            "Download credentials.json for the configured targets. "
            "Alternatively use yarn build:ios:eas from frontend."
        )
    result = {}
    for name, item in credential_targets(read_json(file), config).items():
        profile_path = resolve_path(app, item["provisioningProfilePath"])
        certificate = resolve_path(app, item["distributionCertificate"]["path"])
        if not profile_path.is_file() or not certificate.is_file():
            raise BuildError(f"Missing profile or distribution certificate for {name}")
        profile = plistlib.loads(run(["security", "cms", "-D", "-i", str(profile_path)]).encode())
        required = read_plist(app / config["entitlements"][name])
        validate_profile(profile, config["targets"][name], required)
        result[name] = {
            "profile": profile,
            "profile_path": profile_path,
            "certificate": certificate,
            "password": item["distributionCertificate"]["password"],
        }
    teams = {item["profile"]["TeamIdentifier"][0] for item in result.values()}
    if len(teams) != 1:
        raise BuildError("App and extension profiles must belong to the same Apple team")
    devices = [set(item["profile"]["ProvisionedDevices"]) for item in result.values()]
    if any(allowed != devices[0] for allowed in devices):
        raise BuildError("App and extension profiles must cover the same devices")
    return result


def export_options(credentials, config, identity):
    return {
        "method": "release-testing",
        "signingStyle": "manual",
        "teamID": next(iter(credentials.values()))["profile"]["TeamIdentifier"][0],
        "signingCertificate": identity,
        "manageAppVersionAndBuildNumber": False,
        "provisioningProfiles": {
            config["targets"][name]: item["profile"]["UUID"] for name, item in credentials.items()
        },
    }


@contextmanager
def signing_keychain(credentials, temporary):
    keychain = str(temporary / "build.keychain-db")
    password = secrets.token_urlsafe(32)
    created = False
    listed = False
    try:
        run(["security", "create-keychain", "-p", password, keychain], sensitive=True)
        created = True
        run(["security", "set-keychain-settings", "-lut", "21600", keychain])
        run(["security", "unlock-keychain", "-p", password, keychain], sensitive=True)
        imported = set()
        for item in credentials.values():
            certificate = str(item["certificate"])
            if certificate not in imported:
                run(
                    [
                        "security",
                        "import",
                        certificate,
                        "-k",
                        keychain,
                        "-P",
                        item["password"],
                        "-T",
                        "/usr/bin/codesign",
                        "-T",
                        "/usr/bin/security",
                    ],
                    sensitive=True,
                )
                imported.add(certificate)
        run(
            [
                "security",
                "set-key-partition-list",
                "-S",
                "apple-tool:,apple:,codesign:",
                "-s",
                "-k",
                password,
                keychain,
            ],
            sensitive=True,
        )
        identities = run(["security", "find-identity", "-v", "-p", "codesigning", keychain])
        hashes = set(re.findall(r"\b[0-9A-F]{40}\b", identities))
        for item in credentials.values():
            hashes &= {
                hashlib.sha1(der).hexdigest().upper()
                for der in item["profile"]["DeveloperCertificates"]
            }
        if not hashes:
            raise BuildError("No imported signing identity matches all provisioning profiles")
        # Export requires a searchable keychain. Remove only ours afterwards,
        # preserving keychains added by other builds during this export.
        previous = shlex.split(run(["security", "list-keychains", "-d", "user"]))
        run(["security", "list-keychains", "-d", "user", "-s", keychain, *previous])
        listed = True
        yield sorted(hashes)[0]
    finally:
        try:
            if listed:
                current = shlex.split(run(["security", "list-keychains", "-d", "user"]))
                run(
                    [
                        "security",
                        "list-keychains",
                        "-d",
                        "user",
                        "-s",
                        *[path for path in current if path != keychain],
                    ]
                )
        finally:
            if created:
                run(["security", "delete-keychain", keychain], sensitive=True)


def install_profiles(credentials):
    version = re.search(r"Xcode (\d+)", run(["xcodebuild", "-version"]))
    if not version:
        raise BuildError("Could not determine Xcode's provisioning profile location")
    directory = Path.home() / (
        "Library/Developer/Xcode/UserData/Provisioning Profiles"
        if int(version.group(1)) >= 16
        else "Library/MobileDevice/Provisioning Profiles"
    )
    directory.mkdir(parents=True, exist_ok=True)
    for item in credentials.values():
        destination = directory / (item["profile"]["UUID"] + ".mobileprovision")
        contents = item["profile_path"].read_bytes()
        if destination.exists() and destination.read_bytes() != contents:
            raise BuildError("A different installed provisioning profile uses the same UUID")
        if not destination.exists():
            destination.write_bytes(contents)
            destination.chmod(0o600)


def verify_bundles(directory, config, signed=False):
    apps = list(directory.glob("*.app"))
    if len(apps) != 1:
        raise BuildError("Expected one app bundle in the build output")
    app = apps[0]
    if not (app / "main.jsbundle").is_file() or (app / "main.jsbundle").stat().st_size == 0:
        raise BuildError("The release app is missing its bundled JavaScript")
    bundles = [app, *app.glob("PlugIns/*.appex")]
    actual = {read_plist(bundle / "Info.plist")["CFBundleIdentifier"] for bundle in bundles}
    if actual != set(config["targets"].values()):
        raise BuildError("The build output does not contain the configured app and all extensions")
    versions = {str(read_plist(bundle / "Info.plist")["CFBundleVersion"]) for bundle in bundles}
    if len(versions) != 1:
        raise BuildError("App and extension build numbers do not match")
    if signed:
        run(["codesign", "--verify", "--deep", "--strict", str(app)])
        for bundle in bundles:
            identifier = read_plist(bundle / "Info.plist")["CFBundleIdentifier"]
            profile = plistlib.loads(
                run(
                    ["security", "cms", "-D", "-i", str(bundle / "embedded.mobileprovision")]
                ).encode()
            )
            name = next(name for name, value in config["targets"].items() if value == identifier)
            validate_profile(
                profile, identifier, read_plist(APP_DIR / config["entitlements"][name])
            )
            entitlements = plistlib.loads(
                run(["codesign", "--display", "--entitlements", ":-", str(bundle)]).encode()
            )
            required = read_plist(APP_DIR / config["entitlements"][name])
            required["application-identifier"] = profile["Entitlements"]["application-identifier"]
            required["com.apple.developer.team-identifier"] = profile["TeamIdentifier"][0]
            verify_signed_entitlements(entitlements, required)
    return app


def verify_signed_entitlements(actual, required):
    if actual.get("get-task-allow"):
        raise BuildError("The exported app must not allow debugging")
    for key, value in required.items():
        present = actual.get(key)
        matches = (
            isinstance(present, list) and set(value) <= set(present)
            if isinstance(value, list)
            else present == value
        )
        if not matches:
            raise BuildError(f"The exported signature is missing entitlement {key}")


def native_paths(cache, config):
    # Keep install-action intermediates outside the disposable .xcarchive. Xcode's
    # archive action cleans its intermediates even when DerivedData is retained.
    root = cache / "DerivedData/Build/Intermediates.noindex/ArchiveIntermediates" / config["scheme"]
    return {
        "objects": root / "IntermediateBuildFilesPath",
        "products": root / "BuildProductsPath",
        "installed": root / "InstallationBuildProductsLocation",
    }


def assemble_archive(cache, config, credentials=None):
    paths = native_paths(cache, config)
    app = verify_bundles(paths["installed"] / "Applications", config)
    archive = cache / "app.xcarchive"
    if archive.exists():
        shutil.rmtree(archive)
    application_dir = archive / "Products/Applications"
    application_dir.mkdir(parents=True)
    run(["ditto", str(app), str(application_dir / app.name)])
    for symbols in paths["products"].glob("Release-iphoneos/*.dSYM"):
        run(["ditto", str(symbols), str(archive / "dSYMs" / symbols.name)])
    info = read_plist(app / "Info.plist")
    properties = {
        key: info[key]
        for key in ("CFBundleIdentifier", "CFBundleShortVersionString", "CFBundleVersion")
    }
    properties["ApplicationPath"] = f"Applications/{app.name}"
    properties["Architectures"] = run(
        ["lipo", "-archs", str(app / info["CFBundleExecutable"])]
    ).split()
    if credentials:
        properties["Team"] = next(iter(credentials.values()))["profile"]["TeamIdentifier"][0]
        description = run(["codesign", "--display", "--verbose=2", str(app)], stderr_output=True)
        authority = re.search(r"^Authority=(.+)$", description, re.MULTILINE)
        if not authority:
            raise BuildError("The built app is missing its distribution signing identity")
        properties["SigningIdentity"] = authority.group(1)
    (archive / "Info.plist").write_bytes(
        plistlib.dumps(
            {
                "ArchiveVersion": 2,
                "ApplicationProperties": properties,
                "CreationDate": datetime.now(timezone.utc).replace(tzinfo=None),
                "Name": app.stem,
                "SchemeName": config["scheme"],
            }
        )
    )
    return archive


def archive_command(app, cache, config, extra=(), build_number=None, signing=None, jobs=4):
    paths = native_paths(cache, config)
    command = [
        "xcodebuild",
        "install",
        "-quiet",
        "-workspace",
        str(app / config["workspace"]),
        "-scheme",
        config["scheme"],
        "-configuration",
        "Release",
        "-destination",
        "generic/platform=iOS",
        "-jobs",
        str(jobs),
        "-derivedDataPath",
        str(cache / "DerivedData"),
        *extra,
        f"OBJROOT={paths['objects']}",
        f"SYMROOT={paths['products']}",
        f"DSTROOT={paths['installed']}",
    ]
    if signing:
        credentials, identity, keychain = signing
        command += [
            "CODE_SIGN_STYLE=Manual",
            f"DEVELOPMENT_TEAM={next(iter(credentials.values()))['profile']['TeamIdentifier'][0]}",
            f"CODE_SIGN_IDENTITY={identity}",
            f"OTHER_CODE_SIGN_FLAGS=--keychain {shlex.quote(str(keychain))}",
            # Xcode expands TARGET_NAME for each target, preserving its own entitlements.
            "PROVISIONING_PROFILE_SPECIFIER=$(FAST_PROFILE_$(TARGET_NAME))",
        ]
        for name, item in credentials.items():
            command.append(f"FAST_PROFILE_{name}={item['profile']['UUID']}")
    else:
        command += ["CODE_SIGNING_ALLOWED=NO", "CODE_SIGNING_REQUIRED=NO", "CODE_SIGN_IDENTITY="]
    if build_number:
        command.append(f"CURRENT_PROJECT_VERSION={build_number}")
    return command


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", default="production", help="Internal EAS profile to mirror")
    parser.add_argument(
        "--output",
        default="builds/eguchi-ios-fast.ipa",
        help="IPA path, relative to frontend unless absolute",
    )
    parser.add_argument("--credentials", default=os.environ.get("EGUCHI_IOS_CREDENTIALS"))
    parser.add_argument("--api-url")
    parser.add_argument("api_url_positional", nargs="?", help=argparse.SUPPRESS)
    parser.add_argument("--build-number", help="Override build numbers for all configured targets")
    parser.add_argument(
        "--jobs", type=int, default=4, help="Maximum parallel compiler jobs (default: 4)"
    )
    parser.add_argument("--install-pods", action="store_true", help="Force an in-place pod install")
    parser.add_argument(
        "--refresh-native", action="store_true", help="Force an in-place Expo prebuild"
    )
    parser.add_argument(
        "--prepare-only",
        action="store_true",
        help="Prepare iOS and Pods without signing or compiling",
    )
    parser.add_argument(
        "--archive-only", action="store_true", help="Build an unsigned archive for QA"
    )
    parser.add_argument("--check", action="store_true", help="Check configuration without building")
    argv = list(sys.argv[1:] if argv is None else argv)
    split = argv.index("--") if "--" in argv else len(argv)
    args = parser.parse_args(argv[:split])
    extra = argv[split + 1 :]
    config = read_json(APP_DIR / "ios-fast-build.json")
    profile = load_profile(read_json(APP_DIR / "eas.json"), args.profile)
    if (
        profile.get("distribution") != "internal"
        or profile.get("developmentClient")
        or profile.get("ios", {}).get("simulator")
    ):
        raise BuildError(
            "Use an internal release profile; use EAS for development/App Store builds"
        )
    if args.build_number and not re.fullmatch(r"[0-9]+(?:\.[0-9]+){0,2}", args.build_number):
        raise BuildError("Invalid build number")
    if args.jobs < 1:
        raise BuildError("--jobs must be at least 1")
    env = build_environment(profile, os.environ, args.api_url or args.api_url_positional)
    if args.check and not (APP_DIR / config["workspace"]).is_dir():
        raise BuildError("Run build-ios-ipa-fast.sh --prepare-only to generate the iOS workspace")
    if not (APP_DIR / "node_modules/react-native").is_dir():
        raise BuildError("Install frontend dependencies with yarn install first")
    for tool in ("xcodebuild", "node", "ditto", "security", "codesign", "lipo"):
        if not shutil.which(tool):
            raise BuildError(f"Required command is missing: {tool}")
    credentials = None
    if not args.archive_only and not args.prepare_only:
        default = (
            ".signing/credentials.json"
            if (APP_DIR / ".signing/credentials.json").exists()
            else "credentials.json"
        )
        credentials_path = resolve_path(APP_DIR, args.credentials or default)
        if args.check or not credentials_path.is_file():
            credentials = load_credentials(APP_DIR, credentials_path, config)
    if args.check:
        print(
            f"Ready: {config['scheme']} / {args.profile}; {len(config['targets'])} native targets"
        )
        return
    cache = APP_DIR / "builds/native-cache"
    cache.mkdir(parents=True, exist_ok=True)
    with (cache / "build.lock").open("w") as lock, ExitStack() as stack:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise BuildError("Another fast iOS build is already using this checkout") from None
        started = time.monotonic()
        prepare_project(APP_DIR, cache, config, env, args.refresh_native)
        prepare_native(APP_DIR, cache, env, args.install_pods)
        if not (APP_DIR / config["workspace"]).is_dir():
            raise BuildError("CocoaPods did not create the configured Xcode workspace")
        if args.prepare_only:
            print("Persistent iOS workspace and Pods are ready.")
            return
        if not args.archive_only:
            credentials = load_credentials(APP_DIR, credentials_path, config)
        signing = None
        if credentials:
            temporary = Path(
                stack.enter_context(tempfile.TemporaryDirectory(prefix="eguchi-ios-signing-"))
            )
            identity = stack.enter_context(signing_keychain(credentials, temporary))
            install_profiles(credentials)
            signing = (credentials, identity, temporary / "build.keychain-db")
        print("Building incrementally in Release mode...", flush=True)
        run(
            archive_command(APP_DIR, cache, config, extra, args.build_number, signing, args.jobs),
            cwd=APP_DIR,
            env=env,
            log=cache / "xcode-archive.log",
        )
        archive = assemble_archive(cache, config, credentials)
        verify_bundles(archive / "Products/Applications", config)
        if args.archive_only:
            print(f"Unsigned archive verified: {archive} ({time.monotonic() - started:.0f}s)")
            return
        options = temporary / "ExportOptions.plist"
        options.write_bytes(plistlib.dumps(export_options(credentials, config, identity)))
        print("Exporting signed IPA...", flush=True)
        run(
            [
                "xcodebuild",
                "-exportArchive",
                "-quiet",
                "-archivePath",
                str(archive),
                "-exportPath",
                str(temporary / "export"),
                "-exportOptionsPlist",
                str(options),
            ],
            env=env,
            log=cache / "xcode-export.log",
        )
        ipas = list((temporary / "export").glob("*.ipa"))
        if len(ipas) != 1:
            raise BuildError("Xcode did not export exactly one IPA")
        run(["ditto", "-x", "-k", str(ipas[0]), str(temporary / "verify")])
        verify_bundles(temporary / "verify/Payload", config, signed=True)
        output = resolve_path(APP_DIR, args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        # Publish only a verified new IPA; a failed build leaves the old one intact.
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".ipa", delete=False) as file:
            staging = Path(file.name)
        try:
            shutil.copyfile(ipas[0], staging)
            staging.replace(output)
        finally:
            staging.unlink(missing_ok=True)
        print(f"Signed IPA verified: {output} ({time.monotonic() - started:.0f}s)")


if __name__ == "__main__":
    try:
        main()
    except (BuildError, KeyError, ValueError, OSError) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
