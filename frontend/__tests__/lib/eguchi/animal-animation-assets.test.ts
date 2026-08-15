import { getAnimalReactionPose } from '@/lib/eguchi/animal-animation-assets';
import { ORDERED_CHORD_IDS } from '@/lib/eguchi/chords';

const REACTIONS = ['hint', 'not-me', 'assisted', 'celebrate'] as const;

const EXPECTED_KIND_BY_REACTION = {
  hint: 'wink',
  'not-me': 'head-tilt',
  assisted: 'seated-smile',
  celebrate: 'jump',
} as const;

describe('animal reaction pose assets', () => {
  test('gives every animal one distinct artwork pose for every reaction', () => {
    expect(ORDERED_CHORD_IDS.length).toBe(14);

    for (const chordId of ORDERED_CHORD_IDS) {
      const poses = REACTIONS.map(reaction => getAnimalReactionPose(chordId, reaction));

      expect(poses.every(Boolean)).toBe(true);
      expect(new Set(poses).size).toBe(REACTIONS.length);
    }
  });

  test('uses the expected semantic kind and a valid duration for every pose', () => {
    for (const chordId of ORDERED_CHORD_IDS) {
      for (const reaction of REACTIONS) {
        const pose = getAnimalReactionPose(chordId, reaction);

        expect(pose?.kind).toBe(EXPECTED_KIND_BY_REACTION[reaction]);
        expect(pose?.source).toBeTruthy();
        expect(Number.isInteger(pose?.durationMs ?? Number.NaN)).toBe(true);
        expect((pose?.durationMs ?? 0) >= 400).toBe(true);
      }

      expect(
        (getAnimalReactionPose(chordId, 'celebrate')?.durationMs ?? 0) >
          (getAnimalReactionPose(chordId, 'assisted')?.durationMs ?? 0)
      ).toBe(true);
    }
  });

  test('returns null when there is no active reaction', () => {
    for (const chordId of ORDERED_CHORD_IDS) {
      expect(getAnimalReactionPose(chordId, null)).toBeNull();
    }
  });

  test('preserves the hand-tuned alignment of the original Fox poses', () => {
    expect(getAnimalReactionPose('C-E-G', 'hint')?.alignment).toBeUndefined();
    expect(getAnimalReactionPose('C-E-G', 'not-me')?.alignment).toEqual({
      offsetXRatio: -0.012,
      offsetYRatio: 0.032,
      scale: 0.91,
    });
    expect(getAnimalReactionPose('C-E-G', 'assisted')?.alignment).toEqual({
      offsetXRatio: 0.083,
      offsetYRatio: -0.008,
      scale: 1.14,
    });
    expect(getAnimalReactionPose('C-E-G', 'celebrate')?.alignment).toEqual({
      offsetXRatio: 0.077,
      offsetYRatio: 0.004,
      scale: 0.93,
    });
  });

  test('uses normalized alignment for every non-Fox pose', () => {
    for (const chordId of ORDERED_CHORD_IDS.slice(1)) {
      for (const reaction of REACTIONS) {
        expect(getAnimalReactionPose(chordId, reaction)?.alignment).toBeUndefined();
      }
    }
  });
});
