import { DEFAULT_UNLOCKED_CHORD_IDS, ORDERED_CHORD_IDS } from '@/lib/eguchi/chords';
import {
  MAX_TRIAL_HISTORY,
  MAX_UNLOCKED_CHORD_COUNT,
  MIN_UNLOCKED_CHORD_COUNT,
  createDefaultEguchiProgress,
  getDayKey,
  getProgressSnapshot,
  loadEguchiProgress,
  recordTrial,
  rebuildProgressWithTrialHistory,
  type EguchiTrialRecord,
  resetEguchiProgress,
  saveEguchiProgress,
  setChordUnlocked,
  setUnlockedLevel,
} from '@/lib/eguchi/progress';
import { getNextLevelProgress } from '@/lib/eguchi/progression';
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

describe('eguchi progress', () => {
  test('default progress starts with default unlocked chords', () => {
    const progress = createDefaultEguchiProgress();
    expect(progress.unlockedChordIds).toEqual(DEFAULT_UNLOCKED_CHORD_IDS);
    expect(progress.trialHistory).toEqual([]);
    expect(progress.dailySummaries).toEqual({});
    expect(progress.lastAutoUnlockDayKey).toBe(null);
  });

  test('recordTrial updates trial history and daily summaries', () => {
    const now = new Date('2026-01-11T10:30:00.000Z');
    const dayKey = getDayKey(now);
    const progress = createDefaultEguchiProgress();

    const withCorrect = recordTrial(progress, {
      chordId: 'C-E-G',
      correct: true,
      timestamp: now.toISOString(),
    });
    const withIncorrect = recordTrial(withCorrect, {
      chordId: 'F-A-C',
      correct: false,
      timestamp: now.toISOString(),
    });

    expect(withIncorrect.trialHistory.length).toBe(2);
    expect(withIncorrect.trialHistory[0].id).toEqual(expect.any(String));
    expect(withIncorrect.trialHistory[1].id).toEqual(expect.any(String));
    expect(withIncorrect.dailySummaries[dayKey]).toEqual({ attempts: 2, correct: 1 });
  });

  test('recordTrial accepts a caller-provided id for durable sync', () => {
    const progress = createDefaultEguchiProgress();

    const next = recordTrial(progress, {
      id: 'trial-123',
      chordId: 'C-E-G',
      correct: true,
      timestamp: '2026-01-11T10:30:00.000Z',
    });

    expect(next.trialHistory[0].id).toBe('trial-123');
  });

  test('recordTrial tracks independent, assisted, and corrected outcomes', () => {
    const timestamp = '2026-01-11T10:30:00.000Z';
    let progress = createDefaultEguchiProgress();
    progress = recordTrial(progress, {
      chordId: 'C-E-G',
      correct: true,
      outcome: 'independent',
      promptDelayMs: 1500,
      timestamp,
    });
    progress = recordTrial(progress, {
      chordId: 'C-E-G',
      correct: true,
      outcome: 'assisted',
      promptDelayMs: 0,
      timestamp,
    });
    progress = recordTrial(progress, {
      chordId: 'C-E-G',
      correct: false,
      outcome: 'corrected',
      promptDelayMs: null,
      timestamp,
    });

    const snapshot = getProgressSnapshot(progress, new Date(timestamp));
    expect(snapshot.todayIndependent).toBe(1);
    expect(snapshot.todayAssisted).toBe(1);
    expect(snapshot.todayCorrected).toBe(1);
    expect(
      progress.trialHistory.find(trial => trial.outcome === 'independent')?.promptDelayMs
    ).toBe(1500);
  });

  test('recordTrial compacts old detail while retaining lifetime totals', () => {
    let progress = createDefaultEguchiProgress();
    for (let index = 0; index < MAX_TRIAL_HISTORY + 5; index += 1) {
      progress = recordTrial(progress, {
        chordId: 'C-E-G',
        correct: true,
        timestamp: new Date(2026, 0, 1, 0, 0, index).toISOString(),
      });
    }

    expect(progress.trialHistory.length).toBe(MAX_TRIAL_HISTORY);
    expect(progress.archivedTrials?.length).toBe(5);
    expect(getProgressSnapshot(progress).totalAttempts).toBe(MAX_TRIAL_HISTORY + 5);
  });

  test('setChordUnlocked preserves order and keeps at least one chord unlocked', () => {
    const defaults = createDefaultEguchiProgress();
    const withExtra = setChordUnlocked(defaults, 'G-B-D', true);
    expect(withExtra.unlockedChordIds).toEqual(['C-E-G', 'G-B-D']);

    const removedFirst = setChordUnlocked(withExtra, 'C-E-G', false);
    expect(removedFirst.unlockedChordIds).toEqual(['G-B-D']);

    const preventedEmpty = setChordUnlocked(removedFirst, 'G-B-D', false);
    expect(preventedEmpty.unlockedChordIds).toEqual(['G-B-D']);
  });

  test('setUnlockedLevel stores the ordered level prefix and clamps bounds', () => {
    const defaults = createDefaultEguchiProgress();

    const levelFive = setUnlockedLevel(defaults, 5);
    expect(levelFive.unlockedChordIds).toEqual(ORDERED_CHORD_IDS.slice(0, 5));

    const belowMinimum = setUnlockedLevel(levelFive, MIN_UNLOCKED_CHORD_COUNT - 10);
    expect(belowMinimum.unlockedChordIds).toEqual(
      ORDERED_CHORD_IDS.slice(0, MIN_UNLOCKED_CHORD_COUNT)
    );

    const aboveMaximum = setUnlockedLevel(defaults, MAX_UNLOCKED_CHORD_COUNT + 10);
    expect(aboveMaximum.unlockedChordIds).toEqual(ORDERED_CHORD_IDS);
  });

  test('loadEguchiProgress sanitizes invalid stored data', async () => {
    const now = new Date('2026-01-12T12:00:00.000Z');
    const dayKey = getDayKey(now);
    const storage = makeStorageStub({
      unlockedChordIds: ['not-a-chord'],
      trialHistory: [
        {
          chordId: 'C-E-G',
          correct: true,
          timestamp: now.toISOString(),
        },
        {
          chordId: 'C-E-G',
          correct: 'yes',
          timestamp: now.toISOString(),
        },
      ],
    });

    const loaded = await loadEguchiProgress(storage);

    expect(loaded.unlockedChordIds).toEqual(DEFAULT_UNLOCKED_CHORD_IDS);
    expect(loaded.trialHistory.length).toBe(1);
    expect(loaded.trialHistory[0].id.startsWith('legacy_')).toBe(true);
    expect(loaded.dailySummaries[dayKey]).toEqual({ attempts: 1, correct: 1 });
    expect(loaded.lastAutoUnlockDayKey).toBe(null);
  });

  test('save and reset use the eguchi storage key', async () => {
    const storage = makeStorageStub();
    const progress = createDefaultEguchiProgress();

    await saveEguchiProgress(progress, storage);
    await resetEguchiProgress(storage);

    expect(storage.setCalls.length).toBe(2);
    expect(storage.setCalls[0][0]).toBe(STORAGE_KEYS.EGUCHI_PROGRESS);
    expect(storage.setCalls[0][1]).toEqual(progress);
    expect(storage.setCalls[1][0]).toBe(STORAGE_KEYS.EGUCHI_PROGRESS);
    expect(storage.setCalls[1][1]).toEqual(createDefaultEguchiProgress());
  });

  test('getProgressSnapshot returns totals and today metrics', () => {
    const dayOne = new Date('2026-01-11T08:00:00.000Z');
    const dayTwo = new Date('2026-01-12T08:00:00.000Z');
    let progress = createDefaultEguchiProgress();
    progress = recordTrial(progress, {
      chordId: 'C-E-G',
      correct: true,
      timestamp: dayOne.toISOString(),
    });
    progress = recordTrial(progress, {
      chordId: 'C-E-G',
      correct: false,
      timestamp: dayOne.toISOString(),
    });
    progress = recordTrial(progress, {
      chordId: 'F-A-C',
      correct: true,
      timestamp: dayTwo.toISOString(),
    });

    const snapshot = getProgressSnapshot(progress, dayTwo);
    expect(snapshot.totalAttempts).toBe(3);
    expect(snapshot.totalCorrect).toBe(2);
    expect(Math.abs(snapshot.totalAccuracy - 2 / 3) < 0.00001).toBe(true);
    expect(snapshot.todayAttempts).toBe(1);
    expect(snapshot.todayCorrect).toBe(1);
  });
});

test('30 perfect days survive compaction, reload, and duplicate remote downloads', async () => {
  const trials: EguchiTrialRecord[] = Array.from({ length: 3000 }, (_, index) => ({
    id: `trial-${index}`,
    chordId: 'C-E-G',
    correct: true,
    outcome: 'independent',
    timestamp: new Date(2026, 0, 1 + Math.floor(index / 100), 12, 0, index % 100).toISOString(),
  }));
  const progress = rebuildProgressWithTrialHistory(createDefaultEguchiProgress(), trials);
  const loaded = await loadEguchiProgress(makeStorageStub(JSON.parse(JSON.stringify(progress))));
  const merged = rebuildProgressWithTrialHistory(loaded, [...loaded.trialHistory, ...trials]);
  expect(merged.trialHistory.length).toBe(2000);
  expect(merged.archivedTrials?.length).toBe(1000);
  expect(getProgressSnapshot(merged).totalAttempts).toBe(3000);
  expect(getProgressSnapshot(merged).totalIndependent).toBe(3000);
  const next = getNextLevelProgress(
    merged,
    { autoUnlockEnabled: true, dailyAttemptTarget: 100, perfectDaysRequired: 30 },
    new Date(2026, 0, 30, 14)
  );
  expect(next.perfectDayStreak).toBe(30);
  expect(next.canUnlockNow).toBe(true);
  const reset = rebuildProgressWithTrialHistory(
    merged,
    merged.trialHistory,
    new Date(2026, 0, 15, 0).toISOString()
  );
  expect(getProgressSnapshot(reset).totalAttempts).toBe(1600);
  expect(reset.archivedTrials).toEqual([]);
});
