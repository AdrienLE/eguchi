import { getAnimalAnimationProfile } from '@/lib/eguchi/animal-animation';

describe('animal animation profiles', () => {
  test('enables artwork motion and the wink cue only for the Fox pilot', () => {
    expect(getAnimalAnimationProfile('C-E-G')).toEqual({
      hintEmotion: 'wink',
      motionTarget: 'artwork',
    });
    expect(getAnimalAnimationProfile('F-A-C')).toEqual({ motionTarget: 'tile' });
  });
});
