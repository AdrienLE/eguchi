import { storage, STORAGE_KEYS, type StorageService } from '@/lib/storage';
import {
  DEFAULT_UNLOCKED_CHORD_IDS,
  ORDERED_CHORD_IDS,
  isValidChordId,
  type EguchiChordId,
} from './chords';

export const MAX_TRIAL_HISTORY = 2000;
export const MIN_UNLOCKED_CHORD_COUNT = DEFAULT_UNLOCKED_CHORD_IDS.length;
export const MAX_UNLOCKED_CHORD_COUNT = ORDERED_CHORD_IDS.length;

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

const createRandomIdPart = () => {
  const cryptoObject = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoObject?.randomUUID === 'function') {
    return cryptoObject.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export const createEguchiTrialId = (timestamp: string = new Date().toISOString()) =>
  `trial_${timestamp.replace(/[^0-9A-Za-z]/g, '')}_${createRandomIdPart()}`;

const createLegacyTrialId = (
  candidate: Partial<EguchiTrialRecord>,
  timestamp: string,
  index: number
) => {
  const correctPart = candidate.correct ? 'correct' : 'incorrect';
  return `legacy_${timestamp.replace(/[^0-9A-Za-z]/g, '')}_${candidate.chordId}_${correctPart}_${index}`;
};

export const normalizeUnlockedChordIds = (ids: unknown): EguchiChordId[] => {
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
  const seenIds = new Set<string>();

  for (const [index, item] of history.entries()) {
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
    const normalizedTimestamp = parsed.toISOString();
    const candidateId =
      typeof candidate.id === 'string' && candidate.id.trim()
        ? candidate.id.trim()
        : createLegacyTrialId(candidate, normalizedTimestamp, index);
    if (seenIds.has(candidateId)) {
      continue;
    }
    seenIds.add(candidateId);

    sanitized.push({
      id: candidateId,
      chordId: candidate.chordId,
      correct: candidate.correct,
      timestamp: normalizedTimestamp,
    });
  }

  return sanitized.slice(-MAX_TRIAL_HISTORY);
};

export const mergeEguchiTrialHistories = (
  ...histories: Array<ReadonlyArray<EguchiTrialRecord>>
): EguchiTrialRecord[] => {
  const byId = new Map<string, EguchiTrialRecord>();
  for (const history of histories) {
    for (const trial of history) {
      if (!trial.id || byId.has(trial.id)) {
        continue;
      }
      byId.set(trial.id, trial);
    }
  }

  return [...byId.values()]
    .sort((left, right) => {
      const timestampDelta =
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
      return timestampDelta || left.id.localeCompare(right.id);
    })
    .slice(-MAX_TRIAL_HISTORY);
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
  id: string;
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
  lastAutoUnlockDayKey: string | null;
};

export type RecordTrialInput = {
  chordId: EguchiChordId;
  correct: boolean;
  id?: string;
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
  lastAutoUnlockDayKey: null,
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
    lastAutoUnlockDayKey:
      typeof stored.lastAutoUnlockDayKey === 'string' ? stored.lastAutoUnlockDayKey : null,
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

export const clampUnlockedLevel = (level: number) => {
  const numericLevel = Number.isFinite(level) ? level : MIN_UNLOCKED_CHORD_COUNT;
  return Math.max(
    MIN_UNLOCKED_CHORD_COUNT,
    Math.min(MAX_UNLOCKED_CHORD_COUNT, Math.round(numericLevel))
  );
};

export const setUnlockedLevel = (progress: EguchiProgress, level: number): EguchiProgress => {
  const unlockedCount = clampUnlockedLevel(level);
  const unlockedChordIds = ORDERED_CHORD_IDS.slice(0, unlockedCount);

  if (
    progress.unlockedChordIds.length === unlockedChordIds.length &&
    progress.unlockedChordIds.every((chordId, index) => chordId === unlockedChordIds[index])
  ) {
    return progress;
  }

  return {
    ...progress,
    unlockedChordIds,
  };
};

export const recordTrial = (
  progress: EguchiProgress,
  { chordId, correct, id, timestamp }: RecordTrialInput
): EguchiProgress => {
  const parsedTimestamp = new Date(timestamp ?? new Date().toISOString());
  const normalizedTimestamp = Number.isNaN(parsedTimestamp.getTime())
    ? new Date().toISOString()
    : parsedTimestamp.toISOString();

  const nextTrial: EguchiTrialRecord = {
    id: id?.trim() || createEguchiTrialId(normalizedTimestamp),
    chordId,
    correct,
    timestamp: normalizedTimestamp,
  };

  const trialHistory = mergeEguchiTrialHistories(progress.trialHistory, [nextTrial]);
  return {
    ...progress,
    trialHistory,
    dailySummaries: buildDailySummaries(trialHistory),
  };
};

export const rebuildProgressWithTrialHistory = (
  progress: EguchiProgress,
  trialHistory: EguchiTrialRecord[]
): EguchiProgress => {
  const mergedTrialHistory = mergeEguchiTrialHistories(trialHistory);
  return {
    ...progress,
    trialHistory: mergedTrialHistory,
    dailySummaries: buildDailySummaries(mergedTrialHistory),
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
