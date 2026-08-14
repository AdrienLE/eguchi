export const PLAYROOM_BACKGROUND_IDS = [
  'pink',
  'cloud',
  'sky',
  'lavender',
  'mint',
  'sunshine',
] as const;

export type PlayroomBackgroundId = (typeof PLAYROOM_BACKGROUND_IDS)[number];

export type PlayroomBackground = {
  id: PlayroomBackgroundId;
  label: string;
  color: string;
};

export const DEFAULT_PLAYROOM_BACKGROUND_ID: PlayroomBackgroundId = 'pink';

export const PLAYROOM_BACKGROUNDS: readonly PlayroomBackground[] = [
  { id: 'pink', label: 'Pink', color: '#FFD6E7' },
  { id: 'cloud', label: 'Cloud', color: '#F5F7F8' },
  { id: 'sky', label: 'Sky', color: '#E7F5FF' },
  { id: 'lavender', label: 'Lavender', color: '#EEE9FF' },
  { id: 'mint', label: 'Mint', color: '#E7F8EF' },
  { id: 'sunshine', label: 'Sunshine', color: '#FFF4D3' },
];

const PLAYROOM_BACKGROUND_BY_ID = new Map(
  PLAYROOM_BACKGROUNDS.map(background => [background.id, background])
);

export const isPlayroomBackgroundId = (value: unknown): value is PlayroomBackgroundId =>
  typeof value === 'string' && PLAYROOM_BACKGROUND_IDS.includes(value as PlayroomBackgroundId);

export const normalizePlayroomBackgroundId = (value: unknown): PlayroomBackgroundId =>
  isPlayroomBackgroundId(value) ? value : DEFAULT_PLAYROOM_BACKGROUND_ID;

export const getPlayroomBackground = (id: PlayroomBackgroundId): PlayroomBackground =>
  PLAYROOM_BACKGROUND_BY_ID.get(id) ?? PLAYROOM_BACKGROUNDS[0];
