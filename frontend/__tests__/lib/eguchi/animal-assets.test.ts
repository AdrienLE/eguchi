import { test, expect, describe } from '@jest/globals';
import {
  CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID,
  CHORD_ANIMAL_EMOJI_BY_ID,
  CHORD_ANIMAL_SAD_BUNDLE_SOURCE_BY_ID,
  CHORD_ANIMAL_WINK_BUNDLE_SOURCE_BY_ID,
  CHORD_ANIMAL_WEB_PATH_BY_ID,
  CHORD_ANIMAL_WEB_SLUG_BY_ID,
  getChordAnimalWebPath,
  getChordAnimalImageSource,
} from '@/lib/eguchi/animal-assets';
import { ORDERED_CHORD_IDS } from '@/lib/eguchi/chords';

describe('eguchi animal assets', () => {
  test('keeps the replacement species for every fallback emotion', () => {
    const replacements = [
      ['A-C-F', 'cat', 'black-cat'],
      ['G-B-D', 'flamingo', 'pink-flamingo'],
      ['G-C-E', 'bear', 'brown-bear'],
      ['D-F#-A', 'pig', 'peach-pig'],
      ['E-G#-B', 'butterfly', 'lavender-butterfly'],
    ] as const;
    for (const [id, slug, file] of replacements) {
      expect(CHORD_ANIMAL_WEB_SLUG_BY_ID[id]).toBe(slug);
      for (const emotion of ['happy', 'sad', 'wink'] as const) {
        expect(getChordAnimalWebPath(id, emotion)).toBe(
          `/assets/images/eguchi/foundation/${file}-v1.png`
        );
      }
    }
  });
  test('web slugs and paths cover every chord id', () => {
    expect(Object.keys(CHORD_ANIMAL_WEB_SLUG_BY_ID).sort()).toEqual([...ORDERED_CHORD_IDS].sort());
    expect(Object.keys(CHORD_ANIMAL_WEB_PATH_BY_ID).sort()).toEqual([...ORDERED_CHORD_IDS].sort());
  });

  test('provides one shared emoji fallback for every selectable animal', () => {
    expect(Object.keys(CHORD_ANIMAL_EMOJI_BY_ID).sort()).toEqual([...ORDERED_CHORD_IDS].sort());
    expect(Object.values(CHORD_ANIMAL_EMOJI_BY_ID).every(Boolean)).toBe(true);
  });

  test('web source prefers bundled images when available', () => {
    const foxSource = getChordAnimalImageSource('C-E-G', 'web');
    expect(foxSource).toBe(CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID['C-E-G']);

    const whaleSource = getChordAnimalImageSource('F-A-C', 'web');
    expect(whaleSource).toBe(CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID['F-A-C']);
  });

  test('native source uses bundled assets first, then emoji fallback', () => {
    expect(Object.keys(CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID).sort()).toEqual(
      [...ORDERED_CHORD_IDS].sort()
    );
    expect(getChordAnimalImageSource('C-E-G', 'ios')).toBe(
      CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID['C-E-G']
    );
    expect(getChordAnimalImageSource('F-A-C', 'android')).toBe(
      CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID['F-A-C']
    );
  });

  test('sad emotion uses bundled sad images when available', () => {
    expect(getChordAnimalWebPath('C-E-G', 'sad')).toBe(
      '/assets/images/eguchi/animals/fox__sad.png'
    );
    expect(getChordAnimalImageSource('C-E-G', 'web', { emotion: 'sad' })).toBe(
      CHORD_ANIMAL_SAD_BUNDLE_SOURCE_BY_ID['C-E-G']
    );
    expect(getChordAnimalImageSource('C-E-G', 'ios', { emotion: 'sad' })).toBe(
      CHORD_ANIMAL_SAD_BUNDLE_SOURCE_BY_ID['C-E-G']
    );
  });

  test('wink emotion uses a bundled frame for every animal', () => {
    expect(Object.keys(CHORD_ANIMAL_WINK_BUNDLE_SOURCE_BY_ID).sort()).toEqual(
      [...ORDERED_CHORD_IDS].sort()
    );
    expect(getChordAnimalWebPath('C-E-G', 'wink')).toBe(
      '/assets/images/eguchi/animals/fox__wink.png'
    );
    expect(getChordAnimalImageSource('C-E-G', 'ios', { emotion: 'wink' })).toBe(
      CHORD_ANIMAL_WINK_BUNDLE_SOURCE_BY_ID['C-E-G']
    );
    expect(getChordAnimalImageSource('F-A-C', 'ios', { emotion: 'wink' })).toBe(
      CHORD_ANIMAL_WINK_BUNDLE_SOURCE_BY_ID['F-A-C']
    );
  });

  test('web paths expose the configured animation emotion suffix', () => {
    expect(getChordAnimalWebPath('C-E-G')).toBe('/assets/images/eguchi/animals/fox.png');
    expect(getChordAnimalWebPath('C-E-G', 'sad')).toBe(
      '/assets/images/eguchi/animals/fox__sad.png'
    );
    expect(getChordAnimalWebPath('C-E-G', 'wink')).toBe(
      '/assets/images/eguchi/animals/fox__wink.png'
    );
  });
});
