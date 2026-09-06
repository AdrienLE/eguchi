"""Independent checks of every actual bundled MIDI and audio fingerprint."""

import hashlib
import json
from pathlib import Path
import mido
import pytest

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "frontend/assets/audio/foundation-v1"
EXPECTED = {
    "C-E-G": [60, 64, 67],
    "C-F-A": [60, 65, 69],
    "B-D-G": [59, 62, 67],
    "A-C-F": [57, 60, 65],
    "D-G-B": [62, 67, 71],
    "E-G-C": [64, 67, 72],
    "F-A-C": [65, 69, 72],
    "G-B-D": [67, 71, 74],
    "G-C-E": [67, 72, 76],
    "A-C#-E": [57, 61, 64],
    "D-F#-A": [62, 66, 69],
    "E-G#-B": [64, 68, 71],
    "Bb-D-F": [58, 62, 65],
    "Eb-G-Bb": [63, 67, 70],
}


@pytest.mark.parametrize("chord,notes", EXPECTED.items())
def test_fixed_voicings_simultaneous_onset_even_velocity_and_fingerprints(chord, notes):
    manifest = json.loads((PACK / "manifest.json").read_text())
    entry = manifest["entries"][chord]
    elapsed = 0
    attacks, releases = [], []
    for message in mido.MidiFile(PACK / entry["midiFile"]):
        elapsed += message.time
        if message.type == "note_on" and message.velocity:
            attacks.append((message.note, message.velocity, elapsed))
        if message.type == "note_off":
            releases.append((message.note, elapsed))
    assert attacks == [(n, 80, 0) for n in notes]
    assert releases == [(n, 3.0) for n in notes]
    audio = (PACK / entry["audioFile"]).read_bytes()
    assert len(audio) > 30_000
    assert hashlib.sha256(audio).hexdigest() == entry["sha256"]
    assert entry["midiNotes"] == notes
    assert manifest["concertAHz"] == 440
    assert list(manifest["entries"]) == list(EXPECTED)
