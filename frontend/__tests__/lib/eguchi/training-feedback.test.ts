import {
  classifyTrainingOutcome,
  getAnimalImageRecyclingKey,
  getCountdownVisibleSegmentCount,
  getFeedbackAnimalEmotion,
  getSuccessTileReaction,
  getSuccessFeedback,
} from '@/lib/eguchi/training-feedback';

describe('eguchi training feedback helpers', () => {
  test('never uses sad artwork as answer feedback', () => {
    expect(getFeedbackAnimalEmotion('incorrect')).toBeUndefined();
    expect(getFeedbackAnimalEmotion('correct')).toBe('happy');
    expect(getFeedbackAnimalEmotion(null)).toBeUndefined();
  });

  test('classifies completed rounds by independence and correction', () => {
    expect(classifyTrainingOutcome({ hadIncorrectTap: false, hintShown: false })).toBe(
      'independent'
    );
    expect(classifyTrainingOutcome({ hadIncorrectTap: false, hintShown: true })).toBe('assisted');
    expect(classifyTrainingOutcome({ hadIncorrectTap: true, hintShown: false })).toBe('corrected');
    expect(classifyTrainingOutcome({ hadIncorrectTap: true, hintShown: true })).toBe('corrected');
  });

  test('reserves the large celebration for independent recognition', () => {
    expect(getSuccessTileReaction('independent')).toBe('celebrate');
    expect(getSuccessTileReaction('assisted')).toBe('assisted');
    expect(getSuccessTileReaction('corrected')).toBe('assisted');
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

test('all success outcomes honor the configured pause across its full range', () => {
  for (const outcome of ['independent', 'assisted', 'corrected'] as const) {
    for (const seconds of [0.25, 1, 2, 3, 8]) {
      expect(getSuccessFeedback(outcome, seconds).durationMs).toBe(seconds * 1000);
      expect(getSuccessFeedback(outcome, seconds).reaction).toBe(getSuccessTileReaction(outcome));
    }
  }
});
