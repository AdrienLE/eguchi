import { storage, STORAGE_KEYS, type StorageService } from '@/lib/storage';
import {
  DEFAULT_UNLOCKED_CHORD_IDS,
  ORDERED_CHORD_IDS,
  isValidChordId,
  type EguchiChordId,
} from './chords';

export const MAX_TRIAL_HISTORY = 2000;

const padDatePart = (value: number) => String(value).padStart(2, '0');

export const getDayKey = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const getDayKeyFromTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return getDayKey(new Date());
  }
  return getDayKey(date);
};

const normalizeUnlockedChordIds = (ids: unknown): EguchiChordId[] => {
  if (!Array.isArray(ids)) {
    return [...DEFAULT_UNLOCKED_CHORD_IDS];
  }

  const enabledSet = new Set<EguchiChordId>();
  for (const item of ids) {
    if (typeof item === 'string' && isValidChordId(item)) {
      enabledSet.add(item);
    }
  }

  const orderedEnabled = ORDERED_CHORD_IDS.filter(chordId => enabledSet.has(chordId));
  return orderedEnabled.length ? orderedEnabled : [...DEFAULT_UNLOCKED_CHORD_IDS];
};

const sanitizeTrialHistory = (history: unknown): EguchiTrialRecord[] => {
  if (!Array.isArray(history)) {
    return [];
  }

  const sanitized: EguchiTrialRecord[] = [];

  for (const item of history) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as Partial<EguchiTrialRecord>;
    if (!candidate.chordId || !isValidChordId(candidate.chordId)) {
      continue;
    }
    if (typeof candidate.correct !== 'boolean') {
      continue;
    }

    const timestamp = typeof candidate.timestamp === 'string' ? candidate.timestamp : '';
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    sanitized.push({
      chordId: candidate.chordId,
      correct: candidate.correct,
      timestamp: parsed.toISOString(),
    });
  }

  return sanitized.slice(-MAX_TRIAL_HISTORY);
};

const buildDailySummaries = (trialHistory: EguchiTrialRecord[]) => {
  const summaries: Record<string, EguchiDailySummary> = {};
  for (const trial of trialHistory) {
    const dayKey = getDayKeyFromTimestamp(trial.timestamp);
    const current = summaries[dayKey] ?? { attempts: 0, correct: 0 };
    summaries[dayKey] = {
      attempts: current.attempts + 1,
      correct: current.correct + (trial.correct ? 1 : 0),
    };
  }
  return summaries;
};

export type EguchiTrialRecord = {
  chordId: EguchiChordId;
  correct: boolean;
  timestamp: string;
};

export type EguchiDailySummary = {
  attempts: number;
  correct: number;
};

export type EguchiProgress = {
  unlockedChordIds: EguchiChordId[];
  trialHistory: EguchiTrialRecord[];
  dailySummaries: Record<string, EguchiDailySummary>;
};

export type RecordTrialInput = {
  chordId: EguchiChordId;
  correct: boolean;
  timestamp?: string;
};

export type EguchiProgressSnapshot = {
  totalAttempts: number;
  totalCorrect: number;
  totalAccuracy: number;
  todayAttempts: number;
  todayCorrect: number;
  todayAccuracy: number;
  unlockedCount: number;
};

export const createDefaultEguchiProgress = (): EguchiProgress => ({
  unlockedChordIds: [...DEFAULT_UNLOCKED_CHORD_IDS],
  trialHistory: [],
  dailySummaries: {},
});

export const loadEguchiProgress = async (
  storageService: StorageService = storage
): Promise<EguchiProgress> => {
  const stored = await storageService.get<Partial<EguchiProgress>>(STORAGE_KEYS.EGUCHI_PROGRESS);
  if (!stored) {
    return createDefaultEguchiProgress();
  }

  const trialHistory = sanitizeTrialHistory(stored.trialHistory);

  return {
    unlockedChordIds: normalizeUnlockedChordIds(stored.unlockedChordIds),
    trialHistory,
    dailySummaries: buildDailySummaries(trialHistory),
  };
};

export const saveEguchiProgress = async (
  progress: EguchiProgress,
  storageService: StorageService = storage
) => {
  await storageService.set(STORAGE_KEYS.EGUCHI_PROGRESS, progress);
};

export const resetEguchiProgress = async (storageService: StorageService = storage) => {
  const defaults = createDefaultEguchiProgress();
  await saveEguchiProgress(defaults, storageService);
  return defaults;
};

export const recordTrial = (
  progress: EguchiProgress,
  { chordId, correct, timestamp }: RecordTrialInput
): EguchiProgress => {
  const parsedTimestamp = new Date(timestamp ?? new Date().toISOString());
  const normalizedTimestamp = Number.isNaN(parsedTimestamp.getTime())
    ? new Date().toISOString()
    : parsedTimestamp.toISOString();

  const nextTrial: EguchiTrialRecord = {
    chordId,
    correct,
    timestamp: normalizedTimestamp,
  };

  const trialHistory = [...progress.trialHistory, nextTrial].slice(-MAX_TRIAL_HISTORY);
  return {
    ...progress,
    trialHistory,
    dailySummaries: buildDailySummaries(trialHistory),
  };
};

export const setChordUnlocked = (
  progress: EguchiProgress,
  chordId: EguchiChordId,
  unlocked: boolean
): EguchiProgress => {
  const currentSet = new Set(progress.unlockedChordIds);

  if (unlocked) {
    currentSet.add(chordId);
    return {
      ...progress,
      unlockedChordIds: ORDERED_CHORD_IDS.filter(id => currentSet.has(id)),
    };
  }

  currentSet.delete(chordId);
  if (!currentSet.size) {
    return progress;
  }

  return {
    ...progress,
    unlockedChordIds: ORDERED_CHORD_IDS.filter(id => currentSet.has(id)),
  };
};

export const getProgressSnapshot = (
  progress: EguchiProgress,
  date: Date = new Date()
): EguchiProgressSnapshot => {
  let totalAttempts = 0;
  let totalCorrect = 0;

  for (const summary of Object.values(progress.dailySummaries)) {
    totalAttempts += summary.attempts;
    totalCorrect += summary.correct;
  }

  const todayKey = getDayKey(date);
  const todaySummary = progress.dailySummaries[todayKey] ?? { attempts: 0, correct: 0 };

  return {
    totalAttempts,
    totalCorrect,
    totalAccuracy: totalAttempts ? totalCorrect / totalAttempts : 0,
    todayAttempts: todaySummary.attempts,
    todayCorrect: todaySummary.correct,
    todayAccuracy: todaySummary.attempts ? todaySummary.correct / todaySummary.attempts : 0,
    unlockedCount: progress.unlockedChordIds.length,
  };
};
