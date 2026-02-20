#!/usr/bin/env python3
"""Validate that Eguchi audio files referenced by audio-pack.ts are present."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


PACK_NAME_PATTERN = re.compile(r"export const AUDIO_PACK_NAME = '([^']+)';")
CHORD_PATTERN = re.compile(r"^\s*'([^']+)':\s*\[")
REQUIRE_PATTERN = re.compile(r"require\('([^']+)'\)")
CHORD_ID_PATTERN = re.compile(r"id:\s*'([^']+)'")


@dataclass(frozen=True)
class AudioPackReference:
    pack_name: str
    referenced_files_by_chord: dict[str, list[Path]]

    @property
    def referenced_files(self) -> list[Path]:
        files: list[Path] = []
        for chord_files in self.referenced_files_by_chord.values():
            files.extend(chord_files)
        return files


def parse_audio_pack_references(audio_pack_ts: Path) -> AudioPackReference:
    source = audio_pack_ts.read_text(encoding="utf-8")
    pack_match = PACK_NAME_PATTERN.search(source)
    if not pack_match:
        raise ValueError(f"Could not find AUDIO_PACK_NAME in {audio_pack_ts}")
    pack_name = pack_match.group(1)

    referenced_files_by_chord: dict[str, list[Path]] = {}
    current_chord: str | None = None
    for raw_line in source.splitlines():
        chord_match = CHORD_PATTERN.match(raw_line)
        if chord_match:
            current_chord = chord_match.group(1)
            referenced_files_by_chord.setdefault(current_chord, [])
            continue
        require_match = REQUIRE_PATTERN.search(raw_line)
        if require_match and current_chord:
            rel_path = require_match.group(1)
            resolved = (audio_pack_ts.parent / rel_path).resolve()
            referenced_files_by_chord[current_chord].append(resolved)

    if not referenced_files_by_chord:
        raise ValueError(f"No audio file references found in {audio_pack_ts}")
    return AudioPackReference(
        pack_name=pack_name, referenced_files_by_chord=referenced_files_by_chord
    )


def parse_chord_ids(chords_ts: Path) -> list[str]:
    source = chords_ts.read_text(encoding="utf-8")
    chord_ids = [match.group(1) for match in CHORD_ID_PATTERN.finditer(source)]
    if not chord_ids:
        raise ValueError(f"No chord ids found in {chords_ts}")
    return chord_ids


def find_missing_source_files(reference: AudioPackReference) -> list[Path]:
    return sorted({path for path in reference.referenced_files if not path.exists()})


def find_unsafe_file_names(reference: AudioPackReference) -> list[str]:
    return sorted({path.name for path in reference.referenced_files if "#" in path.name})


def find_missing_chord_entries(
    reference: AudioPackReference, expected_chord_ids: Iterable[str]
) -> list[str]:
    missing: list[str] = []
    for chord_id in expected_chord_ids:
        if chord_id not in reference.referenced_files_by_chord:
            missing.append(chord_id)
            continue
        if not reference.referenced_files_by_chord[chord_id]:
            missing.append(chord_id)
    return missing


def find_missing_dist_files(reference: AudioPackReference, dist_root: Path) -> list[str]:
    dist_audio_dir = dist_root / "assets" / "assets" / "audio" / reference.pack_name / "audio"
    if not dist_audio_dir.exists():
        return ["<dist-audio-dir-missing>"]

    missing: list[str] = []
    dist_files = {path.name for path in dist_audio_dir.glob("*.mp3")}

    for source_file in reference.referenced_files:
        source_name = source_file.name
        stem = Path(source_name).stem
        suffix = Path(source_name).suffix
        exact_match = source_name in dist_files
        hashed_matches = list(dist_audio_dir.glob(f"{stem}.*{suffix}"))
        if not exact_match and not hashed_matches:
            missing.append(source_name)

    return sorted(set(missing))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check Eguchi audio asset availability.")
    parser.add_argument(
        "--audio-pack-ts",
        default="frontend/lib/eguchi/audio-pack.ts",
        help="Path to audio-pack.ts",
    )
    parser.add_argument(
        "--chords-ts",
        default="frontend/lib/eguchi/chords.ts",
        help="Path to chords.ts",
    )
    parser.add_argument(
        "--dist-root",
        default="frontend/dist",
        help="Path to exported web dist directory",
    )
    parser.add_argument(
        "--check-dist",
        action="store_true",
        help="Also validate that hashed mp3 files exist in exported web dist.",
    )
    args = parser.parse_args(argv)

    repo_root = Path(__file__).resolve().parents[1]
    audio_pack_ts = Path(args.audio_pack_ts)
    chords_ts = Path(args.chords_ts)
    dist_root = Path(args.dist_root)
    if not audio_pack_ts.is_absolute():
        audio_pack_ts = repo_root / audio_pack_ts
    if not chords_ts.is_absolute():
        chords_ts = repo_root / chords_ts
    if not dist_root.is_absolute():
        dist_root = repo_root / dist_root

    reference = parse_audio_pack_references(audio_pack_ts)
    expected_chord_ids = parse_chord_ids(chords_ts)

    print(f"Audio pack: {reference.pack_name}")
    print(f"Referenced files: {len(reference.referenced_files)}")
    print(f"Chords in pack map: {len(reference.referenced_files_by_chord)}")

    missing_chords = find_missing_chord_entries(reference, expected_chord_ids)
    if missing_chords:
        print("Missing chord entries:")
        for chord_id in missing_chords:
            print(f"- {chord_id}")
        return 1

    missing_source_files = find_missing_source_files(reference)
    if missing_source_files:
        print("Missing source audio files:")
        for path in missing_source_files[:30]:
            print(f"- {path}")
        if len(missing_source_files) > 30:
            print(f"... and {len(missing_source_files) - 30} more")
        return 1
    print("Source audio files: OK")

    unsafe_file_names = find_unsafe_file_names(reference)
    if unsafe_file_names:
        print("Unsafe audio file names detected (contains '#'):")
        for name in unsafe_file_names[:30]:
            print(f"- {name}")
        if len(unsafe_file_names) > 30:
            print(f"... and {len(unsafe_file_names) - 30} more")
        return 1

    if args.check_dist:
        missing_dist_files = find_missing_dist_files(reference, dist_root)
        if missing_dist_files:
            print("Missing exported web audio files:")
            for name in missing_dist_files[:30]:
                print(f"- {name}")
            if len(missing_dist_files) > 30:
                print(f"... and {len(missing_dist_files) - 30} more")
            return 1
        print("Exported web audio files: OK")

    print("Audio asset check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
