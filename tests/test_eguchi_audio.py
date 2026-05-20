import json
from pathlib import Path

import pytest

from backend.eguchi_audio import compute_audio_pack_hash, get_audio_pack_metadata


def write_pack(tmp_path: Path, generated_at: str = "2026-01-01T00:00:00+00:00") -> Path:
    pack_dir = tmp_path / "eguchi-pack-test"
    (pack_dir / "audio").mkdir(parents=True)
    (pack_dir / "audio" / "C-E-G.mp3").write_bytes(b"first")
    (pack_dir / "audio" / "F-A-C.mp3").write_bytes(b"second")
    (pack_dir / "manifest.json").write_text(
        json.dumps(
            {
                "pack": "eguchi-pack-test",
                "format": "mp3",
                "generatedAt": generated_at,
                "files": [
                    {"audioFile": "audio/F-A-C.mp3"},
                    {"audioFile": "audio/C-E-G.mp3"},
                ],
            }
        ),
        encoding="utf-8",
    )
    return pack_dir


def test_compute_audio_pack_hash_is_stable_across_manifest_timestamp(tmp_path: Path):
    pack_dir = write_pack(tmp_path)
    manifest = json.loads((pack_dir / "manifest.json").read_text(encoding="utf-8"))
    first_hash = compute_audio_pack_hash(pack_dir, manifest)

    manifest["generatedAt"] = "2026-02-01T00:00:00+00:00"

    assert compute_audio_pack_hash(pack_dir, manifest) == first_hash


def test_compute_audio_pack_hash_changes_when_audio_changes(tmp_path: Path):
    pack_dir = write_pack(tmp_path)
    manifest = json.loads((pack_dir / "manifest.json").read_text(encoding="utf-8"))
    first_hash = compute_audio_pack_hash(pack_dir, manifest)

    (pack_dir / "audio" / "F-A-C.mp3").write_bytes(b"changed")

    assert compute_audio_pack_hash(pack_dir, manifest) != first_hash


def test_get_audio_pack_metadata_returns_hash_and_file_count(tmp_path: Path):
    pack_dir = write_pack(tmp_path)

    metadata = get_audio_pack_metadata(pack_dir.name, tmp_path)

    assert metadata["packName"] == "eguchi-pack-test"
    assert metadata["format"] == "mp3"
    assert metadata["fileCount"] == 2
    assert metadata["hashAlgorithm"] == "sha256"
    assert isinstance(metadata["hash"], str)
    assert len(metadata["hash"]) == 64


def test_get_audio_pack_metadata_errors_on_missing_audio_file(tmp_path: Path):
    pack_dir = write_pack(tmp_path)
    (pack_dir / "audio" / "C-E-G.mp3").unlink()

    with pytest.raises(FileNotFoundError):
        get_audio_pack_metadata(pack_dir.name, tmp_path)
