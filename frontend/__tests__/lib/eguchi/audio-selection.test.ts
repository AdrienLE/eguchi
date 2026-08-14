import { getAudioEntryMetadata, pickTrainingAudioEntry } from '@/lib/eguchi/audio-selection';
import type { AudioEntry } from '@/lib/eguchi/audio-pack';

jest.mock('@/lib/eguchi/audio-pack', () => ({
  AUDIO_PACK_FILES_BY_CHORD: {},
}));

const entries: AudioEntry[] = [
  { module: 1, fileName: 'C-E-G__o-3__v-01.mp3' },
  { module: 2, fileName: 'C-E-G__o-4__v-01.mp3' },
  { module: 3, fileName: 'C-E-G__o-4__v-02.mp3' },
  { module: 4, fileName: 'C-E-G__o-5__v-01.mp3' },
];

describe('training audio selection', () => {
  test('parses octave and variant metadata from generated filenames', () => {
    expect(getAudioEntryMetadata(entries[2])).toEqual({ octave: 4, variant: 2 });
    expect(getAudioEntryMetadata({ module: 5, fileName: 'custom.mp3' })).toBeNull();
  });

  test('limits beginner audio to the requested octave while retaining variants', () => {
    expect(pickTrainingAudioEntry('C-E-G', { octaves: [4], randomValue: 0, entries })).toBe(
      entries[1]
    );
    expect(pickTrainingAudioEntry('C-E-G', { octaves: [4], randomValue: 0.999, entries })).toBe(
      entries[2]
    );
  });

  test('supports progressive multi-octave generalization', () => {
    expect(pickTrainingAudioEntry('C-E-G', { octaves: [4, 3], randomValue: 0, entries })).toBe(
      entries[0]
    );
    expect(pickTrainingAudioEntry('C-E-G', { octaves: [4, 3], randomValue: 0.999, entries })).toBe(
      entries[2]
    );
  });

  test('falls back to the source pack when metadata does not match', () => {
    expect(pickTrainingAudioEntry('C-E-G', { octaves: [9], randomValue: 0, entries })).toBe(
      entries[0]
    );
    expect(pickTrainingAudioEntry('C-E-G', { octaves: [4], entries: [] })).toBeNull();
  });
});
