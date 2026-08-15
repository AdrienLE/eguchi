import type { AnimalAnimationReaction } from './animal-animation';
import type { EguchiChordId } from './chords';

export type AnimalReactionPose = {
  kind: 'wink' | 'head-tilt' | 'seated-smile' | 'jump';
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
  hint: { kind: 'wink', source: FOX_WINK, durationMs: 420 },
  'not-me': {
    kind: 'head-tilt',
    source: require('../../assets/images/eguchi/animations/fox/not-me.png'),
    durationMs: 760,
    alignment: {
      offsetXRatio: -0.012,
      offsetYRatio: 0.032,
      scale: 0.91,
    },
  },
  assisted: {
    kind: 'seated-smile',
    source: require('../../assets/images/eguchi/animations/fox/happy-big.png'),
    durationMs: 760,
    alignment: {
      offsetXRatio: 0.083,
      offsetYRatio: -0.008,
      scale: 1.14,
    },
  },
  celebrate: {
    kind: 'jump',
    source: require('../../assets/images/eguchi/animations/fox/celebrate-03.png'),
    durationMs: 920,
    alignment: {
      offsetXRatio: 0.077,
      offsetYRatio: 0.004,
      scale: 0.93,
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
