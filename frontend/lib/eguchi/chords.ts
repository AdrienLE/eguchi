type EguchiChordDefinition = {
  id: string;
  label: string;
  color: { name: string; hex: string };
  animal: string;
};

export const EGUCHI_CHORDS = [
  {
    id: 'C-E-G',
    label: 'C-E-G',
    color: { name: 'Red', hex: '#E53935' },
    animal: 'Fox',
  },
  {
    id: 'F-A-C',
    label: 'F-A-C',
    color: { name: 'Blue', hex: '#1E88E5' },
    animal: 'Whale',
  },
  {
    id: 'G-B-D',
    label: 'G-B-D',
    color: { name: 'Green', hex: '#43A047' },
    animal: 'Frog',
  },
  {
    id: 'E-G-C',
    label: 'E-G-C',
    color: { name: 'Orange', hex: '#FB8C00' },
    animal: 'Tiger',
  },
  {
    id: 'A-C-F',
    label: 'A-C-F',
    color: { name: 'Purple', hex: '#8E24AA' },
    animal: 'Octopus',
  },
  {
    id: 'B-D-G',
    label: 'B-D-G',
    color: { name: 'Yellow', hex: '#FDD835' },
    animal: 'Chick',
  },
  {
    id: 'G-C-E',
    label: 'G-C-E',
    color: { name: 'Pink', hex: '#EC407A' },
    animal: 'Bunny',
  },
  {
    id: 'C-F-A',
    label: 'C-F-A',
    color: { name: 'Teal', hex: '#00897B' },
    animal: 'Turtle',
  },
  {
    id: 'D-G-B',
    label: 'D-G-B',
    color: { name: 'Indigo', hex: '#3949AB' },
    animal: 'Bluebird',
  },
  {
    id: 'A-C#-E',
    label: 'A-C#-E',
    color: { name: 'Gold', hex: '#FBC02D' },
    animal: 'Lion',
  },
  {
    id: 'D-F#-A',
    label: 'D-F#-A',
    color: { name: 'Lime', hex: '#C0CA33' },
    animal: 'Parrot',
  },
  {
    id: 'E-G#-B',
    label: 'E-G#-B',
    color: { name: 'Cyan', hex: '#00ACC1' },
    animal: 'Fish',
  },
  {
    id: 'Bb-D-F',
    label: 'Bb-D-F',
    color: { name: 'Silver', hex: '#B0BEC5' },
    animal: 'Seal',
  },
  {
    id: 'Eb-G-Bb',
    label: 'Eb-G-Bb',
    color: { name: 'Coral', hex: '#FF7043' },
    animal: 'Crab',
  },
] as const satisfies ReadonlyArray<EguchiChordDefinition>;

export type EguchiChordId = (typeof EGUCHI_CHORDS)[number]['id'];
export type EguchiChord = (typeof EGUCHI_CHORDS)[number];

export const ORDERED_CHORD_IDS: EguchiChordId[] = EGUCHI_CHORDS.map(chord => chord.id);
export const DEFAULT_UNLOCKED_CHORD_IDS: EguchiChordId[] = [
  ORDERED_CHORD_IDS[0],
  ORDERED_CHORD_IDS[1],
];
export const DEFAULT_START_SET_IDS = DEFAULT_UNLOCKED_CHORD_IDS;

export const CHORD_BY_ID = Object.fromEntries(
  EGUCHI_CHORDS.map(chord => [chord.id, chord])
) as Record<EguchiChordId, EguchiChord>;

export const isValidChordId = (id: string): id is EguchiChordId => id in CHORD_BY_ID;
