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
  headerColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
};

export const DEFAULT_PLAYROOM_BACKGROUND_ID: PlayroomBackgroundId = 'pink';

export const PLAYROOM_BACKGROUNDS: readonly PlayroomBackground[] = [
  {
    id: 'pink',
    label: 'Pink',
    color: '#FFD6E7',
    headerColor: '#F6AFC9',
    accentColor: '#D85C8D',
    surfaceColor: '#FFF5F9',
    textColor: '#522638',
  },
  {
    id: 'cloud',
    label: 'Cloud',
    color: '#F5F7F8',
    headerColor: '#DCE6EB',
    accentColor: '#617985',
    surfaceColor: '#FFFFFF',
    textColor: '#263840',
  },
  {
    id: 'sky',
    label: 'Sky',
    color: '#E7F5FF',
    headerColor: '#B9DDF5',
    accentColor: '#3B82B1',
    surfaceColor: '#F7FCFF',
    textColor: '#17394E',
  },
  {
    id: 'lavender',
    label: 'Lavender',
    color: '#EEE9FF',
    headerColor: '#D4C7F7',
    accentColor: '#7358B8',
    surfaceColor: '#FAF8FF',
    textColor: '#33265C',
  },
  {
    id: 'mint',
    label: 'Mint',
    color: '#E7F8EF',
    headerColor: '#BFE8D0',
    accentColor: '#3F8D61',
    surfaceColor: '#F7FDF9',
    textColor: '#1F4730',
  },
  {
    id: 'sunshine',
    label: 'Sunshine',
    color: '#FFF4D3',
    headerColor: '#F4D98E',
    accentColor: '#A97619',
    surfaceColor: '#FFFCF2',
    textColor: '#513A0F',
  },
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
