import type { AnimalEmotion } from './animal-assets';
import type { EguchiChordId } from './chords';

export type TrainingAnswerResult = 'correct' | 'incorrect' | null;

export const getFeedbackAnimalEmotion = (
  result: TrainingAnswerResult
): AnimalEmotion | undefined => {
  if (result === 'correct') {
    return 'happy';
  }
  if (result === 'incorrect') {
    return 'sad';
  }
  return undefined;
};

export const getAnimalImageRecyclingKey = (
  scope: string,
  chordId: EguchiChordId,
  emotion: AnimalEmotion
) => `${scope}:${chordId}:${emotion}`;

export const getCountdownVisibleSegmentCount = (
  remainingProgress: number,
  segmentCount: number
) => {
  const safeSegmentCount = Math.max(0, Math.round(segmentCount));
  if (!safeSegmentCount || !Number.isFinite(remainingProgress)) {
    return 0;
  }
  const clampedProgress = Math.max(0, Math.min(1, remainingProgress));
  return Math.min(safeSegmentCount, Math.ceil(clampedProgress * safeSegmentCount));
};
