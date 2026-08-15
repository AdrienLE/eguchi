import {
  ANIMATION_PLAYGROUND_DEFAULT_EXPANDED,
  ANIMAL_ANIMATION_DEMOS,
  getAnimalAnimationProfile,
} from '@/lib/eguchi/animal-animation';
import { ORDERED_CHORD_IDS } from '@/lib/eguchi/chords';

describe('animal animation profiles', () => {
  test('enables artwork motion and wink cues for every animal', () => {
    for (const chordId of ORDERED_CHORD_IDS) {
      expect(getAnimalAnimationProfile(chordId)).toEqual({
        hintEmotion: 'wink',
        motionTarget: 'artwork',
      });
    }
  });

  test('offers a direct caregiver preview for every child-facing reaction', () => {
    expect(ANIMATION_PLAYGROUND_DEFAULT_EXPANDED).toBe(false);
    expect(ANIMAL_ANIMATION_DEMOS.map(demo => demo.reaction)).toEqual([
      'hint',
      'not-me',
      'assisted',
      'celebrate',
    ]);
    expect(ANIMAL_ANIMATION_DEMOS.map(demo => demo.id)).toEqual([
      'hint',
      'not-me',
      'assisted',
      'independent',
    ]);
    expect(ANIMAL_ANIMATION_DEMOS.find(demo => demo.id === 'assisted')?.label).toBe('Warm smile');
    expect(ANIMAL_ANIMATION_DEMOS.find(demo => demo.id === 'independent')?.detail).toContain(
      'airborne jump'
    );
  });
});
