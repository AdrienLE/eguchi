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
