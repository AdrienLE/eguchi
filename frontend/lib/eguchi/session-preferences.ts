import { storage, STORAGE_KEYS, type StorageService } from '@/lib/storage';

export const IMPORT_SPEEDS = ['rapid', 'blitz', 'bullet'] as const;
export type ImportSpeed = (typeof IMPORT_SPEEDS)[number];

export const IMPORT_SPEED_LABELS: Record<ImportSpeed, string> = {
  rapid: 'Rapid',
  blitz: 'Blitz',
  bullet: 'Bullet',
};

export type EguchiSessionPreferences = {
  sourcePreset: 'sunny-pond-lost';
  importModes: Record<ImportSpeed, boolean>;
  autoAdvanceEnabled: boolean;
  feedbackSeconds: number;
};

const DEFAULT_IMPORT_MODES: Record<ImportSpeed, boolean> = {
  rapid: true,
  blitz: true,
  bullet: false,
};

const normalizeImportModes = (candidate: unknown): Record<ImportSpeed, boolean> => {
  if (!candidate || typeof candidate !== 'object') {
    return { ...DEFAULT_IMPORT_MODES };
  }

  const maybeModes = candidate as Partial<Record<ImportSpeed, unknown>>;
  const normalized: Record<ImportSpeed, boolean> = {
    rapid: Boolean(maybeModes.rapid),
    blitz: Boolean(maybeModes.blitz),
    bullet: Boolean(maybeModes.bullet),
  };

  const enabledCount = IMPORT_SPEEDS.filter(mode => normalized[mode]).length;
  if (!enabledCount) {
    return { ...DEFAULT_IMPORT_MODES };
  }
  return normalized;
};

const normalizeFeedbackSeconds = (candidate: unknown): number => {
  if (typeof candidate !== 'number' || Number.isNaN(candidate)) {
    return 3;
  }
  return Math.min(8, Math.max(2, Math.round(candidate)));
};

export const createDefaultEguchiSessionPreferences = (): EguchiSessionPreferences => ({
  sourcePreset: 'sunny-pond-lost',
  importModes: { ...DEFAULT_IMPORT_MODES },
  autoAdvanceEnabled: true,
  feedbackSeconds: 3,
});

export const loadEguchiSessionPreferences = async (
  storageService: StorageService = storage
): Promise<EguchiSessionPreferences> => {
  const stored = await storageService.get<Partial<EguchiSessionPreferences>>(
    STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES
  );
  if (!stored) {
    return createDefaultEguchiSessionPreferences();
  }

  return {
    sourcePreset: 'sunny-pond-lost',
    importModes: normalizeImportModes(stored.importModes),
    autoAdvanceEnabled:
      typeof stored.autoAdvanceEnabled === 'boolean' ? stored.autoAdvanceEnabled : true,
    feedbackSeconds: normalizeFeedbackSeconds(stored.feedbackSeconds),
  };
};

export const saveEguchiSessionPreferences = async (
  preferences: EguchiSessionPreferences,
  storageService: StorageService = storage
) => {
  await storageService.set(STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES, preferences);
};

export const setImportModeEnabled = (
  preferences: EguchiSessionPreferences,
  mode: ImportSpeed,
  enabled: boolean
): EguchiSessionPreferences => {
  const nextModes = {
    ...preferences.importModes,
    [mode]: enabled,
  };

  const enabledCount = IMPORT_SPEEDS.filter(item => nextModes[item]).length;
  if (!enabledCount) {
    return preferences;
  }

  return {
    ...preferences,
    importModes: nextModes,
  };
};

export const setAutoAdvanceEnabled = (
  preferences: EguchiSessionPreferences,
  enabled: boolean
): EguchiSessionPreferences => ({
  ...preferences,
  autoAdvanceEnabled: enabled,
});

export const setFeedbackSeconds = (
  preferences: EguchiSessionPreferences,
  feedbackSeconds: number
): EguchiSessionPreferences => ({
  ...preferences,
  feedbackSeconds: normalizeFeedbackSeconds(feedbackSeconds),
});

export const getEnabledImportModes = (preferences: EguchiSessionPreferences): ImportSpeed[] =>
  IMPORT_SPEEDS.filter(mode => preferences.importModes[mode]);

export const getEnabledImportModesLabel = (preferences: EguchiSessionPreferences): string => {
  const modes = getEnabledImportModes(preferences);
  if (!modes.length) {
    return IMPORT_SPEED_LABELS.rapid;
  }
  return modes.map(mode => IMPORT_SPEED_LABELS[mode]).join(' + ');
};
