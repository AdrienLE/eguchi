import type { AnimalAnimationReaction } from './animal-animation';
import type { EguchiChordId } from './chords';

export type AnimalReactionPose = {
  source: number;
  durationMs: number;
  alignment?: {
    offsetXRatio: number;
    offsetYRatio: number;
    scale: number;
  };
};

type AnimatedReaction = Exclude<AnimalAnimationReaction, null>;

const FOX_WINK = require('../../assets/images/eguchi/animals/fox__wink.png');

const FOX_REACTION_POSES: Readonly<Record<AnimatedReaction, AnimalReactionPose>> = {
  hint: { source: FOX_WINK, durationMs: 420 },
  'not-me': {
    source: require('../../assets/images/eguchi/animations/fox/not-me.png'),
    durationMs: 760,
    alignment: {
      offsetXRatio: -0.012,
      offsetYRatio: 0.032,
      scale: 0.91,
    },
  },
  assisted: {
    source: require('../../assets/images/eguchi/animations/fox/happy-warm.png'),
    durationMs: 760,
    alignment: {
      offsetXRatio: -0.064,
      offsetYRatio: 0.08,
      scale: 1.14,
    },
  },
  celebrate: {
    source: require('../../assets/images/eguchi/animations/fox/happy-big.png'),
    durationMs: 920,
    alignment: {
      offsetXRatio: 0.083,
      offsetYRatio: -0.008,
      scale: 1.14,
    },
  },
};

export function getAnimalReactionPose(
  chordId: EguchiChordId,
  reaction: AnimalAnimationReaction
): AnimalReactionPose | null {
  if (chordId !== 'C-E-G' || !reaction) return null;
  return FOX_REACTION_POSES[reaction];
}
