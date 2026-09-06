/** Eguchi's chord sequence and flag colors, written directly in English notation. */
export const CHORD_CURRICULUM = [
  {
    id: 'C-E-G',
    notes: ['C4', 'E4', 'G4'],
    midi: [60, 64, 67],
    color: 'Red',
    hex: '#E53935',
    animal: 'Fox',
    slug: 'fox',
  },
  {
    id: 'C-F-A',
    notes: ['C4', 'F4', 'A4'],
    midi: [60, 65, 69],
    color: 'Yellow',
    hex: '#F5CC36',
    animal: 'Chick',
    slug: 'chick',
  },
  {
    id: 'B-D-G',
    notes: ['B3', 'D4', 'G4'],
    midi: [59, 62, 67],
    color: 'Blue',
    hex: '#2877D4',
    animal: 'Whale',
    slug: 'whale',
  },
  {
    id: 'A-C-F',
    notes: ['A3', 'C4', 'F4'],
    midi: [57, 60, 65],
    color: 'Black',
    hex: '#303039',
    animal: 'Cat',
    slug: 'cat',
  },
  {
    id: 'D-G-B',
    notes: ['D4', 'G4', 'B4'],
    midi: [62, 67, 71],
    color: 'Green',
    hex: '#439850',
    animal: 'Frog',
    slug: 'frog',
  },
  {
    id: 'E-G-C',
    notes: ['E4', 'G4', 'C5'],
    midi: [64, 67, 72],
    color: 'Orange',
    hex: '#EF8C2B',
    animal: 'Tiger',
    slug: 'tiger',
  },
  {
    id: 'F-A-C',
    notes: ['F4', 'A4', 'C5'],
    midi: [65, 69, 72],
    color: 'Purple',
    hex: '#9554B6',
    animal: 'Octopus',
    slug: 'octopus',
  },
  {
    id: 'G-B-D',
    notes: ['G4', 'B4', 'D5'],
    midi: [67, 71, 74],
    color: 'Pink',
    hex: '#E981AC',
    animal: 'Flamingo',
    slug: 'flamingo',
  },
  {
    id: 'G-C-E',
    notes: ['G4', 'C5', 'E5'],
    midi: [67, 72, 76],
    color: 'Brown',
    hex: '#936044',
    animal: 'Bear',
    slug: 'bear',
  },
  {
    id: 'A-C#-E',
    notes: ['A3', 'C♯4', 'E4'],
    midi: [57, 61, 64],
    color: 'Light green',
    hex: '#A0C956',
    animal: 'Parrot',
    slug: 'parrot',
  },
  {
    id: 'D-F#-A',
    notes: ['D4', 'F♯4', 'A4'],
    midi: [62, 66, 69],
    color: 'Peach',
    hex: '#F1B28F',
    animal: 'Pig',
    slug: 'pig',
  },
  {
    id: 'E-G#-B',
    notes: ['E4', 'G♯4', 'B4'],
    midi: [64, 68, 71],
    color: 'Lavender',
    hex: '#B49BCC',
    animal: 'Butterfly',
    slug: 'butterfly',
  },
  {
    id: 'Bb-D-F',
    notes: ['B♭3', 'D4', 'F4'],
    midi: [58, 62, 65],
    color: 'Gray',
    hex: '#9EA8B1',
    animal: 'Seal',
    slug: 'seal',
  },
  {
    id: 'Eb-G-Bb',
    notes: ['E♭4', 'G4', 'B♭4'],
    midi: [63, 67, 70],
    color: 'Light blue',
    hex: '#8ACDE9',
    animal: 'Fish',
    slug: 'fish',
  },
] as const;
export type ChordId = (typeof CHORD_CURRICULUM)[number]['id'];
export type CurriculumChord = (typeof CHORD_CURRICULUM)[number];
export const CURRICULUM_BY_ID = Object.fromEntries(
  CHORD_CURRICULUM.map(chord => [chord.id, chord])
) as Record<ChordId, CurriculumChord>;
export const curriculumThrough = (stage: number): ChordId[] =>
  CHORD_CURRICULUM.slice(0, Math.max(1, Math.min(14, stage))).map(chord => chord.id);
export const sessionTarget = (active: readonly ChordId[]) => (active.length <= 2 ? 10 : 30);
/** A balanced randomized set; introducing mode presents the newest cue only a few times. */
export const planPresentations = (
  active: readonly ChordId[],
  introduction: ChordId | null,
  random: () => number = Math.random
): ChordId[] => {
  const choices = [...new Set(active)];
  if (!choices.length) throw new Error('Choose at least one animal.');
  const target = sessionTarget(choices);
  const familiar = choices.filter(id => id !== introduction);
  const newer =
    introduction && choices.includes(introduction) && familiar.length ? introduction : null;
  const newCount = newer ? (target === 10 ? 2 : 3) : 0;
  const pool = newer ? familiar : choices;
  const plan: ChordId[] = newer ? Array.from({ length: newCount }, () => newer) : [];
  const shuffled = [...pool]; // Copy before a Fisher–Yates shuffle; do not mutate configuration.
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (let i = 0; plan.length < target; i++) plan.push(shuffled[i % shuffled.length]);
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }
  return plan;
};
