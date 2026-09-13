import { expect, test } from '@jest/globals';
import { aiReviewSchedule } from '@/lib/foundation/review-status';

test('a future AI review is upcoming, without asking the parent to share or check in', () => {
  expect(aiReviewSchedule('2026-09-26', '2026-09-12')).toBe('Next AI review: Sep 26, 2026.');
});

test.each(['2026-09-12', '2026-09-11'])(
  'a due or overdue AI review stays a server task: %s',
  date => {
    expect(aiReviewSchedule(date, '2026-09-12')).toBe(
      'AI review pending. Keep practicing as usual.'
    );
  }
);

test('no schedule does not invent a review date', () => {
  expect(aiReviewSchedule(null, '2026-09-12')).toBe(
    'The first AI review is two weeks after synced practice begins.'
  );
});
