import {
  CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID,
  CHORD_ANIMAL_SAD_BUNDLE_SOURCE_BY_ID,
  CHORD_ANIMAL_WEB_PATH_BY_ID,
  CHORD_ANIMAL_WEB_SLUG_BY_ID,
  getChordAnimalWebPath,
  getChordAnimalImageSource,
} from '@/lib/eguchi/animal-assets';
import { ORDERED_CHORD_IDS } from '@/lib/eguchi/chords';

describe('eguchi animal assets', () => {
  test('web slugs and paths cover every chord id', () => {
    expect(Object.keys(CHORD_ANIMAL_WEB_SLUG_BY_ID).sort()).toEqual([...ORDERED_CHORD_IDS].sort());
    expect(Object.keys(CHORD_ANIMAL_WEB_PATH_BY_ID).sort()).toEqual([...ORDERED_CHORD_IDS].sort());
  });

  test('web source prefers bundled images when available', () => {
    const foxSource = getChordAnimalImageSource('C-E-G', 'web');
    expect(foxSource).toBe(CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID['C-E-G']);

    const whaleSource = getChordAnimalImageSource('F-A-C', 'web');
    expect(whaleSource).toBe(CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID['F-A-C']);
  });

  test('native source uses bundled assets first, then emoji fallback', () => {
    expect(Object.keys(CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID).length > 0).toBe(true);
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

  test('web paths only expose base happy and sad animal art', () => {
    expect(getChordAnimalWebPath('C-E-G')).toBe('/assets/images/eguchi/animals/fox.png');
    expect(getChordAnimalWebPath('C-E-G', 'sad')).toBe(
      '/assets/images/eguchi/animals/fox__sad.png'
    );
  });
});
