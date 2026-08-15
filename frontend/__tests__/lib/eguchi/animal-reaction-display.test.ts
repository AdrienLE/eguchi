import { getAnimalReactionDisplayState } from '@/lib/eguchi/animal-reaction-display';

describe('animal reaction display state', () => {
  test('keeps the normal animal visible while a reaction pose preloads', () => {
    expect(getAnimalReactionDisplayState('warm:1', null, null)).toEqual({
      canDisplayPose: false,
      shouldPreloadPose: true,
    });
  });

  test('shows the pose only after its image has loaded', () => {
    expect(getAnimalReactionDisplayState('warm:1', 'warm:1', null)).toEqual({
      canDisplayPose: true,
      shouldPreloadPose: false,
    });
  });

  test('falls back to the normal animal after a pose load failure', () => {
    expect(getAnimalReactionDisplayState('big:2', null, 'big:2')).toEqual({
      canDisplayPose: false,
      shouldPreloadPose: false,
    });
  });
});
