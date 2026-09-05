import { getAutoAdvanceDurationMs } from './training-loop';
import type { AnimalEmotion } from './animal-assets';
import type { EguchiChordId } from './chords';
import type { TrainingOutcome } from './learning-path';

export type TrainingAnswerResult = 'correct' | 'incorrect' | null;

export const getFeedbackAnimalEmotion = (
  result: TrainingAnswerResult
): AnimalEmotion | undefined => {
  if (result === 'correct') {
    return 'happy';
  }
  return undefined;
};

export const classifyTrainingOutcome = ({
  hadIncorrectTap,
  hintShown,
}: {
  hadIncorrectTap: boolean;
  hintShown: boolean;
}): TrainingOutcome => {
  if (hadIncorrectTap) {
    return 'corrected';
  }
  return hintShown ? 'assisted' : 'independent';
};

export const getSuccessTileReaction = (outcome: TrainingOutcome): 'celebrate' | 'assisted' =>
  outcome === 'independent' ? 'celebrate' : 'assisted';

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

export const getSuccessFeedback = (outcome: TrainingOutcome, feedbackSeconds: number) => ({
  reaction: getSuccessTileReaction(outcome),
  durationMs: getAutoAdvanceDurationMs(feedbackSeconds),
});
