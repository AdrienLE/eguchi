import { ORDERED_CHORD_IDS } from '@/lib/eguchi/chords';
import {
  getNextLevelProgress,
  lockLastUnlockedLevel,
  maybeApplyAutoUnlock,
  sanitizeAutoUnlockConfig,
  unlockNextLevelManually,
} from '@/lib/eguchi/progression';
import { createDefaultEguchiProgress, recordTrial } from '@/lib/eguchi/progress';

describe('eguchi progression', () => {
  test('sanitizeAutoUnlockConfig clamps settings to valid ranges', () => {
    const sanitized = sanitizeAutoUnlockConfig({
      autoUnlockEnabled: true,
      perfectDaysRequired: 0,
      dailyAttemptTarget: 999,
    });

    expect(sanitized.perfectDaysRequired).toBe(1);
    expect(sanitized.dailyAttemptTarget).toBe(100);
  });

  test('getNextLevelProgress reports next chord and streak', () => {
    const base = createDefaultEguchiProgress();
    const dayOne = new Date('2026-01-10T10:00:00.000Z');
    const dayTwo = new Date('2026-01-11T10:00:00.000Z');
    const withDayOne = recordTrial(base, {
      chordId: 'C-E-G',
      correct: true,
      timestamp: dayOne.toISOString(),
    });
    const withDayOneSecond = recordTrial(withDayOne, {
      chordId: 'F-A-C',
      correct: true,
      timestamp: dayOne.toISOString(),
    });
    const withDayTwo = recordTrial(withDayOneSecond, {
      chordId: 'F-A-C',
      correct: true,
      timestamp: dayTwo.toISOString(),
    });

    const status = getNextLevelProgress(
      withDayTwo,
      { autoUnlockEnabled: true, perfectDaysRequired: 2, dailyAttemptTarget: 1 },
      dayTwo
    );

    expect(status.currentLevel).toBe(2);
    expect(status.nextChordId).toBe(ORDERED_CHORD_IDS[2]);
    expect(status.perfectDayStreak).toBe(2);
    expect(status.canUnlockNow).toBe(true);
  });

  test('unlockNextLevelManually adds exactly one chord', () => {
    const base = createDefaultEguchiProgress();
    const next = unlockNextLevelManually(base);
    expect(next.unlockedChordIds.length).toBe(base.unlockedChordIds.length + 1);
    expect(next.unlockedChordIds[2]).toBe(ORDERED_CHORD_IDS[2]);
  });

  test('lockLastUnlockedLevel keeps at least one chord', () => {
    const base = createDefaultEguchiProgress();
    const one = {
      ...base,
      unlockedChordIds: [base.unlockedChordIds[0]],
    };
    const locked = lockLastUnlockedLevel(one);
    expect(locked).toBe(one);
  });

  test('maybeApplyAutoUnlock unlocks once and records unlock day', () => {
    const day = new Date('2026-01-12T10:00:00.000Z');
    let progress = createDefaultEguchiProgress();
    progress = recordTrial(progress, {
      chordId: 'C-E-G',
      correct: true,
      timestamp: day.toISOString(),
    });

    const first = maybeApplyAutoUnlock(
      progress,
      { autoUnlockEnabled: true, perfectDaysRequired: 1, dailyAttemptTarget: 1 },
      day
    );
    expect(first.unlocked).toBe(true);
    expect(first.progress.lastAutoUnlockDayKey).toBe('2026-01-12');

    const second = maybeApplyAutoUnlock(
      first.progress,
      { autoUnlockEnabled: true, perfectDaysRequired: 1, dailyAttemptTarget: 1 },
      day
    );
    expect(second.unlocked).toBe(false);
    expect(second.progress.unlockedChordIds.length).toBe(first.progress.unlockedChordIds.length);
  });
});
