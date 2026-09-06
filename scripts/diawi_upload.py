#!/usr/bin/env python3
"""Build iOS locally, upload the IPA to Diawi, and print its installation link."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.parse import quote_plus, urlparse
import zipfile


ROOT = Path(__file__).resolve().parents[1]
APP_DIR = ROOT / "frontend"
UPLOAD_URL = "https://upload.diawi.com/"
STATUS_URL = "https://upload.diawi.com/status"


class UploadError(Exception):
    pass


def private_environment():
    return {key: value for key, value in os.environ.items() if key != "DIAWI_TOKEN"}


def load_token(token_file=None):
    if token_file:
        token = Path(token_file).expanduser().read_text().strip()
    else:
        token = os.environ.get("DIAWI_TOKEN", "").strip()
        default = APP_DIR / ".signing/diawi-token"
        if not token and default.is_file():
            token = default.read_text().strip()
    if not token or any(character.isspace() for character in token):
        raise UploadError(
            "Set DIAWI_TOKEN locally or use --token-file PATH "
            "(default file: frontend/.signing/diawi-token)."
        )
    return token


def curl_quote(value):
    return (
        '"'
        + str(value)
        .replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\r", "\\r")
        .replace("\n", "\\n")
        + '"'
    )


def redact(message, token):
    message = str(message).replace(token, "[redacted]")
    return re.sub(re.escape(quote_plus(token)), "[redacted]", message, flags=re.IGNORECASE)[:500]


def request(url, options, token, timeout=30):
    # Feed credentials through stdin, never command arguments, curlrc, or logs.
    settings = [
        ("url", url),
        ("header", "Accept: application/json"),
        ("connect-timeout", "30"),
        ("max-time", str(timeout)),
        ("write-out", "\n%{http_code}"),
        *options,
    ]
    config = "silent\nshow-error\n" + "\n".join(
        f"{key} = {curl_quote(value)}" for key, value in settings
    )
    result = subprocess.run(
        ["curl", "--disable", "--config", "-"],
        input=config,
        capture_output=True,
        text=True,
        env=private_environment(),
    )
    if result.returncode:
        raise UploadError(f"Diawi request failed (curl exit {result.returncode}).")
    body, separator, status = result.stdout.rpartition("\n")
    if not separator or not re.fullmatch(r"\d{3}", status):
        raise UploadError("Diawi returned an invalid HTTP response.")
    try:
        data = json.loads(body)
    except ValueError:
        data = None
    if not 200 <= int(status) < 300:
        message = data.get("message", body) if isinstance(data, dict) else body
        raise UploadError(f"Diawi HTTP {status}: {redact(message, token)}")
    if not isinstance(data, dict):
        raise UploadError("Diawi returned an invalid JSON response.")
    return data


def validate_ipa(path):
    if not path.is_file() or path.suffix.lower() != ".ipa" or path.stat().st_size == 0:
        raise UploadError(f"No IPA was produced or selected: {path}")
    expected = json.loads((APP_DIR / "ios-fast-build.json").read_text())
    identifier = expected["targets"][expected["appTarget"]]
    try:
        with zipfile.ZipFile(path) as ipa:
            infos = [
                name
                for name in ipa.namelist()
                if re.fullmatch(r"Payload/[^/]+\.app/Info.plist", name)
            ]
            if len(infos) != 1:
                raise UploadError("The IPA must contain exactly one main application.")
            app = infos[0].removesuffix("Info.plist")
            info = plistlib.loads(ipa.read(infos[0]))
            if info.get("CFBundleIdentifier") != identifier:
                raise UploadError(f"The IPA is not the configured app ({identifier}).")
            for required in (
                "main.jsbundle",
                "embedded.mobileprovision",
                "_CodeSignature/CodeResources",
            ):
                if ipa.getinfo(app + required).file_size == 0:
                    raise UploadError(f"The IPA has an empty {required}.")
    except (zipfile.BadZipFile, KeyError, ValueError, plistlib.InvalidFileException) as error:
        raise UploadError(
            "Invalid IPA: expected the app, JavaScript, and signing files."
        ) from error


def publish(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as file:
        staging = Path(file.name)
    try:
        shutil.copyfile(source, staging)
        staging.replace(destination)
    finally:
        staging.unlink(missing_ok=True)


def prepare_artifact(args, extra, temporary):
    artifact = temporary / "app.ipa"
    default = APP_DIR / "builds/eguchi-ios-fast.ipa"
    if args.skip_build:
        if extra or args.eas_build:
            raise UploadError("Build options cannot be combined with --skip-build.")
        source = Path(args.file).expanduser().resolve() if args.file else default
        if not source.is_file():
            raise UploadError(f"IPA not found: {source}")
        # Upload an immutable snapshot even if another build replaces the source IPA.
        shutil.copyfile(source, artifact)
    else:
        if args.file:
            raise UploadError("Use --skip-build with --file to upload an existing IPA.")
        forbidden = ("--output", "--check", "--archive-only", "--prepare-only", "--help", "-h")
        if any(option.split("=", 1)[0] in forbidden for option in extra):
            raise UploadError(
                "Diawi requires a fresh signed IPA; do not override output or build mode."
            )
        if args.eas_build:
            command = ["bash", str(ROOT / "scripts/build-prod.sh"), "ios", "--eas-build"]
        else:
            command = ["bash", str(ROOT / "scripts/build-ios-ipa-fast.sh")]
        # A unique destination prevents an old IPA being selected after a failed/no-op build.
        command += ["--output", str(artifact), *extra]
        result = subprocess.run(command, cwd=APP_DIR, env=private_environment())
        if result.returncode:
            raise UploadError(f"iOS build failed (exit {result.returncode}); nothing uploaded.")
    validate_ipa(artifact)
    if not args.skip_build:
        publish(artifact, default)
        print(f"Built IPA saved: {default}", flush=True)
    return artifact


def upload(artifact, token, timeout=600):
    print(f"Uploading IPA to Diawi ({artifact.stat().st_size / 1024**2:.1f} MB)...", flush=True)
    form_path = str(artifact).replace("\\", "\\\\").replace('"', '\\"')
    response = request(
        UPLOAD_URL,
        [
            ("request", "POST"),
            ("form-string", f"token={token}"),
            ("form", f'file=@"{form_path}"'),
            ("form-string", "find_by_udid=0"),
            ("form-string", "wall_of_apps=0"),
        ],
        token,
        timeout=600,
    )
    job = response.get("job")
    if not isinstance(job, str) or not job:
        raise UploadError(
            f"Diawi rejected the upload: {redact(response.get('message', 'no job returned'), token)}"
        )
    print("Upload queued; waiting for the installation link...", flush=True)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = request(
            STATUS_URL,
            [("get", ""), ("data-urlencode", f"token={token}"), ("data-urlencode", f"job={job}")],
            token,
            timeout=max(1, min(30, deadline - time.monotonic())),
        )
        status = result.get("status")
        if str(status).isdigit() and int(status) >= 4000:
            raise UploadError(
                f"Diawi processing failed ({status}): {redact(result.get('message', ''), token)}"
            )
        nested = result.get("result")
        link = result.get("link") or (nested.get("link") if isinstance(nested, dict) else None)
        if link:
            if not isinstance(link, str):
                raise UploadError("Diawi returned an invalid installation URL.")
            parsed = urlparse(link)
            if parsed.scheme != "https" or not (
                parsed.hostname == "diawi.com" or (parsed.hostname or "").endswith(".diawi.com")
            ):
                raise UploadError("Diawi returned an unexpected installation URL.")
            return {"job": job, "link": link}
        time.sleep(min(5, max(0, deadline - time.monotonic())))
    raise UploadError(
        f"Timed out waiting for Diawi job {redact(job, token)}; check the Diawi dashboard."
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("platform", nargs="?", choices=["ios"], default="ios")
    parser.add_argument(
        "--skip-build", action="store_true", help="Re-upload an existing signed IPA"
    )
    parser.add_argument("--file", help="Existing IPA path relative to your current directory")
    parser.add_argument("--token-file", help="Read the Diawi token from a local file")
    parser.add_argument(
        "--eas-build", action="store_true", help="Use local EAS instead of cached Xcode"
    )
    parser.add_argument("--timeout", type=int, default=600, help="Processing timeout in seconds")
    parser.add_argument("--no-qr", action="store_true", help="Do not print a terminal QR code")
    argv = list(sys.argv[1:] if argv is None else argv)
    split = argv.index("--") if "--" in argv else len(argv)
    args = parser.parse_args(argv[:split])
    extra = argv[split + 1 :]
    if args.timeout <= 0:
        raise UploadError("--timeout must be positive.")
    token = load_token(args.token_file)
    if not shutil.which("curl"):
        raise UploadError("curl is required to upload to Diawi.")
    builds = APP_DIR / "builds"
    builds.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="diawi-", dir=builds) as directory:
        temporary = Path(directory)
        artifact = prepare_artifact(args, extra, temporary)
        result = upload(artifact, token, args.timeout)
        result["ipa_sha256"] = hashlib.sha256(artifact.read_bytes()).hexdigest()
        record = temporary / "result.json"
        record.write_text(json.dumps(result, indent=2) + "\n")
        publish(record, builds / "diawi-last-success.json")
    print(f"\nDiawi install link: {result['link']}", flush=True)
    if not args.no_qr and shutil.which("qrencode"):
        # QR rendering must not turn a successful upload into a reported failure.
        subprocess.run(["qrencode", "-t", "ansiutf8", result["link"]], env=private_environment())


if __name__ == "__main__":
    try:
        main()
    except (UploadError, OSError) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
