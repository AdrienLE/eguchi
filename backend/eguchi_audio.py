import hashlib
import json
from pathlib import Path
from typing import Any


def get_default_audio_pack_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "frontend" / "assets" / "audio"


def _read_manifest(pack_dir: Path) -> dict[str, Any]:
    manifest_path = pack_dir / "manifest.json"
    with manifest_path.open(encoding="utf-8") as manifest_file:
        manifest = json.load(manifest_file)
    if not isinstance(manifest, dict):
        raise ValueError("Audio pack manifest must be an object")
    return manifest


def _audio_file_paths(pack_dir: Path, manifest: dict[str, Any]) -> list[str]:
    files = manifest.get("files")
    if not isinstance(files, list):
        raise ValueError("Audio pack manifest is missing files")

    audio_files: list[str] = []
    for file_entry in files:
        if not isinstance(file_entry, dict):
            continue
        audio_file = file_entry.get("audioFile")
        if isinstance(audio_file, str) and audio_file:
            audio_path = (pack_dir / audio_file).resolve()
            if pack_dir.resolve() not in audio_path.parents:
                raise ValueError(f"Audio pack file escapes pack directory: {audio_file}")
            if not audio_path.is_file():
                raise FileNotFoundError(f"Audio pack file is missing: {audio_file}")
            audio_files.append(audio_file)

    if not audio_files:
        raise ValueError("Audio pack manifest has no audio files")

    return sorted(audio_files)


def compute_audio_pack_hash(pack_dir: Path, manifest: dict[str, Any]) -> str:
    digest = hashlib.sha256()
    for relative_path in _audio_file_paths(pack_dir, manifest):
        audio_path = pack_dir / relative_path
        file_digest = hashlib.sha256(audio_path.read_bytes()).hexdigest()
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(file_digest.encode("ascii"))
        digest.update(b"\0")
    return digest.hexdigest()


def get_audio_pack_metadata(pack_name: str | None = None, audio_pack_root: Path | None = None):
    root = audio_pack_root or get_default_audio_pack_dir()
    if pack_name:
        pack_dir = root / pack_name
    else:
        pack_dirs = sorted(path for path in root.glob("eguchi-pack-*") if path.is_dir())
        if not pack_dirs:
            raise FileNotFoundError("No Eguchi audio pack directory found")
        pack_dir = pack_dirs[-1]

    manifest = _read_manifest(pack_dir)
    audio_files = _audio_file_paths(pack_dir, manifest)
    pack_hash = compute_audio_pack_hash(pack_dir, manifest)

    return {
        "packName": manifest.get("pack") or pack_dir.name,
        "format": manifest.get("format"),
        "generatedAt": manifest.get("generatedAt"),
        "fileCount": len(audio_files),
        "hashAlgorithm": "sha256",
        "hash": pack_hash,
    }
