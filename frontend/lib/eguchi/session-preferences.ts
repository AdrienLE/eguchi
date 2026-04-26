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
  autoUnlockEnabled: boolean;
  perfectDaysRequired: number;
  dailyAttemptTarget: number;
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
    return 2;
  }
  const normalized = Math.round(candidate / 0.25) * 0.25;
  return Math.min(8, Math.max(0.25, normalized));
};

const normalizePerfectDaysRequired = (candidate: unknown): number => {
  if (typeof candidate !== 'number' || Number.isNaN(candidate)) {
    return 14;
  }
  return Math.min(30, Math.max(1, Math.round(candidate)));
};

const normalizeDailyAttemptTarget = (candidate: unknown): number => {
  if (typeof candidate !== 'number' || Number.isNaN(candidate)) {
    return 100;
  }
  return Math.min(100, Math.max(1, Math.round(candidate)));
};

export const createDefaultEguchiSessionPreferences = (): EguchiSessionPreferences => ({
  sourcePreset: 'sunny-pond-lost',
  importModes: { ...DEFAULT_IMPORT_MODES },
  autoAdvanceEnabled: true,
  feedbackSeconds: 2,
  autoUnlockEnabled: false,
  perfectDaysRequired: 14,
  dailyAttemptTarget: 100,
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
    autoUnlockEnabled:
      typeof stored.autoUnlockEnabled === 'boolean' ? stored.autoUnlockEnabled : false,
    perfectDaysRequired: normalizePerfectDaysRequired(stored.perfectDaysRequired),
    dailyAttemptTarget: normalizeDailyAttemptTarget(stored.dailyAttemptTarget),
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

export const setAutoUnlockEnabled = (
  preferences: EguchiSessionPreferences,
  enabled: boolean
): EguchiSessionPreferences => ({
  ...preferences,
  autoUnlockEnabled: enabled,
});

export const setPerfectDaysRequired = (
  preferences: EguchiSessionPreferences,
  perfectDaysRequired: number
): EguchiSessionPreferences => ({
  ...preferences,
  perfectDaysRequired: normalizePerfectDaysRequired(perfectDaysRequired),
});

export const setDailyAttemptTarget = (
  preferences: EguchiSessionPreferences,
  dailyAttemptTarget: number
): EguchiSessionPreferences => ({
  ...preferences,
  dailyAttemptTarget: normalizeDailyAttemptTarget(dailyAttemptTarget),
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
