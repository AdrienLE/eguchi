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
type AnimalReactionPoses = Readonly<Record<AnimatedReaction, AnimalReactionPose>>;
type AnimalReactionSources = Readonly<Record<AnimatedReaction, number>>;

const REACTION_DURATION_MS: Readonly<Record<AnimatedReaction, number>> = {
  hint: 420,
  'not-me': 760,
  assisted: 760,
  celebrate: 920,
};

const createAnimalReactionPoses = (sources: AnimalReactionSources): AnimalReactionPoses => ({
  hint: {
    kind: 'wink',
    source: sources.hint,
    durationMs: REACTION_DURATION_MS.hint,
  },
  'not-me': {
    kind: 'head-tilt',
    source: sources['not-me'],
    durationMs: REACTION_DURATION_MS['not-me'],
  },
  assisted: {
    kind: 'seated-smile',
    source: sources.assisted,
    durationMs: REACTION_DURATION_MS.assisted,
  },
  celebrate: {
    kind: 'jump',
    source: sources.celebrate,
    durationMs: REACTION_DURATION_MS.celebrate,
  },
});

const FOX_REACTION_POSES: AnimalReactionPoses = {
  hint: {
    kind: 'wink',
    source: require('../../assets/images/eguchi/animals/fox__wink.png'),
    durationMs: REACTION_DURATION_MS.hint,
  },
  'not-me': {
    kind: 'head-tilt',
    source: require('../../assets/images/eguchi/animations/fox/not-me.png'),
    durationMs: REACTION_DURATION_MS['not-me'],
    alignment: {
      offsetXRatio: -0.012,
      offsetYRatio: 0.032,
      scale: 0.91,
    },
  },
  assisted: {
    kind: 'seated-smile',
    source: require('../../assets/images/eguchi/animations/fox/happy-big.png'),
    durationMs: REACTION_DURATION_MS.assisted,
    alignment: {
      offsetXRatio: 0.083,
      offsetYRatio: -0.008,
      scale: 1.14,
    },
  },
  celebrate: {
    kind: 'jump',
    source: require('../../assets/images/eguchi/animations/fox/celebrate-03.png'),
    durationMs: REACTION_DURATION_MS.celebrate,
    alignment: {
      offsetXRatio: 0.077,
      offsetYRatio: 0.004,
      scale: 0.93,
    },
  },
};

// Replacement species use the same base art for reactions until matching poses are drawn.
// Never substitute a former animal during feedback.
const ANIMAL_REACTION_POSES_BY_CHORD_ID: Readonly<Record<EguchiChordId, AnimalReactionPoses>> = {
  'C-E-G': FOX_REACTION_POSES,
  'B-D-G': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/animations/whale/wink.png'),
    'not-me': require('../../assets/images/eguchi/animations/whale/not-me.png'),
    assisted: require('../../assets/images/eguchi/animations/whale/warm-smile.png'),
    celebrate: require('../../assets/images/eguchi/animations/whale/celebrate.png'),
  }),
  'D-G-B': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/animations/frog/wink.png'),
    'not-me': require('../../assets/images/eguchi/animations/frog/not-me.png'),
    assisted: require('../../assets/images/eguchi/animations/frog/warm-smile.png'),
    celebrate: require('../../assets/images/eguchi/animations/frog/celebrate.png'),
  }),
  'E-G-C': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/animations/tiger/wink.png'),
    'not-me': require('../../assets/images/eguchi/animations/tiger/not-me.png'),
    assisted: require('../../assets/images/eguchi/animations/tiger/warm-smile.png'),
    celebrate: require('../../assets/images/eguchi/animations/tiger/celebrate.png'),
  }),
  'F-A-C': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/animations/octopus/wink.png'),
    'not-me': require('../../assets/images/eguchi/animations/octopus/not-me.png'),
    assisted: require('../../assets/images/eguchi/animations/octopus/warm-smile.png'),
    celebrate: require('../../assets/images/eguchi/animations/octopus/celebrate.png'),
  }),
  'C-F-A': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/animations/chick/wink.png'),
    'not-me': require('../../assets/images/eguchi/animations/chick/not-me.png'),
    assisted: require('../../assets/images/eguchi/animations/chick/warm-smile.png'),
    celebrate: require('../../assets/images/eguchi/animations/chick/celebrate.png'),
  }),
  'G-B-D': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/foundation/pink-flamingo-v1.png'),
    'not-me': require('../../assets/images/eguchi/foundation/pink-flamingo-v1.png'),
    assisted: require('../../assets/images/eguchi/foundation/pink-flamingo-v1.png'),
    celebrate: require('../../assets/images/eguchi/foundation/pink-flamingo-v1.png'),
  }),
  'A-C-F': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/foundation/black-cat-v1.png'),
    'not-me': require('../../assets/images/eguchi/foundation/black-cat-v1.png'),
    assisted: require('../../assets/images/eguchi/foundation/black-cat-v1.png'),
    celebrate: require('../../assets/images/eguchi/foundation/black-cat-v1.png'),
  }),
  'E-G#-B': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/foundation/lavender-butterfly-v1.png'),
    'not-me': require('../../assets/images/eguchi/foundation/lavender-butterfly-v1.png'),
    assisted: require('../../assets/images/eguchi/foundation/lavender-butterfly-v1.png'),
    celebrate: require('../../assets/images/eguchi/foundation/lavender-butterfly-v1.png'),
  }),
  'G-C-E': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/foundation/brown-bear-v1.png'),
    'not-me': require('../../assets/images/eguchi/foundation/brown-bear-v1.png'),
    assisted: require('../../assets/images/eguchi/foundation/brown-bear-v1.png'),
    celebrate: require('../../assets/images/eguchi/foundation/brown-bear-v1.png'),
  }),
  'A-C#-E': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/animations/parrot/wink.png'),
    'not-me': require('../../assets/images/eguchi/animations/parrot/not-me.png'),
    assisted: require('../../assets/images/eguchi/animations/parrot/warm-smile.png'),
    celebrate: require('../../assets/images/eguchi/animations/parrot/celebrate.png'),
  }),
  'Eb-G-Bb': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/animations/fish/wink.png'),
    'not-me': require('../../assets/images/eguchi/animations/fish/not-me.png'),
    assisted: require('../../assets/images/eguchi/animations/fish/warm-smile.png'),
    celebrate: require('../../assets/images/eguchi/animations/fish/celebrate.png'),
  }),
  'Bb-D-F': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/animations/seal/wink.png'),
    'not-me': require('../../assets/images/eguchi/animations/seal/not-me.png'),
    assisted: require('../../assets/images/eguchi/animations/seal/warm-smile.png'),
    celebrate: require('../../assets/images/eguchi/animations/seal/celebrate.png'),
  }),
  'D-F#-A': createAnimalReactionPoses({
    hint: require('../../assets/images/eguchi/foundation/peach-pig-v1.png'),
    'not-me': require('../../assets/images/eguchi/foundation/peach-pig-v1.png'),
    assisted: require('../../assets/images/eguchi/foundation/peach-pig-v1.png'),
    celebrate: require('../../assets/images/eguchi/foundation/peach-pig-v1.png'),
  }),
};

export function getAnimalReactionPose(
  chordId: EguchiChordId,
  reaction: AnimalAnimationReaction
): AnimalReactionPose | null {
  if (!reaction) return null;
  return ANIMAL_REACTION_POSES_BY_CHORD_ID[chordId][reaction];
}
