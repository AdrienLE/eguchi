import type { AnimalAnimationReaction } from './animal-animation';
import type { EguchiChordId } from './chords';

export type AnimalAnimationFrame = {
  source: number;
  durationMs: number;
};

type AnimatedReaction = Exclude<AnimalAnimationReaction, null>;

const FOX_BASE = require('../../assets/images/eguchi/animals/fox.png');
const FOX_WINK = require('../../assets/images/eguchi/animals/fox__wink.png');

const FOX_REACTION_FRAMES: Readonly<Record<AnimatedReaction, readonly AnimalAnimationFrame[]>> = {
  hint: [
    { source: FOX_BASE, durationMs: 70 },
    { source: FOX_WINK, durationMs: 240 },
    { source: FOX_BASE, durationMs: 120 },
  ],
  'not-me': [
    { source: FOX_BASE, durationMs: 70 },
    {
      source: require('../../assets/images/eguchi/animations/fox/not-me-01.png'),
      durationMs: 110,
    },
    {
      source: require('../../assets/images/eguchi/animations/fox/not-me-02.png'),
      durationMs: 160,
    },
    {
      source: require('../../assets/images/eguchi/animations/fox/not-me-03.png'),
      durationMs: 240,
    },
    {
      source: require('../../assets/images/eguchi/animations/fox/not-me-04.png'),
      durationMs: 130,
    },
    { source: FOX_BASE, durationMs: 160 },
  ],
  assisted: [
    { source: FOX_BASE, durationMs: 60 },
    {
      source: require('../../assets/images/eguchi/animations/fox/assisted-01.png'),
      durationMs: 120,
    },
    {
      source: require('../../assets/images/eguchi/animations/fox/assisted-02.png'),
      durationMs: 170,
    },
    {
      source: require('../../assets/images/eguchi/animations/fox/assisted-03.png'),
      durationMs: 140,
    },
    {
      source: require('../../assets/images/eguchi/animations/fox/assisted-04.png'),
      durationMs: 130,
    },
    { source: FOX_BASE, durationMs: 160 },
  ],
  celebrate: [
    { source: FOX_BASE, durationMs: 50 },
    {
      source: require('../../assets/images/eguchi/animations/fox/celebrate-01.png'),
      durationMs: 100,
    },
    {
      source: require('../../assets/images/eguchi/animations/fox/celebrate-02.png'),
      durationMs: 130,
    },
    {
      source: require('../../assets/images/eguchi/animations/fox/celebrate-03.png'),
      durationMs: 180,
    },
    {
      source: require('../../assets/images/eguchi/animations/fox/celebrate-04.png'),
      durationMs: 120,
    },
    {
      source: require('../../assets/images/eguchi/animations/fox/celebrate-05.png'),
      durationMs: 120,
    },
    {
      source: require('../../assets/images/eguchi/animations/fox/celebrate-06.png'),
      durationMs: 180,
    },
    { source: FOX_BASE, durationMs: 180 },
  ],
};

export function getAnimalReactionFrames(
  chordId: EguchiChordId,
  reaction: AnimalAnimationReaction
): readonly AnimalAnimationFrame[] | null {
  if (chordId !== 'C-E-G' || !reaction) return null;
  return FOX_REACTION_FRAMES[reaction];
}
