"""Independent musical checks of the actual bundled stimulus, not just its manifest."""

import hashlib
import json
from pathlib import Path

import mido

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "frontend/assets/audio/foundation-v1"


def test_first_chord_has_exact_voicing_simultaneous_onset_and_even_velocity():
    midi = mido.MidiFile(PACK / "red-C4-E4-G4.mid")
    elapsed = 0
    attacks, releases = [], []
    for message in midi:
        elapsed += message.time
        if message.type == "note_on" and message.velocity:
            attacks.append((message.note, message.velocity, elapsed))
        if message.type == "note_off":
            releases.append((message.note, elapsed))
    assert attacks == [(60, 80, 0), (64, 80, 0), (67, 80, 0)]
    assert releases == [(60, 3.0), (64, 3.0), (67, 3.0)]


def test_manifest_fingerprints_bundled_audio_for_future_reviews():
    manifest = json.loads((PACK / "manifest.json").read_text())
    audio = (PACK / manifest["audioFile"]).read_bytes()
    assert len(audio) > 30_000
    assert hashlib.sha256(audio).hexdigest() == manifest["sha256"]
    assert manifest["notes"] == ["C4", "E4", "G4"]
    assert manifest["concertAHz"] == 440
