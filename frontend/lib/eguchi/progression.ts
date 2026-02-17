import { CHORD_BY_ID, ORDERED_CHORD_IDS, type EguchiChordId } from './chords';
import { getDayKey, type EguchiDailySummary, type EguchiProgress } from './progress';

export type AutoUnlockConfig = {
  autoUnlockEnabled: boolean;
  perfectDaysRequired: number;
  dailyAttemptTarget: number;
};

export type NextLevelProgress = {
  currentLevel: number;
  totalLevels: number;
  nextChordId: EguchiChordId | null;
  nextChordAnimal: string | null;
  isMaxLevel: boolean;
  perfectDayStreak: number;
  perfectDaysRequired: number;
  dailyAttemptTarget: number;
  daysRemaining: number;
  canUnlockNow: boolean;
  todaySummary: EguchiDailySummary;
  isTodayPerfect: boolean;
};

const clampInteger = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(value)));

const isPerfectDay = (summary: EguchiDailySummary, dailyAttemptTarget: number) =>
  summary.attempts >= dailyAttemptTarget && summary.correct === summary.attempts;

const formatDayKey = (date: Date) => getDayKey(date);

const previousDay = (date: Date) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - 1);
  return copy;
};

const calculatePerfectDayStreak = (
  dailySummaries: Record<string, EguchiDailySummary>,
  dailyAttemptTarget: number,
  referenceDate: Date,
  stopAtDayKeyExclusive: string | null
) => {
  let streak = 0;
  let cursor = new Date(referenceDate);

  while (true) {
    const dayKey = formatDayKey(cursor);
    if (stopAtDayKeyExclusive && dayKey <= stopAtDayKeyExclusive) {
      break;
    }

    const summary = dailySummaries[dayKey];
    if (!summary || !isPerfectDay(summary, dailyAttemptTarget)) {
      break;
    }

    streak += 1;
    cursor = previousDay(cursor);
  }

  return streak;
};

export const sanitizeAutoUnlockConfig = (config: AutoUnlockConfig): AutoUnlockConfig => ({
  autoUnlockEnabled: Boolean(config.autoUnlockEnabled),
  perfectDaysRequired: clampInteger(config.perfectDaysRequired, 1, 30),
  dailyAttemptTarget: clampInteger(config.dailyAttemptTarget, 1, 100),
});

export const getNextLevelProgress = (
  progress: EguchiProgress,
  config: AutoUnlockConfig,
  referenceDate: Date = new Date()
): NextLevelProgress => {
  const normalized = sanitizeAutoUnlockConfig(config);
  const totalLevels = ORDERED_CHORD_IDS.length;
  const currentLevel = progress.unlockedChordIds.length;
  const nextChordId = ORDERED_CHORD_IDS[currentLevel] ?? null;
  const isMaxLevel = nextChordId === null;
  const todayDayKey = formatDayKey(referenceDate);
  const todaySummary = progress.dailySummaries[todayDayKey] ?? { attempts: 0, correct: 0 };

  const perfectDayStreak = calculatePerfectDayStreak(
    progress.dailySummaries,
    normalized.dailyAttemptTarget,
    referenceDate,
    progress.lastAutoUnlockDayKey
  );

  const daysRemaining = isMaxLevel
    ? 0
    : Math.max(0, normalized.perfectDaysRequired - perfectDayStreak);

  return {
    currentLevel,
    totalLevels,
    nextChordId,
    nextChordAnimal: nextChordId ? CHORD_BY_ID[nextChordId].animal : null,
    isMaxLevel,
    perfectDayStreak,
    perfectDaysRequired: normalized.perfectDaysRequired,
    dailyAttemptTarget: normalized.dailyAttemptTarget,
    daysRemaining,
    canUnlockNow: !isMaxLevel && daysRemaining === 0,
    todaySummary,
    isTodayPerfect: isPerfectDay(todaySummary, normalized.dailyAttemptTarget),
  };
};

export const unlockNextLevelManually = (progress: EguchiProgress): EguchiProgress => {
  const nextChordId = ORDERED_CHORD_IDS[progress.unlockedChordIds.length];
  if (!nextChordId) {
    return progress;
  }
  return {
    ...progress,
    unlockedChordIds: [...progress.unlockedChordIds, nextChordId],
  };
};

export const lockLastUnlockedLevel = (progress: EguchiProgress): EguchiProgress => {
  if (progress.unlockedChordIds.length <= 1) {
    return progress;
  }
  return {
    ...progress,
    unlockedChordIds: progress.unlockedChordIds.slice(0, -1),
  };
};

export const maybeApplyAutoUnlock = (
  progress: EguchiProgress,
  config: AutoUnlockConfig,
  referenceDate: Date = new Date()
): { progress: EguchiProgress; unlocked: boolean } => {
  const normalized = sanitizeAutoUnlockConfig(config);
  if (!normalized.autoUnlockEnabled) {
    return { progress, unlocked: false };
  }

  const status = getNextLevelProgress(progress, normalized, referenceDate);
  if (!status.canUnlockNow) {
    return { progress, unlocked: false };
  }

  const unlockDayKey = formatDayKey(referenceDate);
  if (progress.lastAutoUnlockDayKey === unlockDayKey) {
    return { progress, unlocked: false };
  }

  const unlocked = unlockNextLevelManually(progress);
  if (unlocked === progress) {
    return { progress, unlocked: false };
  }

  return {
    progress: {
      ...unlocked,
      lastAutoUnlockDayKey: unlockDayKey,
    },
    unlocked: true,
  };
};
