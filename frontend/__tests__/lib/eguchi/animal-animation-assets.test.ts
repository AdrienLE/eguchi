import { getAnimalReactionFrames } from '@/lib/eguchi/animal-animation-assets';

describe('animal reaction frame assets', () => {
  test('gives the Fox a real artwork sequence for every reaction', () => {
    expect(getAnimalReactionFrames('C-E-G', 'hint')?.length).toBe(3);
    expect(getAnimalReactionFrames('C-E-G', 'not-me')?.length).toBe(6);
    expect(getAnimalReactionFrames('C-E-G', 'assisted')?.length).toBe(6);
    expect(getAnimalReactionFrames('C-E-G', 'celebrate')?.length).toBe(8);
  });

  test('keeps the generated pilot sequences scoped to Fox', () => {
    expect(getAnimalReactionFrames('F-A-C', 'not-me')).toBeNull();
    expect(getAnimalReactionFrames('C-E-G', null)).toBeNull();
  });

  test('uses only valid visible frame durations', () => {
    for (const reaction of ['hint', 'not-me', 'assisted', 'celebrate'] as const) {
      const frames = getAnimalReactionFrames('C-E-G', reaction);
      expect(frames).not.toBeNull();
      expect(frames?.every(frame => frame.source && frame.durationMs >= 50)).toBe(true);
    }
  });
});
