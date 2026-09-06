/** The initial Eguchi program. Later stages require a separately reviewed curriculum. */
export const PROTOCOL_VERSION = 'eguchi-foundation-1' as const;
export const FIRST_CHORD = {
  id: 'C-E-G',
  label: 'C major',
  notes: ['C4', 'E4', 'G4'],
  midi: [60, 64, 67],
  color: 'Red',
  hex: '#E53935',
  animal: 'Fox',
} as const;
export const PRESENTATIONS_PER_SESSION = 10;
export const PREPARATION_IDS = [
  'purpose',
  'routine',
  'sound',
  'respond',
  'care',
  'review',
] as const;
export type LessonId = (typeof PREPARATION_IDS)[number];
export type Observation = 'settled' | 'distracted' | 'tired' | 'upset' | 'listening-only';
export type ResponseKind = 'independent' | 'helped' | 'no-response';
export interface Preferences {
  timeZone: string;
  dailyGoal: 4 | 5;
  practiceTimes: string[];
  dailyEmailTime: string;
  dailyEmail: boolean;
  reviewEmail: boolean;
  dailyPush: boolean;
  reviewPush: boolean;
}
export type EventPayloads = {
  background: {
    ageMonths: number | null;
    priorTraining: 'none' | 'some' | 'unknown';
    note: string;
  };
  preferences: Partial<Preferences>;
  preparation: { lessonId: LessonId };
  pause: { date: string; paused: boolean };
  sessionStarted: {
    sessionId: string;
    timeZone: string;
    date: string;
    target: 10;
    recentPitchReference: 'yes' | 'no' | 'unknown';
  };
  trial: {
    sessionId: string;
    index: number;
    chordId: 'C-E-G';
    selectedChordId: 'C-E-G' | null;
    response: ResponseKind;
    responseMs: number;
    replays: number;
    firstSound: boolean;
    audioFile: string;
    audioHash: string;
  };
  sessionEnded: {
    sessionId: string;
    reason: 'completed' | 'stopped' | 'interrupted';
    observation: Observation;
    note: string;
  };
};
export type FoundationEvent = {
  [K in keyof EventPayloads]: {
    id: string;
    kind: K;
    at: string;
    protocol: typeof PROTOCOL_VERSION;
    data: EventPayloads[K];
  };
}[keyof EventPayloads];
export type Trial = Extract<FoundationEvent, { kind: 'trial' }>;
export interface PracticeSession {
  start: Extract<FoundationEvent, { kind: 'sessionStarted' }>;
  trials: Trial[];
  end?: Extract<FoundationEvent, { kind: 'sessionEnded' }>;
}
export interface ProgramState {
  preferences: Preferences;
  prepared: LessonId[];
  sessions: PracticeSession[];
  pausedDates: Set<string>;
  startedOn: string | null;
  reviewOn: string | null;
}
export const defaultPreferences = (
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): Preferences => ({
  timeZone,
  dailyGoal: 4,
  practiceTimes: ['07:30', '08:15', '16:00', '18:00'],
  dailyEmailTime: '17:00',
  dailyEmail: false,
  reviewEmail: false,
  dailyPush: false,
  reviewPush: false,
});
export const dateInZone = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
export const addCalendarDays = (date: string, days: number) => {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};
export const makeEvent = <K extends keyof EventPayloads>(
  kind: K,
  data: EventPayloads[K],
  at = new Date()
): Extract<FoundationEvent, { kind: K }> =>
  ({
    id: `${at.getTime().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
    kind,
    at: at.toISOString(),
    protocol: PROTOCOL_VERSION,
    data,
  }) as Extract<FoundationEvent, { kind: K }>;
export const mergeEvents = (...groups: FoundationEvent[][]): FoundationEvent[] => {
  const unique = new Map<string, FoundationEvent>();
  for (const group of groups)
    for (const event of group) if (!unique.has(event.id)) unique.set(event.id, event);
  return [...unique.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
};
export const deriveProgram = (events: FoundationEvent[], timeZone?: string): ProgramState => {
  const preferences = defaultPreferences(timeZone);
  const prepared = new Set<LessonId>();
  const sessions = new Map<string, PracticeSession>();
  const pausedDates = new Set<string>();
  const ordered = mergeEvents(events);
  for (const event of ordered) {
    if (event.protocol !== PROTOCOL_VERSION) continue;
    if (event.kind === 'preferences') Object.assign(preferences, event.data);
    if (event.kind === 'preparation') prepared.add(event.data.lessonId);
    if (event.kind === 'pause') {
      if (event.data.paused) pausedDates.add(event.data.date);
      else pausedDates.delete(event.data.date);
    }
    if (event.kind === 'sessionStarted' && !sessions.has(event.data.sessionId))
      sessions.set(event.data.sessionId, { start: event, trials: [] });
  }
  // The two passes also recover events uploaded in separate batches or out of order.
  for (const event of ordered) {
    if (event.kind === 'trial') {
      const session = sessions.get(event.data.sessionId);
      if (session && !session.trials.some(t => t.data.index === event.data.index))
        session.trials.push(event);
    }
    if (event.kind === 'sessionEnded') {
      const session = sessions.get(event.data.sessionId);
      if (session && !session.end) session.end = event;
    }
  }
  const allSessions = [...sessions.values()];
  allSessions.forEach(s => s.trials.sort((a, b) => a.data.index - b.data.index));
  const startedOn = allSessions.find(s => s.trials.length > 0)?.start.data.date ?? null;
  return {
    preferences,
    prepared: [...prepared],
    sessions: allSessions,
    pausedDates,
    startedOn,
    reviewOn: startedOn ? addCalendarDays(startedOn, 14) : null,
  };
};
export const isPrepared = (state: ProgramState) =>
  PREPARATION_IDS.every(id => state.prepared.includes(id));
export const isCompleteSession = (s: PracticeSession) =>
  s.end?.data.reason === 'completed' && s.trials.length === PRESENTATIONS_PER_SESSION;
export const todaySummary = (state: ProgramState, now = new Date()) => {
  const date = dateInZone(now, state.preferences.timeZone);
  const sessions = state.sessions.filter(s => s.start.data.date === date);
  const completed = sessions.filter(isCompleteSession).length;
  return {
    date,
    completed,
    remaining: Math.max(0, state.preferences.dailyGoal - completed),
    shortened: sessions.filter(s => s.end && !isCompleteSession(s)).length,
    paused: state.pausedDates.has(date),
    reviewDue: !!state.reviewOn && date >= state.reviewOn,
  };
};
export const nextSessionAt = (state: ProgramState, now = new Date()): Date => {
  let earliest = now.getTime();
  const sessions = state.sessions;
  const lastEnd = Math.max(0, ...sessions.map(s => Date.parse(s.end?.at ?? s.start.at)));
  if (lastEnd) earliest = Math.max(earliest, lastEnd + 15 * 60_000);
  const starts = sessions.map(s => Date.parse(s.start.at)).sort((a, b) => b - a);
  if (starts.length >= 2) earliest = Math.max(earliest, starts[1] + 60 * 60_000);
  return new Date(earliest);
};
export const validateRoutine = (goal: number, times: string[]): string | null => {
  if (times.length !== goal || times.some(t => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))
    return `Choose ${goal} times in 24-hour format, such as 07:30.`;
  const minutes = times
    .map(t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)))
    .sort((a, b) => a - b);
  if (minutes.some((m, i) => i > 0 && m - minutes[i - 1] < 20))
    return 'Leave at least 20 minutes between reminder times, allowing for a short session and a 15-minute break.';
  if (minutes.some((m, i) => i > 1 && m - minutes[i - 2] < 60))
    return 'Spread practice out: no more than two sessions in an hour.';
  return null;
};
export const reviewRecord = (events: FoundationEvent[], now = new Date()) => {
  const state = deriveProgram(events);
  return {
    protocol: PROTOCOL_VERSION,
    exportedAt: now.toISOString(),
    phase: 'red-only',
    reviewOn: state.reviewOn,
    assessment: 'not-performed',
    interpretation:
      'A single available response does not test pitch discrimination. No mastery or advancement is inferred.',
    background: [...mergeEvents(events)].reverse().find(e => e.kind === 'background') ?? null,
    prepared: state.prepared,
    preferences: state.preferences,
    pausedDates: [...state.pausedDates],
    sessions: state.sessions,
  };
};
