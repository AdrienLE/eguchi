#!/usr/bin/env python3
import argparse
import json
import random
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

try:
    from mido import Message, MetaMessage, MidiFile, MidiTrack, bpm2tempo
except ImportError:  # pragma: no cover - runtime dependency check
    print("Missing dependency: mido")
    print("Install with: pip install mido")
    raise


NOTE_OFFSETS = {
    "C": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "F": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
}

DEFAULT_CHORD_LABELS = [
    "C-E-G",
    "F-A-C",
    "G-B-D",
    "E-G-C",
    "A-C-F",
    "B-D-G",
    "G-C-E",
    "C-F-A",
    "D-G-B",
    "A-C#-E",
    "D-F#-A",
    "E-G#-B",
    "Bb-D-F",
    "Eb-G-Bb",
]


@dataclass(frozen=True)
class RenderConfig:
    variants: int
    octaves: list[int]
    bpm: int
    duration_ms: int
    duration_jitter_ms: int
    start_jitter_ms: int
    velocity: int
    velocity_jitter: int
    sample_rate: int
    output_format: str


@dataclass(frozen=True)
class RenderTask:
    chord: str
    octave: int
    variant: int
    midi_path: Path
    audio_path: Path
    notes: list[int]
    seed: int


def parse_note(note: str) -> int:
    key = note.strip()
    if not key:
        raise ValueError("Empty note token in chord label.")
    key = key[0].upper() + key[1:]
    if key not in NOTE_OFFSETS:
        raise ValueError(f"Unsupported note name: {note}")
    return NOTE_OFFSETS[key]


def chord_to_midi_notes(label: str, base_octave: int) -> list[int]:
    parts = [part.strip() for part in label.split("-") if part.strip()]
    if not parts:
        raise ValueError(f"Invalid chord label: {label}")
    semitones = [parse_note(part) for part in parts]
    midi_notes: list[int] = []
    prev_note = None
    for semitone in semitones:
        midi_note = (base_octave + 1) * 12 + semitone
        while prev_note is not None and midi_note <= prev_note:
            midi_note += 12
        midi_notes.append(midi_note)
        prev_note = midi_note
    return midi_notes


def ms_to_ticks(ms: int, ticks_per_beat: int, tempo_us: int) -> int:
    seconds = ms / 1000
    return int(round(seconds * ticks_per_beat * 1_000_000 / tempo_us))


def build_midi(
    midi_path: Path,
    notes: Iterable[int],
    rng: random.Random,
    config: RenderConfig,
) -> None:
    midi = MidiFile(ticks_per_beat=480)
    track = MidiTrack()
    midi.tracks.append(track)

    tempo = bpm2tempo(config.bpm)
    track.append(MetaMessage("set_tempo", tempo=tempo, time=0))

    jitters = [
        rng.randint(-config.start_jitter_ms, config.start_jitter_ms)
        if config.start_jitter_ms
        else 0
        for _ in notes
    ]
    offset_ms = -min(jitters) if jitters and min(jitters) < 0 else 0

    events: list[tuple[int, Message]] = []
    for note, jitter in zip(notes, jitters):
        start_ms = offset_ms + jitter
        duration_ms = config.duration_ms
        if config.duration_jitter_ms:
            duration_ms += rng.randint(-config.duration_jitter_ms, config.duration_jitter_ms)
            duration_ms = max(120, duration_ms)

        velocity = config.velocity
        if config.velocity_jitter:
            velocity += rng.randint(-config.velocity_jitter, config.velocity_jitter)
        velocity = max(1, min(127, velocity))

        start_tick = ms_to_ticks(start_ms, midi.ticks_per_beat, tempo)
        duration_tick = ms_to_ticks(duration_ms, midi.ticks_per_beat, tempo)

        events.append((start_tick, Message("note_on", note=note, velocity=velocity, time=0)))
        events.append(
            (start_tick + duration_tick, Message("note_off", note=note, velocity=0, time=0))
        )

    events.sort(key=lambda item: (item[0], 0 if item[1].type == "note_on" else 1))
    last_tick = 0
    for tick, msg in events:
        msg.time = tick - last_tick
        track.append(msg)
        last_tick = tick

    midi.save(midi_path)


def render_audio(soundfont: str, midi_path: Path, output_path: Path, sample_rate: int) -> None:
    command = [
        "fluidsynth",
        "-ni",
        soundfont,
        str(midi_path),
        "-F",
        str(output_path),
        "-r",
        str(sample_rate),
    ]
    subprocess.run(command, check=True, capture_output=True)


def transcode_to_mp3(source_wav: Path, target_mp3: Path, bitrate: str) -> None:
    command = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(source_wav),
        "-codec:a",
        "libmp3lame",
        "-b:a",
        bitrate,
        str(target_mp3),
    ]
    subprocess.run(command, check=True, capture_output=True)


def process_task(
    task: RenderTask,
    config: RenderConfig,
    soundfont: str,
    midi_only: bool,
    mp3_bitrate: str,
    keep_wav: bool,
) -> None:
    rng = random.Random(task.seed)
    build_midi(task.midi_path, task.notes, rng, config)
    if midi_only:
        return

    if config.output_format == "mp3":
        wav_path = task.audio_path.with_suffix(".wav")
        render_audio(soundfont, task.midi_path, wav_path, config.sample_rate)
        transcode_to_mp3(wav_path, task.audio_path, mp3_bitrate)
        if not keep_wav:
            wav_path.unlink(missing_ok=True)
    else:
        render_audio(soundfont, task.midi_path, task.audio_path, config.sample_rate)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Eguchi chord audio packs.")
    parser.add_argument(
        "--out-dir",
        default="frontend/assets/audio",
        help="Base output directory for generated packs.",
    )
    parser.add_argument(
        "--pack-name",
        default="",
        help="Output pack name (default: auto timestamp).",
    )
    parser.add_argument(
        "--soundfont",
        default="",
        help="Path to a .sf2 soundfont (required unless --midi-only).",
    )
    parser.add_argument(
        "--octaves",
        nargs="+",
        type=int,
        default=[3, 4, 5],
        help="Octaves to generate (default: 3 4 5).",
    )
    parser.add_argument(
        "--variants",
        type=int,
        default=8,
        help="Variants per chord per octave (default: 8).",
    )
    parser.add_argument("--bpm", type=int, default=120, help="Tempo in BPM (default: 120).")
    parser.add_argument(
        "--duration-ms",
        type=int,
        default=1200,
        help="Chord duration in milliseconds (default: 1200).",
    )
    parser.add_argument(
        "--duration-jitter-ms",
        type=int,
        default=120,
        help="Duration jitter in milliseconds (default: 120).",
    )
    parser.add_argument(
        "--start-jitter-ms",
        type=int,
        default=25,
        help="Note start jitter in milliseconds (default: 25).",
    )
    parser.add_argument("--velocity", type=int, default=90, help="Base velocity (default: 90).")
    parser.add_argument(
        "--velocity-jitter",
        type=int,
        default=10,
        help="Velocity jitter (default: 10).",
    )
    parser.add_argument(
        "--sample-rate",
        type=int,
        default=44100,
        help="Sample rate for rendering (default: 44100).",
    )
    parser.add_argument(
        "--format",
        dest="output_format",
        default="wav",
        choices=["wav", "mp3"],
        help="Output format (default: wav).",
    )
    parser.add_argument(
        "--mp3-bitrate",
        default="192k",
        help="MP3 bitrate (default: 192k).",
    )
    parser.add_argument(
        "--midi-only",
        action="store_true",
        help="Generate MIDI files only (skip audio rendering).",
    )
    parser.add_argument(
        "--keep-wav",
        action="store_true",
        help="Keep intermediate WAV files when outputting MP3.",
    )
    parser.add_argument(
        "--jobs",
        type=int,
        default=1,
        help="Parallel workers to render audio (default: 1).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed for reproducible variants.",
    )
    parser.add_argument(
        "--chords",
        nargs="+",
        default=[],
        help="Override chord labels (default: built-in list).",
    )

    args = parser.parse_args()

    if not args.midi_only and not args.soundfont:
        print("Missing --soundfont. Provide a .sf2 file or use --midi-only.")
        return 1

    if not args.midi_only and shutil.which("fluidsynth") is None:
        print("fluidsynth is not installed or not on PATH.")
        print("Install it or use --midi-only to generate MIDI files.")
        return 1
    if not args.midi_only and args.output_format == "mp3" and shutil.which("ffmpeg") is None:
        print("ffmpeg is required for MP3 output but was not found on PATH.")
        print("Install ffmpeg or use --format wav.")
        return 1

    chords = args.chords or DEFAULT_CHORD_LABELS
    pack_name = args.pack_name or datetime.now(timezone.utc).strftime("eguchi-pack-%Y%m%d-%H%M")

    config = RenderConfig(
        variants=args.variants,
        octaves=args.octaves,
        bpm=args.bpm,
        duration_ms=args.duration_ms,
        duration_jitter_ms=args.duration_jitter_ms,
        start_jitter_ms=args.start_jitter_ms,
        velocity=args.velocity,
        velocity_jitter=args.velocity_jitter,
        sample_rate=args.sample_rate,
        output_format=args.output_format,
    )

    rng = random.Random(args.seed)
    base_dir = Path(args.out_dir)
    pack_dir = base_dir / pack_name
    audio_dir = pack_dir / "audio"
    midi_dir = pack_dir / "midi"
    audio_dir.mkdir(parents=True, exist_ok=True)
    midi_dir.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, object] = {
        "pack": pack_name,
        "format": None if args.midi_only else config.output_format,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "chords": chords,
        "octaves": config.octaves,
        "variants": config.variants,
        "files": [],
    }

    tasks: list[RenderTask] = []
    for label in chords:
        for octave in config.octaves:
            notes = chord_to_midi_notes(label, octave)
            for variant in range(1, config.variants + 1):
                filename = f"{label}__o-{octave}__v-{variant:02d}"
                midi_path = midi_dir / f"{filename}.mid"
                audio_path = audio_dir / f"{filename}.{config.output_format}"
                seed = rng.randint(0, 2**31 - 1)

                tasks.append(
                    RenderTask(
                        chord=label,
                        octave=octave,
                        variant=variant,
                        midi_path=midi_path,
                        audio_path=audio_path,
                        notes=notes,
                        seed=seed,
                    )
                )

                manifest["files"].append(
                    {
                        "chord": label,
                        "octave": octave,
                        "variant": variant,
                        "midiFile": f"midi/{filename}.mid",
                        "audioFile": None if args.midi_only else f"audio/{filename}.{config.output_format}",
                    }
                )

    jobs = max(1, args.jobs)
    if jobs == 1:
        for task in tasks:
            process_task(
                task,
                config,
                args.soundfont,
                args.midi_only,
                args.mp3_bitrate,
                args.keep_wav,
            )
    else:
        with ThreadPoolExecutor(max_workers=jobs) as executor:
            futures = [
                executor.submit(
                    process_task,
                    task,
                    config,
                    args.soundfont,
                    args.midi_only,
                    args.mp3_bitrate,
                    args.keep_wav,
                )
                for task in tasks
            ]
            for future in as_completed(futures):
                future.result()

    manifest_path = pack_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"Generated {len(tasks)} variants in {pack_dir}")
    if args.midi_only:
        print("Audio not rendered. Re-run with --soundfont and fluidsynth installed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
