import type { AnimalEmotion } from './animal-assets';
import type { EguchiChordId } from './chords';

export type AnimalMotionTarget = 'tile' | 'artwork';
export type AnimalAnimationReaction = 'hint' | 'not-me' | 'assisted' | 'celebrate' | null;

export const ANIMATION_PLAYGROUND_DEFAULT_EXPANDED = false;

export type AnimalAnimationDemoId = 'hint' | 'not-me' | 'assisted' | 'independent';

export type AnimalAnimationDemo = {
  id: AnimalAnimationDemoId;
  label: string;
  detail: string;
  reaction: Exclude<AnimalAnimationReaction, null>;
};

export const ANIMAL_ANIMATION_DEMOS: readonly AnimalAnimationDemo[] = [
  {
    id: 'hint',
    label: 'Wink hint',
    detail: 'A gentle clue before the answer',
    reaction: 'hint',
  },
  {
    id: 'not-me',
    label: 'Not me',
    detail: 'A curious head tilt after a wrong tap',
    reaction: 'not-me',
  },
  {
    id: 'assisted',
    label: 'Warm smile',
    detail: 'A gentle happy response after using the hint',
    reaction: 'assisted',
  },
  {
    id: 'independent',
    label: 'Big celebration',
    detail: 'A joyful airborne jump, with glow and sparkles',
    reaction: 'celebrate',
  },
] as const;

export type AnimalAnimationProfile = {
  hintEmotion?: AnimalEmotion;
  motionTarget: AnimalMotionTarget;
};

const ANIMATION_PROFILE: AnimalAnimationProfile = {
  hintEmotion: 'wink',
  motionTarget: 'artwork',
};

export const getAnimalAnimationProfile = (_chordId: EguchiChordId): AnimalAnimationProfile =>
  ANIMATION_PROFILE;
