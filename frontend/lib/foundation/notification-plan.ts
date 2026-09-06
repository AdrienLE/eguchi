import {
  addCalendarDays,
  isPrepared,
  nextSessionAt,
  todaySummary,
  type ProgramState,
} from './program';
export interface PlannedNotification {
  id: string;
  at: Date;
  title: string;
  body: string;
}
/** Resolve a wall-clock time in an IANA zone, including DST. Skip nonexistent times. */
export const zonedTime = (date: string, time: string, timeZone: string): Date | null => {
  const desired = Date.parse(`${date}T${time}:00Z`);
  let guess = desired;
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  for (let i = 0; i < 4; i++) {
    const parts = format.formatToParts(new Date(guess));
    const part = (key: string) => parts.find(p => p.type === key)!.value;
    const actual = `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:00Z`;
    const delta = desired - Date.parse(actual);
    if (!delta) return new Date(guess);
    guess += delta;
  }
  return null;
};
export const planLocalNotifications = (
  state: ProgramState,
  now = new Date()
): PlannedNotification[] => {
  if (!isPrepared(state)) return [];
  const prefs = state.preferences;
  const today = todaySummary(state, now);
  const result: PlannedNotification[] = [];
  if (prefs.dailyPush)
    for (let offset = 0; offset < 7; offset++) {
      const date = addCalendarDays(today.date, offset);
      if (state.pausedDates.has(date) || (!offset && !today.remaining)) continue;
      for (const time of prefs.practiceTimes) {
        const at = zonedTime(date, time, prefs.timeZone);
        if (!at || at <= now || at < nextSessionAt(state, now)) continue;
        result.push({
          id: `foundation-daily-${date}-${time}`,
          at,
          title: 'Time for your listening friends',
          body:
            offset === 0
              ? `${today.remaining} short session${today.remaining === 1 ? '' : 's'} remaining today. Practice together when your child is ready.`
              : 'A short listening session, when your child is ready. Open Eguchi Ears to see today’s plan.',
        });
      }
    }
  if (prefs.reviewPush && state.reviewOn) {
    // Once due, do not schedule the same check-in on every launch.
    const at = zonedTime(state.reviewOn, '09:00', prefs.timeZone);
    if (at && at > now && !state.pausedDates.has(state.reviewOn))
      result.push({
        id: `foundation-review-${state.reviewOn}`,
        at,
        title: 'Your two-week check-in is due',
        body: 'Your practice record is ready. Review it and choose the next step in Parent settings.',
      });
  }
  return result;
};
