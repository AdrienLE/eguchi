import { getAnimalReactionDisplayState } from '@/lib/eguchi/animal-reaction-display';

describe('animal reaction display state', () => {
  test('keeps the normal animal visible while a reaction pose preloads', () => {
    expect(getAnimalReactionDisplayState('warm:1', null, null)).toEqual({
      canDisplayPose: false,
      shouldMountPose: true,
      shouldPreloadPose: true,
    });
  });

  test('keeps the loaded pose mounted so returning to the normal animal cannot blank', () => {
    expect(getAnimalReactionDisplayState('warm:1', 'warm:1', null)).toEqual({
      canDisplayPose: true,
      shouldMountPose: true,
      shouldPreloadPose: false,
    });
  });

  test('falls back to the normal animal after a pose load failure', () => {
    expect(getAnimalReactionDisplayState('big:2', null, 'big:2')).toEqual({
      canDisplayPose: false,
      shouldMountPose: false,
      shouldPreloadPose: false,
    });
  });
});
