import { expect, test } from '@jest/globals';
import { planLocalNotifications, zonedTime } from '@/lib/foundation/notification-plan';
import { deriveProgram, makeEvent, PREPARATION_IDS } from '@/lib/foundation/program';
const now = new Date('2026-09-05T12:00:00Z');
const events = () => [
  makeEvent(
    'preferences',
    { timeZone: 'UTC', dailyPush: true, reviewPush: true },
    new Date('2026-09-01T12:00:00Z')
  ),
  ...PREPARATION_IDS.map(lessonId =>
    makeEvent('preparation', { lessonId }, new Date('2026-09-01T12:01:00Z'))
  ),
];
test('only prepared, opted-in parents receive device notifications', () => {
  expect(planLocalNotifications(deriveProgram([]), now)).toEqual([]);
  expect(planLocalNotifications(deriveProgram(events()), now).length).toBeGreaterThan(0);
});
test('rest day cancels only that day and the schedule stays within iOS capacity', () => {
  const state = deriveProgram([
    ...events(),
    makeEvent('pause', { date: '2026-09-05', paused: true }),
  ]);
  const plan = planLocalNotifications(state, now);
  expect(plan.every(item => !item.id.includes('2026-09-05'))).toBe(true);
  expect(plan.length).toBeLessThan(64);
  expect(plan.some(item => item.id.includes('2026-09-06'))).toBe(true);
});
test('time zone conversion respects daylight saving changes and skips nonexistent times', () => {
  expect(zonedTime('2026-10-31', '09:00', 'America/Los_Angeles')?.toISOString()).toBe(
    '2026-10-31T16:00:00.000Z'
  );
  expect(zonedTime('2026-11-01', '09:00', 'America/Los_Angeles')?.toISOString()).toBe(
    '2026-11-01T17:00:00.000Z'
  );
  expect(zonedTime('2026-03-08', '02:30', 'America/Los_Angeles')).toBeNull();
});
test('review notification is scheduled once for the due date, not repeatedly after it', () => {
  const state = deriveProgram(events());
  state.reviewOn = '2026-09-19';
  const plan = planLocalNotifications(state, now).filter(item =>
    item.id.startsWith('foundation-review')
  );
  expect(plan).toHaveLength(1);
  expect(plan[0].at.toISOString()).toBe('2026-09-19T09:00:00.000Z');
  expect(
    planLocalNotifications(state, new Date('2026-09-20T12:00:00Z')).some(item =>
      item.id.startsWith('foundation-review')
    )
  ).toBe(false);
});
