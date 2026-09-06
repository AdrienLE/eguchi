import { Platform, type PlatformOSType } from 'react-native';
import type { EguchiChordId } from './chords';

export type AnimalEmotion = 'happy' | 'sad' | 'wink';

export const CHORD_ANIMAL_EMOJI_BY_ID: Record<EguchiChordId, string> = {
  'C-E-G': '🦊',
  'B-D-G': '🐋',
  'D-G-B': '🐸',
  'E-G-C': '🐯',
  'F-A-C': '🐙',
  'C-F-A': '🐣',
  'G-B-D': '🐰',
  'A-C-F': '🐢',
  'E-G#-B': '🐦',
  'G-C-E': '🦁',
  'A-C#-E': '🦜',
  'Eb-G-Bb': '🐠',
  'Bb-D-F': '🦭',
  'D-F#-A': '🦀',
};

export const CHORD_ANIMAL_WEB_SLUG_BY_ID: Record<EguchiChordId, string> = {
  'C-E-G': 'fox',
  'B-D-G': 'whale',
  'D-G-B': 'frog',
  'E-G-C': 'tiger',
  'F-A-C': 'octopus',
  'C-F-A': 'chick',
  'G-B-D': 'bunny',
  'A-C-F': 'turtle',
  'E-G#-B': 'bluebird',
  'G-C-E': 'lion',
  'A-C#-E': 'parrot',
  'Eb-G-Bb': 'fish',
  'Bb-D-F': 'seal',
  'D-F#-A': 'crab',
};

export const CHORD_ANIMAL_WEB_PATH_BY_ID: Record<EguchiChordId, string> = {
  'C-E-G': '/assets/images/eguchi/animals/fox.png',
  'B-D-G': '/assets/images/eguchi/animals/whale.png',
  'D-G-B': '/assets/images/eguchi/animals/frog.png',
  'E-G-C': '/assets/images/eguchi/animals/tiger.png',
  'F-A-C': '/assets/images/eguchi/animals/octopus.png',
  'C-F-A': '/assets/images/eguchi/animals/chick.png',
  'G-B-D': '/assets/images/eguchi/animals/bunny.png',
  'A-C-F': '/assets/images/eguchi/animals/turtle.png',
  'E-G#-B': '/assets/images/eguchi/animals/bluebird.png',
  'G-C-E': '/assets/images/eguchi/animals/lion.png',
  'A-C#-E': '/assets/images/eguchi/animals/parrot.png',
  'Eb-G-Bb': '/assets/images/eguchi/animals/fish.png',
  'Bb-D-F': '/assets/images/eguchi/animals/seal.png',
  'D-F#-A': '/assets/images/eguchi/animals/crab.png',
};

type AnimalBundleSource = number;

export const CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID: Partial<Record<EguchiChordId, AnimalBundleSource>> =
  {
    'C-E-G': require('../../assets/images/eguchi/animals/fox.png'),
    'B-D-G': require('../../assets/images/eguchi/animals/whale.png'),
    'D-G-B': require('../../assets/images/eguchi/animals/frog.png'),
    'E-G-C': require('../../assets/images/eguchi/animals/tiger.png'),
    'F-A-C': require('../../assets/images/eguchi/animals/octopus.png'),
    'C-F-A': require('../../assets/images/eguchi/animals/chick.png'),
    'G-B-D': require('../../assets/images/eguchi/animals/bunny.png'),
    'A-C-F': require('../../assets/images/eguchi/animals/turtle.png'),
    'E-G#-B': require('../../assets/images/eguchi/animals/bluebird.png'),
    'G-C-E': require('../../assets/images/eguchi/animals/lion.png'),
    'A-C#-E': require('../../assets/images/eguchi/animals/parrot.png'),
    'Eb-G-Bb': require('../../assets/images/eguchi/animals/fish.png'),
    'Bb-D-F': require('../../assets/images/eguchi/animals/seal.png'),
    'D-F#-A': require('../../assets/images/eguchi/animals/crab.png'),
  };

export const CHORD_ANIMAL_SAD_BUNDLE_SOURCE_BY_ID: Partial<
  Record<EguchiChordId, AnimalBundleSource>
> = {
  'C-E-G': require('../../assets/images/eguchi/animals/fox__sad.png'),
  'B-D-G': require('../../assets/images/eguchi/animals/whale__sad.png'),
  'D-G-B': require('../../assets/images/eguchi/animals/frog__sad.png'),
  'E-G-C': require('../../assets/images/eguchi/animals/tiger__sad.png'),
  'F-A-C': require('../../assets/images/eguchi/animals/octopus__sad.png'),
  'C-F-A': require('../../assets/images/eguchi/animals/chick__sad.png'),
  'G-B-D': require('../../assets/images/eguchi/animals/bunny__sad.png'),
  'A-C-F': require('../../assets/images/eguchi/animals/turtle__sad.png'),
  'E-G#-B': require('../../assets/images/eguchi/animals/bluebird__sad.png'),
  'G-C-E': require('../../assets/images/eguchi/animals/lion__sad.png'),
  'A-C#-E': require('../../assets/images/eguchi/animals/parrot__sad.png'),
  'Eb-G-Bb': require('../../assets/images/eguchi/animals/fish__sad.png'),
  'Bb-D-F': require('../../assets/images/eguchi/animals/seal__sad.png'),
  'D-F#-A': require('../../assets/images/eguchi/animals/crab__sad.png'),
};

export const CHORD_ANIMAL_WINK_BUNDLE_SOURCE_BY_ID: Partial<
  Record<EguchiChordId, AnimalBundleSource>
> = {
  'C-E-G': require('../../assets/images/eguchi/animals/fox__wink.png'),
  'B-D-G': require('../../assets/images/eguchi/animations/whale/wink.png'),
  'D-G-B': require('../../assets/images/eguchi/animations/frog/wink.png'),
  'E-G-C': require('../../assets/images/eguchi/animations/tiger/wink.png'),
  'F-A-C': require('../../assets/images/eguchi/animations/octopus/wink.png'),
  'C-F-A': require('../../assets/images/eguchi/animations/chick/wink.png'),
  'G-B-D': require('../../assets/images/eguchi/animations/bunny/wink.png'),
  'A-C-F': require('../../assets/images/eguchi/animations/turtle/wink.png'),
  'E-G#-B': require('../../assets/images/eguchi/animations/bluebird/wink.png'),
  'G-C-E': require('../../assets/images/eguchi/animations/lion/wink.png'),
  'A-C#-E': require('../../assets/images/eguchi/animations/parrot/wink.png'),
  'Eb-G-Bb': require('../../assets/images/eguchi/animations/fish/wink.png'),
  'Bb-D-F': require('../../assets/images/eguchi/animations/seal/wink.png'),
  'D-F#-A': require('../../assets/images/eguchi/animations/crab/wink.png'),
};

type AnimalImageSource = AnimalBundleSource | { uri: string };
type AnimalImageOptions = {
  emotion?: AnimalEmotion;
};

export const getChordAnimalWebPath = (
  chordId: EguchiChordId,
  emotion: AnimalEmotion = 'happy'
): string => {
  const slug = CHORD_ANIMAL_WEB_SLUG_BY_ID[chordId];
  const emotionSuffix = emotion === 'happy' ? '' : `__${emotion}`;
  return `/assets/images/eguchi/animals/${slug}${emotionSuffix}.png`;
};

export const getChordAnimalImageSource = (
  chordId: EguchiChordId,
  platform: PlatformOSType = Platform.OS,
  options: AnimalImageOptions = {}
): AnimalImageSource | null => {
  const emotion = options.emotion ?? 'happy';
  const sadBundledSource = CHORD_ANIMAL_SAD_BUNDLE_SOURCE_BY_ID[chordId];
  const winkBundledSource = CHORD_ANIMAL_WINK_BUNDLE_SOURCE_BY_ID[chordId];
  const bundledSource = CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID[chordId];
  if (emotion === 'sad' && sadBundledSource) {
    return sadBundledSource;
  }
  if (emotion === 'wink' && winkBundledSource) {
    return winkBundledSource;
  }

  if (bundledSource) {
    return bundledSource;
  }

  if (platform === 'web') {
    return { uri: getChordAnimalWebPath(chordId, emotion) };
  }

  // Native falls back to emoji when no bundled source exists for this chord.
  return null;
};
