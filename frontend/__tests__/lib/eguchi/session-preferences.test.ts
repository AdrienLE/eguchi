import {
  createDefaultEguchiSessionPreferences,
  getEnabledImportModesLabel,
  loadEguchiSessionPreferences,
  saveEguchiSessionPreferences,
  setAutoAdvanceEnabled,
  setAutoUnlockEnabled,
  setDailyAttemptTarget,
  setFeedbackSeconds,
  setImportModeEnabled,
  setPerfectDaysRequired,
  type EguchiSessionPreferences,
} from '@/lib/eguchi/session-preferences';
import { STORAGE_KEYS, type StorageService } from '@/lib/storage';

type StorageStub = StorageService & {
  setCalls: Array<[string, unknown]>;
};

const makeStorageStub = (storedValue: unknown = null): StorageStub => {
  const setCalls: Array<[string, unknown]> = [];
  return {
    setCalls,
    get: async () => storedValue as any,
    set: async (key, value) => {
      setCalls.push([key, value]);
    },
    remove: async () => undefined,
    clear: async () => undefined,
    getAllKeys: async () => [],
  };
};

describe('eguchi session preferences', () => {
  test('default preferences include rapid and blitz', () => {
    const defaults = createDefaultEguchiSessionPreferences();
    expect(defaults.importModes.rapid).toBe(true);
    expect(defaults.importModes.blitz).toBe(true);
    expect(defaults.importModes.bullet).toBe(false);
    expect(defaults.autoAdvanceEnabled).toBe(true);
    expect(defaults.feedbackSeconds).toBe(2);
    expect(defaults.autoUnlockEnabled).toBe(false);
    expect(defaults.perfectDaysRequired).toBe(14);
    expect(defaults.dailyAttemptTarget).toBe(100);
  });

  test('load sanitizes invalid values', async () => {
    const storage = makeStorageStub({
      importModes: { rapid: false, blitz: false, bullet: false },
      autoAdvanceEnabled: 'yes',
      feedbackSeconds: 99,
      autoUnlockEnabled: 'yes',
      perfectDaysRequired: 0,
      dailyAttemptTarget: 200,
    });

    const loaded = await loadEguchiSessionPreferences(storage);
    expect(loaded.importModes.rapid).toBe(true);
    expect(loaded.importModes.blitz).toBe(true);
    expect(loaded.importModes.bullet).toBe(false);
    expect(loaded.autoAdvanceEnabled).toBe(true);
    expect(loaded.feedbackSeconds).toBe(8);
    expect(loaded.autoUnlockEnabled).toBe(false);
    expect(loaded.perfectDaysRequired).toBe(1);
    expect(loaded.dailyAttemptTarget).toBe(100);
  });

  test('setImportModeEnabled keeps at least one mode enabled', () => {
    const defaults = createDefaultEguchiSessionPreferences();
    const rapidOnly = setImportModeEnabled(defaults, 'blitz', false);
    expect(rapidOnly.importModes.rapid).toBe(true);
    expect(rapidOnly.importModes.blitz).toBe(false);

    const blocked = setImportModeEnabled(rapidOnly, 'rapid', false);
    expect(blocked).toBe(rapidOnly);
  });

  test('setFeedbackSeconds clamps range', () => {
    const defaults = createDefaultEguchiSessionPreferences();
    const low = setFeedbackSeconds(defaults, 1);
    const high = setFeedbackSeconds(defaults, 20);
    expect(low.feedbackSeconds).toBe(1);
    expect(high.feedbackSeconds).toBe(8);
  });

  test('setAutoAdvanceEnabled updates setting', () => {
    const defaults = createDefaultEguchiSessionPreferences();
    const disabled = setAutoAdvanceEnabled(defaults, false);
    expect(disabled.autoAdvanceEnabled).toBe(false);
  });

  test('auto unlock setters clamp and update', () => {
    const defaults = createDefaultEguchiSessionPreferences();
    const enabled = setAutoUnlockEnabled(defaults, true);
    const days = setPerfectDaysRequired(enabled, 99);
    const attempts = setDailyAttemptTarget(days, 0);
    expect(enabled.autoUnlockEnabled).toBe(true);
    expect(days.perfectDaysRequired).toBe(30);
    expect(attempts.dailyAttemptTarget).toBe(1);
  });

  test('save writes to expected storage key', async () => {
    const storage = makeStorageStub();
    const preferences = createDefaultEguchiSessionPreferences();
    await saveEguchiSessionPreferences(preferences, storage);
    expect(storage.setCalls.length).toBe(1);
    expect(storage.setCalls[0][0]).toBe(STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES);
    expect(storage.setCalls[0][1]).toEqual(preferences);
  });

  test('enabled import mode label joins checked modes', () => {
    const preferences: EguchiSessionPreferences = {
      ...createDefaultEguchiSessionPreferences(),
      importModes: { rapid: true, blitz: false, bullet: true },
    };
    expect(getEnabledImportModesLabel(preferences)).toBe('Rapid + Bullet');
  });
});
