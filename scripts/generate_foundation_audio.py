#!/usr/bin/env python3
"""Render the fixed first chord. No timing, pitch, register, or velocity randomization."""
import argparse
import hashlib
import json
import random
import tempfile
from pathlib import Path

from generate_audio_pack import RenderConfig, build_midi, render_audio, run_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend/assets/audio/foundation-v1"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--soundfont", required=True)
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    config = RenderConfig(1, [4], 120, 3000, 0, 0, 80, 0, 44100, "mp3")
    midi = OUTPUT / "red-C4-E4-G4.mid"
    audio = OUTPUT / "red-C4-E4-G4.mp3"
    build_midi(midi, [60, 64, 67], random.Random(0), config)
    with tempfile.TemporaryDirectory() as temporary:
        wav = Path(temporary) / "red.wav"
        render_audio(args.soundfont, midi, wav, config.sample_rate)
        # Retain natural piano release, but remove FluidSynth's long silent tail.
        run_ffmpeg(wav, audio, ["-t", "4.5", "-codec:a", "libmp3lame", "-b:a", "192k"], None)
    manifest = {
        "protocol": "eguchi-foundation-1",
        "chord": "C-E-G",
        "notes": ["C4", "E4", "G4"],
        "midiNotes": [60, 64, 67],
        "noteOnMs": [0, 0, 0],
        "heldMs": 3000,
        "velocity": [80, 80, 80],
        "concertAHz": 440,
        "instrument": "General MIDI acoustic grand piano",
        "soundfont": Path(args.soundfont).name,
        "audioFile": audio.name,
        "sha256": hashlib.sha256(audio.read_bytes()).hexdigest(),
        "adaptation": "Synthesized piano; not an official Ichionkai recording.",
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Rendered {audio.name}; SHA-256 {manifest['sha256']}")


if __name__ == "__main__":
    main()
