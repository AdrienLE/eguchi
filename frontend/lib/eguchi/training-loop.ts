import type { EguchiChordId } from './chords';

export const AUTO_ADVANCE_DEFAULT_MS = 3200;
export const AUTO_ADVANCE_TICK_MS = 100;

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

export const pickRandomChordId = (
  ids: EguchiChordId[],
  randomValue: number = Math.random()
): EguchiChordId => {
  if (!ids.length) {
    throw new Error('Cannot pick a chord from an empty list.');
  }

  const normalized = clampUnit(randomValue);
  const safeIndex = Math.min(ids.length - 1, Math.floor(normalized * ids.length));
  return ids[safeIndex];
};

export const getAutoAdvanceProgress = (
  remainingMs: number | null,
  totalMs: number = AUTO_ADVANCE_DEFAULT_MS
) => {
  if (remainingMs === null || totalMs <= 0) {
    return 0;
  }
  return clampUnit(remainingMs / totalMs);
};

export const getAutoAdvanceSeconds = (remainingMs: number | null) => {
  if (remainingMs === null) {
    return null;
  }
  return Math.max(1, Math.ceil(remainingMs / 1000));
};
