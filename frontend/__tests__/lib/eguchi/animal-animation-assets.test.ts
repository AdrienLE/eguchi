import { getAnimalReactionPose } from '@/lib/eguchi/animal-animation-assets';

describe('animal reaction pose assets', () => {
  test('gives the Fox one replacement artwork pose for every reaction', () => {
    const poses = ['hint', 'not-me', 'assisted', 'celebrate'].map(reaction =>
      getAnimalReactionPose('C-E-G', reaction as 'hint' | 'not-me' | 'assisted' | 'celebrate')
    );

    expect(poses.every(Boolean)).toBe(true);
    expect(new Set(poses).size).toBe(4);
  });

  test('keeps the pilot poses scoped to Fox', () => {
    expect(getAnimalReactionPose('F-A-C', 'not-me')).toBeNull();
    expect(getAnimalReactionPose('C-E-G', null)).toBeNull();
  });

  test('uses valid display durations and makes the independent smile last longest', () => {
    for (const reaction of ['hint', 'not-me', 'assisted', 'celebrate'] as const) {
      const pose = getAnimalReactionPose('C-E-G', reaction);
      expect(pose?.source).toBeTruthy();
      expect((pose?.durationMs ?? 0) >= 400).toBe(true);
    }

    expect(
      (getAnimalReactionPose('C-E-G', 'celebrate')?.durationMs ?? 0) >
        (getAnimalReactionPose('C-E-G', 'assisted')?.durationMs ?? 0)
    ).toBe(true);
  });
});
