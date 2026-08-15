import {
  ANIMATION_PLAYGROUND_DEFAULT_EXPANDED,
  ANIMAL_ANIMATION_DEMOS,
  getAnimalAnimationProfile,
} from '@/lib/eguchi/animal-animation';

describe('animal animation profiles', () => {
  test('enables artwork motion and the wink cue only for the Fox pilot', () => {
    expect(getAnimalAnimationProfile('C-E-G')).toEqual({
      hintEmotion: 'wink',
      motionTarget: 'artwork',
    });
    expect(getAnimalAnimationProfile('F-A-C')).toEqual({ motionTarget: 'tile' });
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
      'biggest happy smile'
    );
  });
});
