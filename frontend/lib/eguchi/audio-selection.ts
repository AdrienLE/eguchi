import { AUDIO_PACK_FILES_BY_CHORD, type AudioEntry } from './audio-pack';
import type { EguchiChordId } from './chords';

const AUDIO_FILE_METADATA_PATTERN = /__o-(\d+)__v-(\d+)\.[A-Za-z0-9]+$/;

export type AudioEntryMetadata = {
  octave: number;
  variant: number;
};

export const getAudioEntryMetadata = (entry: AudioEntry): AudioEntryMetadata | null => {
  const match = AUDIO_FILE_METADATA_PATTERN.exec(entry.fileName);
  if (!match) {
    return null;
  }
  return {
    octave: Number.parseInt(match[1], 10),
    variant: Number.parseInt(match[2], 10),
  };
};

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

export const pickTrainingAudioEntry = (
  chordId: EguchiChordId,
  options: {
    octaves: number[];
    randomValue?: number;
    entries?: AudioEntry[];
  }
): AudioEntry | null => {
  const sourceEntries = options.entries ?? AUDIO_PACK_FILES_BY_CHORD[chordId] ?? [];
  if (!sourceEntries.length) {
    return null;
  }

  const allowedOctaves = new Set(options.octaves);
  const eligibleEntries = sourceEntries.filter(entry => {
    const metadata = getAudioEntryMetadata(entry);
    return metadata ? allowedOctaves.has(metadata.octave) : false;
  });
  const entries = eligibleEntries.length ? eligibleEntries : sourceEntries;
  const normalizedRandom = clampUnit(options.randomValue ?? Math.random());
  const index = Math.min(entries.length - 1, Math.floor(normalizedRandom * entries.length));
  return entries[index];
};
