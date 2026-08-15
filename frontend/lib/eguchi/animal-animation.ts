import type { AnimalEmotion } from './animal-assets';
import type { EguchiChordId } from './chords';

export type AnimalMotionTarget = 'tile' | 'artwork';

export type AnimalAnimationProfile = {
  hintEmotion?: AnimalEmotion;
  motionTarget: AnimalMotionTarget;
};

const DEFAULT_ANIMATION_PROFILE: AnimalAnimationProfile = {
  motionTarget: 'tile',
};

const ANIMATION_PROFILE_BY_CHORD_ID: Partial<Record<EguchiChordId, AnimalAnimationProfile>> = {
  'C-E-G': {
    hintEmotion: 'wink',
    motionTarget: 'artwork',
  },
};

export const getAnimalAnimationProfile = (chordId: EguchiChordId): AnimalAnimationProfile =>
  ANIMATION_PROFILE_BY_CHORD_ID[chordId] ?? DEFAULT_ANIMATION_PROFILE;
