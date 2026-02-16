import {
  createDefaultEguchiSessionPreferences,
  getEnabledImportModesLabel,
  loadEguchiSessionPreferences,
  saveEguchiSessionPreferences,
  setAutoAdvanceEnabled,
  setFeedbackSeconds,
  setImportModeEnabled,
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
    expect(defaults.feedbackSeconds).toBe(3);
  });

  test('load sanitizes invalid values', async () => {
    const storage = makeStorageStub({
      importModes: { rapid: false, blitz: false, bullet: false },
      autoAdvanceEnabled: 'yes',
      feedbackSeconds: 99,
    });

    const loaded = await loadEguchiSessionPreferences(storage);
    expect(loaded.importModes.rapid).toBe(true);
    expect(loaded.importModes.blitz).toBe(true);
    expect(loaded.importModes.bullet).toBe(false);
    expect(loaded.autoAdvanceEnabled).toBe(true);
    expect(loaded.feedbackSeconds).toBe(8);
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
    expect(low.feedbackSeconds).toBe(2);
    expect(high.feedbackSeconds).toBe(8);
  });

  test('setAutoAdvanceEnabled updates setting', () => {
    const defaults = createDefaultEguchiSessionPreferences();
    const disabled = setAutoAdvanceEnabled(defaults, false);
    expect(disabled.autoAdvanceEnabled).toBe(false);
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
