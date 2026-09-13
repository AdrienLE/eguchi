#!/usr/bin/env python3
"""Publish compatible app updates using the same profile as the cached iOS builder."""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

from ios_fast_build import APP_DIR, BuildError, build_environment, load_profile, read_json


def update_environment(eas, profile_name, inherited):
    profile = load_profile(eas, profile_name)
    channel = profile.get("channel", "")
    if not re.fullmatch(r"[a-z][a-z0-9-]*", channel) or profile.get("developmentClient"):
        raise BuildError("Choose a release profile with an EAS update channel.")
    if inherited.get("EXPO_PUBLIC_AUTH_OVERRIDE_TOKEN"):
        raise BuildError("Unset EXPO_PUBLIC_AUTH_OVERRIDE_TOKEN before publishing.")
    # Unlike one-off native builds, published updates use the committed profile
    # exactly. An unrelated shell or local .env must not change the API/auth config.
    clean = {key: value for key, value in inherited.items() if not key.startswith("EXPO_PUBLIC_")}
    return channel, build_environment(profile, clean, profile_name=profile_name)


def update_command(channel, platform, message, output):
    # SDK 53 supports the local environment. --environment would load EAS server
    # variables instead, which are not the source of truth for our local builder.
    return [
        "eas",
        "update",
        "--channel",
        channel,
        "--platform",
        platform,
        "--message",
        message,
        "--input-dir",
        str(output),
        "--emit-metadata",
        "--non-interactive",
    ]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", default="production")
    parser.add_argument("--platform", choices=("ios", "android", "all"), default="ios")
    parser.add_argument("--message", help="Release note; defaults to the latest commit")
    parser.add_argument(
        "--check", action="store_true", help="Export and resolve compatibility without publishing"
    )
    args = parser.parse_args(argv)
    eas = read_json(APP_DIR / "eas.json")
    channel, env = update_environment(eas, args.profile, os.environ)
    output = APP_DIR / "builds/updates" / args.profile
    if not args.check:
        status = subprocess.check_output(["git", "status", "--porcelain"], cwd=APP_DIR, text=True)
        if status.strip():
            raise BuildError(
                "Commit your tested changes before publishing. Use --check to test an uncommitted export."
            )
        if not shutil.which("eas"):
            raise BuildError("Install EAS CLI and sign in with eas login before publishing.")
    if args.check:
        command = [
            "node",
            str(APP_DIR / "node_modules/expo/bin/cli"),
            "export",
            "--platform",
            args.platform,
            "--output-dir",
            str(output),
        ]
        print(f"Checking {args.profile} / {channel}; nothing will be published.", flush=True)
    else:
        message = (
            args.message
            or subprocess.check_output(
                ["git", "log", "-1", "--format=%h %s"], cwd=APP_DIR, text=True
            ).strip()
        )
        command = update_command(channel, args.platform, message, output)
        print(
            f"Publishing {args.platform} to {channel} using the {args.profile} profile.", flush=True
        )
    subprocess.run(command, cwd=APP_DIR, env=env, check=True)
    if args.check:
        platforms = ["ios", "android"] if args.platform == "all" else [args.platform]
        for platform in platforms:
            result = subprocess.check_output(
                [
                    "node",
                    str(APP_DIR / "node_modules/expo-updates/bin/cli.js"),
                    "runtimeversion:resolve",
                    "--platform",
                    platform,
                ],
                cwd=APP_DIR,
                env=env,
                text=True,
            )
            runtime = json.loads(result)["runtimeVersion"]
            print(f"{platform} runtime: {runtime}")
        print(
            "Export verified. Install an update-enabled native build once before expecting wireless updates."
        )


if __name__ == "__main__":
    try:
        main()
    except (BuildError, subprocess.CalledProcessError) as error:
        print(f"Update failed: {error}", file=sys.stderr)
        sys.exit(1)
