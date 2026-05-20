import { Platform, type PlatformOSType } from 'react-native';
import type { EguchiChordId } from './chords';

export type AnimalEmotion = 'happy' | 'sad';

export const CHORD_ANIMAL_WEB_SLUG_BY_ID: Record<EguchiChordId, string> = {
  'C-E-G': 'fox',
  'F-A-C': 'whale',
  'G-B-D': 'frog',
  'E-G-C': 'tiger',
  'A-C-F': 'octopus',
  'B-D-G': 'chick',
  'G-C-E': 'bunny',
  'C-F-A': 'turtle',
  'D-G-B': 'bluebird',
  'A-C#-E': 'lion',
  'D-F#-A': 'parrot',
  'E-G#-B': 'fish',
  'Bb-D-F': 'seal',
  'Eb-G-Bb': 'crab',
};

export const CHORD_ANIMAL_WEB_PATH_BY_ID: Record<EguchiChordId, string> = {
  'C-E-G': '/assets/images/eguchi/animals/fox.png',
  'F-A-C': '/assets/images/eguchi/animals/whale.png',
  'G-B-D': '/assets/images/eguchi/animals/frog.png',
  'E-G-C': '/assets/images/eguchi/animals/tiger.png',
  'A-C-F': '/assets/images/eguchi/animals/octopus.png',
  'B-D-G': '/assets/images/eguchi/animals/chick.png',
  'G-C-E': '/assets/images/eguchi/animals/bunny.png',
  'C-F-A': '/assets/images/eguchi/animals/turtle.png',
  'D-G-B': '/assets/images/eguchi/animals/bluebird.png',
  'A-C#-E': '/assets/images/eguchi/animals/lion.png',
  'D-F#-A': '/assets/images/eguchi/animals/parrot.png',
  'E-G#-B': '/assets/images/eguchi/animals/fish.png',
  'Bb-D-F': '/assets/images/eguchi/animals/seal.png',
  'Eb-G-Bb': '/assets/images/eguchi/animals/crab.png',
};

type AnimalBundleSource = number;

export const CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID: Partial<Record<EguchiChordId, AnimalBundleSource>> =
  {
    'C-E-G': require('../../assets/images/eguchi/animals/fox.png'),
    'F-A-C': require('../../assets/images/eguchi/animals/whale.png'),
    'G-B-D': require('../../assets/images/eguchi/animals/frog.png'),
    'E-G-C': require('../../assets/images/eguchi/animals/tiger.png'),
    'A-C-F': require('../../assets/images/eguchi/animals/octopus.png'),
    'B-D-G': require('../../assets/images/eguchi/animals/chick.png'),
    'G-C-E': require('../../assets/images/eguchi/animals/bunny.png'),
    'C-F-A': require('../../assets/images/eguchi/animals/turtle.png'),
    'D-G-B': require('../../assets/images/eguchi/animals/bluebird.png'),
    'A-C#-E': require('../../assets/images/eguchi/animals/lion.png'),
    'D-F#-A': require('../../assets/images/eguchi/animals/parrot.png'),
    'E-G#-B': require('../../assets/images/eguchi/animals/fish.png'),
    'Bb-D-F': require('../../assets/images/eguchi/animals/seal.png'),
    'Eb-G-Bb': require('../../assets/images/eguchi/animals/crab.png'),
  };

export const CHORD_ANIMAL_SAD_BUNDLE_SOURCE_BY_ID: Partial<
  Record<EguchiChordId, AnimalBundleSource>
> = {
  'C-E-G': require('../../assets/images/eguchi/animals/fox__sad.png'),
  'F-A-C': require('../../assets/images/eguchi/animals/whale__sad.png'),
  'G-B-D': require('../../assets/images/eguchi/animals/frog__sad.png'),
  'E-G-C': require('../../assets/images/eguchi/animals/tiger__sad.png'),
  'A-C-F': require('../../assets/images/eguchi/animals/octopus__sad.png'),
  'B-D-G': require('../../assets/images/eguchi/animals/chick__sad.png'),
  'G-C-E': require('../../assets/images/eguchi/animals/bunny__sad.png'),
  'C-F-A': require('../../assets/images/eguchi/animals/turtle__sad.png'),
  'D-G-B': require('../../assets/images/eguchi/animals/bluebird__sad.png'),
  'A-C#-E': require('../../assets/images/eguchi/animals/lion__sad.png'),
  'D-F#-A': require('../../assets/images/eguchi/animals/parrot__sad.png'),
  'E-G#-B': require('../../assets/images/eguchi/animals/fish__sad.png'),
  'Bb-D-F': require('../../assets/images/eguchi/animals/seal__sad.png'),
  'Eb-G-Bb': require('../../assets/images/eguchi/animals/crab__sad.png'),
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
  const emotionSuffix = emotion === 'sad' ? '__sad' : '';
  return `/assets/images/eguchi/animals/${slug}${emotionSuffix}.png`;
};

export const getChordAnimalImageSource = (
  chordId: EguchiChordId,
  platform: PlatformOSType = Platform.OS,
  options: AnimalImageOptions = {}
): AnimalImageSource | null => {
  const emotion = options.emotion ?? 'happy';
  const sadBundledSource = CHORD_ANIMAL_SAD_BUNDLE_SOURCE_BY_ID[chordId];
  const bundledSource = CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID[chordId];
  if (emotion === 'sad' && sadBundledSource) {
    return sadBundledSource;
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
