import { CHORD_CURRICULUM } from '../foundation/curriculum';
type EguchiChordDefinition = {
  id: string;
  label: string;
  color: { name: string; hex: string };
  animal: string;
};

export const EGUCHI_CHORDS = CHORD_CURRICULUM.map(chord => ({
  id: chord.id,
  label: chord.id,
  color: { name: chord.color, hex: chord.hex },
  animal: chord.animal,
})) satisfies ReadonlyArray<EguchiChordDefinition>;

export type EguchiChordId = (typeof EGUCHI_CHORDS)[number]['id'];
export type EguchiChord = (typeof EGUCHI_CHORDS)[number];

export const ORDERED_CHORD_IDS: EguchiChordId[] = EGUCHI_CHORDS.map(chord => chord.id);
export const DEFAULT_UNLOCKED_CHORD_IDS: EguchiChordId[] = [ORDERED_CHORD_IDS[0]];
export const DEFAULT_START_SET_IDS = DEFAULT_UNLOCKED_CHORD_IDS;

export const CHORD_BY_ID = Object.fromEntries(
  EGUCHI_CHORDS.map(chord => [chord.id, chord])
) as Record<EguchiChordId, EguchiChord>;

export const isValidChordId = (id: string): id is EguchiChordId => id in CHORD_BY_ID;
