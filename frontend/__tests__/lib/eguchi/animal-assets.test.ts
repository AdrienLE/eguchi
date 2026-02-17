import {
  CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID,
  CHORD_ANIMAL_WEB_PATH_BY_ID,
  CHORD_ANIMAL_WEB_SLUG_BY_ID,
  getChordAnimalImageSource,
} from '@/lib/eguchi/animal-assets';
import { ORDERED_CHORD_IDS } from '@/lib/eguchi/chords';

describe('eguchi animal assets', () => {
  test('web slugs and paths cover every chord id', () => {
    expect(Object.keys(CHORD_ANIMAL_WEB_SLUG_BY_ID).sort()).toEqual([...ORDERED_CHORD_IDS].sort());
    expect(Object.keys(CHORD_ANIMAL_WEB_PATH_BY_ID).sort()).toEqual([...ORDERED_CHORD_IDS].sort());
  });

  test('web source returns uri path for each chord', () => {
    const source = getChordAnimalImageSource('C-E-G', 'web');
    expect(source).toEqual({ uri: '/assets/images/eguchi/animals/fox.png' });
  });

  test('native source falls back to emoji (no bundled map yet)', () => {
    expect(Object.keys(CHORD_ANIMAL_BUNDLE_SOURCE_BY_ID).length).toBe(0);
    expect(getChordAnimalImageSource('C-E-G', 'ios')).toBeNull();
    expect(getChordAnimalImageSource('F-A-C', 'android')).toBeNull();
  });
});
