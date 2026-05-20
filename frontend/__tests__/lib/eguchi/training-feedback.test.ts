import {
  getAnimalImageRecyclingKey,
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
});
