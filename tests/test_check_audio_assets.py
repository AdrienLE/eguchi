from __future__ import annotations

import importlib.util
from pathlib import Path
import sys


def load_module():
    script_path = Path(__file__).resolve().parents[1] / "scripts" / "check_audio_assets.py"
    spec = importlib.util.spec_from_file_location("check_audio_assets", script_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def write_file(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_parse_audio_pack_references_and_missing_source_detection(tmp_path: Path):
    module = load_module()
    audio_pack_ts = tmp_path / "frontend" / "lib" / "eguchi" / "audio-pack.ts"
    write_file(
        audio_pack_ts,
        """export const AUDIO_PACK_NAME = 'eguchi-pack-test';
export const AUDIO_PACK_FILES_BY_CHORD = {
  'C-E-G': [
    { module: require('../../assets/audio/eguchi-pack-test/audio/C-E-G__o-3__v-01.mp3') },
  ],
  'F-A-C': [
    { module: require('../../assets/audio/eguchi-pack-test/audio/F-A-C__o-3__v-01.mp3') },
  ],
};""",
    )
    existing_file = (
        tmp_path
        / "frontend"
        / "assets"
        / "audio"
        / "eguchi-pack-test"
        / "audio"
        / "C-E-G__o-3__v-01.mp3"
    )
    existing_file.parent.mkdir(parents=True, exist_ok=True)
    existing_file.write_bytes(b"x")

    reference = module.parse_audio_pack_references(audio_pack_ts)
    assert reference.pack_name == "eguchi-pack-test"
    assert len(reference.referenced_files) == 2

    missing = module.find_missing_source_files(reference)
    assert len(missing) == 1
    assert missing[0].name == "F-A-C__o-3__v-01.mp3"


def test_find_missing_chord_entries(tmp_path: Path):
    module = load_module()
    audio_pack_ts = tmp_path / "frontend" / "lib" / "eguchi" / "audio-pack.ts"
    write_file(
        audio_pack_ts,
        """export const AUDIO_PACK_NAME = 'eguchi-pack-test';
export const AUDIO_PACK_FILES_BY_CHORD = {
  'C-E-G': [
    { module: require('../../assets/audio/eguchi-pack-test/audio/C-E-G__o-3__v-01.mp3') },
  ],
};""",
    )
    reference = module.parse_audio_pack_references(audio_pack_ts)
    missing_chords = module.find_missing_chord_entries(reference, ["C-E-G", "F-A-C"])
    assert missing_chords == ["F-A-C"]


def test_find_missing_dist_files_supports_hashed_names(tmp_path: Path):
    module = load_module()
    audio_pack_ts = tmp_path / "frontend" / "lib" / "eguchi" / "audio-pack.ts"
    write_file(
        audio_pack_ts,
        """export const AUDIO_PACK_NAME = 'eguchi-pack-test';
export const AUDIO_PACK_FILES_BY_CHORD = {
  'C-E-G': [
    { module: require('../../assets/audio/eguchi-pack-test/audio/C-E-G__o-3__v-01.mp3') },
  ],
};""",
    )
    source_audio = (
        tmp_path
        / "frontend"
        / "assets"
        / "audio"
        / "eguchi-pack-test"
        / "audio"
        / "C-E-G__o-3__v-01.mp3"
    )
    source_audio.parent.mkdir(parents=True, exist_ok=True)
    source_audio.write_bytes(b"x")

    dist_audio = (
        tmp_path
        / "frontend"
        / "dist"
        / "assets"
        / "assets"
        / "audio"
        / "eguchi-pack-test"
        / "audio"
        / "C-E-G__o-3__v-01.abcdef1234.mp3"
    )
    dist_audio.parent.mkdir(parents=True, exist_ok=True)
    dist_audio.write_bytes(b"y")

    reference = module.parse_audio_pack_references(audio_pack_ts)
    missing = module.find_missing_dist_files(reference, tmp_path / "frontend" / "dist")
    assert missing == []


def test_main_passes_for_real_repo_data():
    module = load_module()
    assert module.main([]) == 0
