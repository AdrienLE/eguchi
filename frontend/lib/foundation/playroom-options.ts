import {
  normalizePlayroomBackgroundId,
  type PlayroomBackgroundId,
} from '@/lib/eguchi/playroom-backgrounds';

export const DEFAULT_FEEDBACK_MS = 3000;
export const NO_RESPONSE_HOLD_MS = 1000;
export interface PlayroomOptions {
  backgroundId: PlayroomBackgroundId;
  feedbackMs: number;
  animalMotion: boolean;
  holdNoResponse: boolean;
}
export function normalizePlayroomOptions(value: unknown): PlayroomOptions {
  const saved = value && typeof value === 'object' ? (value as Partial<PlayroomOptions>) : {};
  return {
    backgroundId: normalizePlayroomBackgroundId(saved.backgroundId),
    feedbackMs:
      typeof saved.feedbackMs === 'number' &&
      Number.isFinite(saved.feedbackMs) &&
      saved.feedbackMs >= 1000 &&
      saved.feedbackMs <= 10000
        ? Math.round(saved.feedbackMs / 1000) * 1000
        : DEFAULT_FEEDBACK_MS,
    animalMotion: typeof saved.animalMotion === 'boolean' ? saved.animalMotion : true,
    holdNoResponse: typeof saved.holdNoResponse === 'boolean' ? saved.holdNoResponse : true,
  };
}
