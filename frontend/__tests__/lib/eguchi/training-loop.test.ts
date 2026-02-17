import { getAutoAdvanceProgress, getAutoAdvanceSeconds, pickRandomChordId } from '@/lib/eguchi/training-loop';

describe('eguchi training loop helpers', () => {
  test('pickRandomChordId chooses first and last slots deterministically', () => {
    const ids = ['C-E-G', 'F-A-C', 'G-B-D'] as const;

    expect(pickRandomChordId([...ids], 0)).toBe('C-E-G');
    expect(pickRandomChordId([...ids], 0.51)).toBe('F-A-C');
    expect(pickRandomChordId([...ids], 0.999999)).toBe('G-B-D');
  });

  test('pickRandomChordId throws for empty lists', () => {
    expect(() => pickRandomChordId([])).toThrow('Cannot pick a chord from an empty list.');
  });

  test('getAutoAdvanceProgress clamps bounds', () => {
    expect(getAutoAdvanceProgress(null, 3000)).toBe(0);
    expect(getAutoAdvanceProgress(1500, 3000)).toBe(0.5);
    expect(getAutoAdvanceProgress(9999, 3000)).toBe(1);
    expect(getAutoAdvanceProgress(-10, 3000)).toBe(0);
  });

  test('getAutoAdvanceSeconds rounds up and keeps minimum at one', () => {
    expect(getAutoAdvanceSeconds(null)).toBeNull();
    expect(getAutoAdvanceSeconds(2001)).toBe(3);
    expect(getAutoAdvanceSeconds(1000)).toBe(1);
    expect(getAutoAdvanceSeconds(1)).toBe(1);
  });
});
