import { expect, test } from '@jest/globals';
import {
  addCalendarDays,
  dateInZone,
  defaultPreferences,
  deriveProgram,
  FIRST_CHORD,
  isPrepared,
  makeEvent,
  mergeEvents,
  nextSessionAt,
  PREPARATION_IDS,
  reviewRecord,
  todaySummary,
  validateRoutine,
  type FoundationEvent,
} from '@/lib/foundation/program';
const at = (s: string) => new Date(`2026-09-${s}Z`);
const start = (id: string, timestamp = '05T15:00:00') =>
  makeEvent(
    'sessionStarted',
    {
      sessionId: id,
      timeZone: 'America/Los_Angeles',
      date: '2026-09-05',
      target: 10,
      recentPitchReference: 'no',
    },
    at(timestamp)
  );
const trial = (id: string, index: number) =>
  makeEvent(
    'trial',
    {
      sessionId: id,
      index,
      chordId: 'C-E-G',
      selectedChordId: 'C-E-G',
      response: 'independent',
      responseMs: 1400,
      replays: 0,
      firstSound: index === 0,
      audioFile: 'red.mp3',
      audioHash: 'a'.repeat(64),
    },
    at(`05T15:0${Math.floor(index / 6)}:${String((index * 5) % 60).padStart(2, '0')}`)
  );
const end = (
  id: string,
  reason: 'completed' | 'stopped' = 'completed',
  timestamp = '05T15:03:00'
) =>
  makeEvent(
    'sessionEnded',
    { sessionId: id, reason, observation: 'settled', note: '' },
    at(timestamp)
  );

test('first chord is the fixed middle-register red chord', () => {
  expect(FIRST_CHORD.midi).toEqual([60, 64, 67]);
  expect(FIRST_CHORD.color).toBe('Red');
});
test('every preparation lesson is required, and duplicate acknowledgements do not skip one', () => {
  const events = PREPARATION_IDS.map(lessonId => makeEvent('preparation', { lessonId }));
  expect(isPrepared(deriveProgram(events))).toBe(true);
  expect(isPrepared(deriveProgram([...events.slice(1), events[1]]))).toBe(false);
});
test('two-week review begins with actual practice and never adds a chord or claims mastery', () => {
  expect(deriveProgram([start('s')]).reviewOn).toBeNull();
  const events = [start('s'), trial('s', 0)];
  expect(deriveProgram(events).reviewOn).toBe('2026-09-19');
  expect(todaySummary(deriveProgram(events), at('19T15:00:00')).reviewDue).toBe(true);
  expect(reviewRecord(events).assessment).toBe('not-performed');
  expect(reviewRecord(events).phase).toBe('chord-colors');
});
test('counts only completed ten-presentation sessions; keeps early stops without creating catch-up debt', () => {
  const events = [
    start('full'),
    ...Array.from({ length: 10 }, (_, i) => trial('full', i)),
    end('full'),
    start('short'),
    trial('short', 0),
    end('short', 'stopped'),
  ];
  const state = deriveProgram(events);
  expect(todaySummary(state, at('05T17:00:00'))).toMatchObject({
    completed: 1,
    remaining: 3,
    shortened: 1,
  });
  expect(todaySummary(state, at('06T17:00:00'))).toMatchObject({ completed: 0, remaining: 4 });
  const paused = deriveProgram([
    ...events,
    makeEvent('pause', { date: '2026-09-05', paused: true }),
  ]);
  expect(todaySummary(paused, at('05T17:00:00')).paused).toBe(true);
});
test('enforces a fifteen-minute break and no third session within an hour', () => {
  const one = deriveProgram([start('a'), end('a')]);
  expect(nextSessionAt(one, at('05T15:05:00')).toISOString()).toBe('2026-09-05T15:18:00.000Z');
  const two = deriveProgram([
    start('a'),
    end('a'),
    start('b', '05T15:20:00'),
    end('b', 'completed', '05T15:23:00'),
  ]);
  expect(nextSessionAt(two, at('05T15:40:00')).toISOString()).toBe('2026-09-05T16:00:00.000Z');
});
test('sync is idempotent, preserves responses, and resolves partial preference updates chronologically', () => {
  const first = makeEvent('preferences', { dailyGoal: 5 }, at('05T12:00:00'));
  const second = makeEvent('preferences', { reviewEmail: true }, at('05T13:00:00'));
  const response = trial('a', 0);
  const events = mergeEvents([second, response], [start('a'), first, response]);
  expect(events).toHaveLength(4);
  expect(deriveProgram(events).preferences).toMatchObject({ dailyGoal: 5, reviewEmail: true });
  expect(deriveProgram(events).sessions[0].trials).toEqual([response]);
});
test('calendar dates and review dates remain local across DST and midnight', () => {
  expect(dateInZone(new Date('2026-09-06T06:59:59Z'), 'America/Los_Angeles')).toBe('2026-09-05');
  expect(addCalendarDays('2026-10-25', 14)).toBe('2026-11-08');
  expect(addCalendarDays('2028-02-20', 14)).toBe('2028-03-05');
});
test('invalid or crammed reminder times cannot be saved', () => {
  expect(validateRoutine(4, defaultPreferences().practiceTimes)).toBeNull();
  expect(validateRoutine(4, ['07:00', '07:20', '07:40', '18:00'])).toContain('two sessions');
  expect(validateRoutine(4, ['07:00', '07:10', '16:00', '18:00'])).toContain('20 minutes');
  expect(validateRoutine(4, ['25:00', '08:15', '16:00', '18:00'])).toContain('24-hour');
});
test('export retains parent context and immutable stimulus evidence without an invented score', () => {
  const events: FoundationEvent[] = [
    start('s'),
    { ...trial('s', 0), data: { ...trial('s', 0).data, response: 'helped', replays: 1 } },
    end('s', 'stopped'),
  ];
  const record = reviewRecord(events);
  expect(record.sessions[0].trials[0].data).toMatchObject({
    response: 'helped',
    replays: 1,
    firstSound: true,
  });
  expect(record.sessions[0].start.data.recentPitchReference).toBe('no');
  expect(record.sessions[0].end?.data.reason).toBe('stopped');
  expect(record.interpretation).toContain('One-choice trials measure participation only');
});

test('parent check-ins schedule another fortnight without changing the animal plan', () => {
  const events: FoundationEvent[] = [
    start('one', '05T15:00:00'),
    trial('one', 0),
    makeEvent(
      'preferences',
      { stage: 14, activeChordIds: ['C-E-G', 'Eb-G-Bb'] },
      at('06T15:00:00')
    ),
  ];
  const before = deriveProgram(events);
  events.push(
    makeEvent(
      'checkIn',
      { date: '2026-09-20', timeZone: 'UTC', note: 'Still mixing these two.' },
      at('20T15:00:00')
    )
  );
  const after = deriveProgram(events);
  expect(after.reviewOn).toBe('2026-10-04');
  expect(after.preferences).toEqual(before.preferences);
  expect(reviewRecord(events).checkIns[0].data.note).toBe('Still mixing these two.');
});
