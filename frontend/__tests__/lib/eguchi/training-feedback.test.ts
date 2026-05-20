import {
  getAnimalImageRecyclingKey,
  getCountdownVisibleSegmentCount,
  getFeedbackAnimalEmotion,
} from '@/lib/eguchi/training-feedback';

describe('eguchi training feedback helpers', () => {
  test('uses sad feedback emotion for incorrect answers', () => {
    expect(getFeedbackAnimalEmotion('incorrect')).toBe('sad');
    expect(getFeedbackAnimalEmotion('correct')).toBe('happy');
    expect(getFeedbackAnimalEmotion(null)).toBeUndefined();
  });

  test('image recycling keys change when emotion changes', () => {
    expect(getAnimalImageRecyclingKey('tile', 'F-A-C', 'sad')).not.toBe(
      getAnimalImageRecyclingKey('tile', 'F-A-C', 'happy')
    );
  });

  test('countdown ring segments shrink as time runs out', () => {
    expect(getCountdownVisibleSegmentCount(1, 40)).toBe(40);
    expect(getCountdownVisibleSegmentCount(0.5, 40)).toBe(20);
    expect(getCountdownVisibleSegmentCount(0.01, 40)).toBe(1);
    expect(getCountdownVisibleSegmentCount(0, 40)).toBe(0);
  });

  test('countdown ring segment count clamps unsafe values', () => {
    expect(getCountdownVisibleSegmentCount(5, 40)).toBe(40);
    expect(getCountdownVisibleSegmentCount(-1, 40)).toBe(0);
    expect(getCountdownVisibleSegmentCount(Number.NaN, 40)).toBe(0);
    expect(getCountdownVisibleSegmentCount(1, -3)).toBe(0);
  });
});
