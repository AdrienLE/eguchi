import React, { useEffect, useRef, useState } from 'react';
import { AppState, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFoundation } from '@/lib/foundation/FoundationProvider';
import { FOUNDATION_AUDIO, usePiano } from '@/lib/foundation/usePiano';
import {
  dateInZone,
  isPrepared,
  makeEvent,
  nextSessionAt,
  todaySummary,
  type Observation,
  type Trial,
  type ResponseKind,
} from '@/lib/foundation/program';
import {
  CURRICULUM_BY_ID,
  planPresentations,
  sessionTarget,
  type ChordId,
} from '@/lib/foundation/curriculum';
import { animalGridLayout } from '@/lib/foundation/grid';
import { useAppearance } from '@/lib/foundation/Appearance';
import { DEFAULT_FEEDBACK_MS } from '@/lib/foundation/playroom-options';
import AnimalCard from './AnimalCard';
import NoResponseButton from './NoResponseButton';
import { Body, Button, Card, Heading, Notice, Page, PictureButton, styles, usePalette } from './ui';

type Phase = 'before' | 'listen' | 'respond' | 'recorded' | 'finish' | 'done';
export const FEEDBACK_MS = DEFAULT_FEEDBACK_MS;
export default function Practice() {
  const f = useFoundation();
  const piano = usePiano();
  const router = useRouter();
  const params = useLocalSearchParams<{ start?: string; reference?: string }>();
  const quickStart = params.start === '1';
  const autoBeginAttempted = useRef(false);
  const p = usePalette();
  const { background, options, ready: optionsReady } = useAppearance();
  const feedbackMs = options.feedbackMs;
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>('before');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [choices, setChoices] = useState<ChordId[]>(f.state.preferences.activeChordIds);
  const [plan, setPlan] = useState<ChordId[]>([]);
  const [pitchReference, setPitchReference] = useState<'yes' | 'no' | 'unknown'>(
    params.reference === 'yes' || params.reference === 'no' ? params.reference : 'unknown'
  );
  const [previewed, setPreviewed] = useState(false);
  const [previewId, setPreviewId] = useState<ChordId>(choices[0]);
  const [paused, setPaused] = useState(false);
  const [feedbackElapsed, setFeedbackElapsed] = useState(false);
  const [feedbackProgress, setFeedbackProgress] = useState(0);
  const [helped, setHelped] = useState(false);
  const [showObservation, setShowObservation] = useState(false);
  const lastTrial = useRef<Trial | null>(null);
  const advanceRef = useRef<() => void>(() => {});
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [replays, setReplays] = useState(0);
  const startedAt = useRef<number | null>(null);
  const [observation, setObservation] = useState<Observation>('not-recorded');
  const [note, setNote] = useState('');
  const [lastResponse, setLastResponse] = useState<ResponseKind | null>(null);
  const [revealed, setRevealed] = useState(false);
  const pendingTrial = useRef<Trial | null>(null);
  const [gridArea, setGridArea] = useState({ width: width - 40, height: height - 260 });
  const current = useRef({ sessionId: null as string | null, count: 0, target: 10, ended: false });
  const finishing = useRef(false);
  const stateRef = useRef(f);
  stateRef.current = f;
  const pianoRef = useRef(piano);
  pianoRef.current = piano;
  const target = plan.length || sessionTarget(f.state.preferences.activeChordIds);
  const stimulus = plan[phase === 'recorded' ? Math.max(0, count - 1) : count] ?? choices[0];
  const interrupt = async () => {
    const session = current.current;
    if (!session.sessionId || session.ended || finishing.current) return;
    session.ended = true;
    try {
      await stateRef.current.store.append(
        makeEvent('sessionEnded', {
          sessionId: session.sessionId,
          reason: session.count === session.target ? 'completed' : 'interrupted',
          observation: 'not-recorded',
          note: '',
        })
      );
    } catch {
      session.ended = false;
    }
  };
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active' && current.current.sessionId && !current.current.ended) {
        void pianoRef.current.stop().catch(() => {});
        void interrupt().then(() => {
          setPhase('done');
          setError('Session stopped. Your recorded responses were kept.');
        });
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      void interrupt();
    };
  }, []);
  const guarded = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please retry.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const begin = () =>
    guarded(async () => {
      const state = stateRef.current.state;
      if (!optionsReady) throw new Error('Please wait for your practice controls to load.');
      const now = new Date();
      const today = todaySummary(state, now);
      if (
        !f.debug &&
        (!isPrepared(state) || today.paused || !today.remaining || nextSessionAt(state, now) > now)
      )
        throw new Error('Return to your daily plan before starting.');
      const active = [...state.preferences.activeChordIds];
      const presentations = planPresentations(active, state.preferences.introductionChordId);
      const id = makeEvent('pause', { date: today.date, paused: false }).id;
      await f.append(
        makeEvent(
          'sessionStarted',
          {
            sessionId: id,
            timeZone: state.preferences.timeZone,
            date: dateInZone(now, state.preferences.timeZone),
            target: presentations.length as 10 | 30,
            activeChordIds: active,
            presentationPlan: presentations,
            recentPitchReference: previewed ? 'yes' : pitchReference,
          },
          now
        )
      );
      current.current = { sessionId: id, count: 0, target: presentations.length, ended: false };
      setChoices(active);
      setPlan(presentations);
      setSessionId(id);
      setPhase('listen');
      await playSound(presentations[0]);
    });
  const playSound = async (id: ChordId) => {
    if (current.current.ended || !mounted.current) return;
    const started = await piano.play(id);
    if (current.current.ended || !mounted.current) {
      await piano.stop();
      return;
    }
    if (startedAt.current === null) startedAt.current = started;
    else setReplays(value => Math.min(50, value + 1));
    setPhase('respond');
  };
  const play = () => guarded(() => playSound(stimulus));
  const beginRef = useRef(begin);
  beginRef.current = begin;
  useEffect(() => {
    if (!quickStart || !f.ready || !optionsReady || !piano.ready || autoBeginAttempted.current)
      return;
    autoBeginAttempted.current = true;
    void beginRef.current();
  }, [quickStart, f.ready, optionsReady, piano.ready]);
  const preview = (id: ChordId) =>
    guarded(async () => {
      await piano.play(id);
      setPreviewId(id);
      setPreviewed(true);
      setPitchReference('yes');
    });
  const savePendingTrial = async () => {
    const trial = pendingTrial.current;
    if (!trial || current.current.ended) return;
    await f.append(trial);
    pendingTrial.current = null;
    lastTrial.current = trial;
    current.current.count = trial.data.index + 1;
    setCount(trial.data.index + 1);
    if (current.current.ended || !mounted.current) return;
    setLastResponse(trial.data.response);
    setHelped(false);
    setFeedbackElapsed(false);
    setRevealed(true);
    setPhase('recorded');
  };
  const respond = (response: ResponseKind, selected: ChordId | null = null) =>
    guarded(async () => {
      if (
        !sessionId ||
        startedAt.current === null ||
        current.current.ended ||
        phase !== 'respond' ||
        pendingTrial.current
      )
        return;
      const responseMs = Math.min(3600000, Math.max(0, Date.now() - startedAt.current));
      let actualReplays = replays;
      if (response !== 'independent') {
        setRevealed(true);
        if (!piano.playing) {
          try {
            await piano.play(stimulus);
            actualReplays = Math.min(50, actualReplays + 1);
          } catch {}
        }
      }
      if (current.current.ended) return;
      const audio = FOUNDATION_AUDIO[stimulus];
      pendingTrial.current = makeEvent('trial', {
        sessionId,
        index: count,
        chordId: stimulus,
        selectedChordId: selected,
        response,
        responseMs,
        replays: actualReplays,
        firstSound: count === 0,
        audioFile: audio.audioFile,
        audioHash: audio.sha256,
      });
      await savePendingTrial();
    });
  const choose = (id: ChordId) => respond(id === stimulus ? 'independent' : 'incorrect', id);
  const next = () =>
    guarded(async () => {
      if (current.current.ended || !mounted.current) return;
      setFeedbackElapsed(false);
      if (count === target) setPhase('finish');
      else {
        startedAt.current = null;
        setReplays(0);
        setRevealed(false);
        setPhase('listen');
        await playSound(plan[count]);
      }
    });
  advanceRef.current = () => void next();
  useEffect(() => {
    if (phase !== 'recorded' || paused || busy || error) return;
    const started = Date.now();
    setFeedbackProgress(0);
    const progress = setInterval(() => {
      setFeedbackProgress(Math.min(1, (Date.now() - started) / feedbackMs));
    }, 50);
    const timer = setTimeout(() => {
      clearInterval(progress);
      setFeedbackProgress(1);
      setFeedbackElapsed(true);
    }, feedbackMs);
    return () => {
      clearTimeout(timer);
      clearInterval(progress);
    };
  }, [phase, count, paused, busy, error, helped, feedbackMs]);
  useEffect(() => {
    if (phase === 'recorded' && feedbackElapsed && !paused && !busy && !piano.playing && !error)
      advanceRef.current();
  }, [phase, feedbackElapsed, paused, busy, piano.playing, error]);
  const markHelp = () =>
    guarded(async () => {
      const trial = lastTrial.current;
      if (!trial || current.current.ended) return;
      setFeedbackElapsed(false);
      await f.append(
        makeEvent('trialAssistance', {
          sessionId: trial.data.sessionId,
          trialId: trial.id,
          helped: !helped,
        })
      );
      setHelped(value => !value);
    });
  const togglePause = () => {
    setFeedbackElapsed(false);
    setPaused(value => !value);
  };
  const finish = () =>
    guarded(async () => {
      if (!sessionId || current.current.ended) return;
      finishing.current = true;
      try {
        await piano.stop();
        await f.append(
          makeEvent('sessionEnded', {
            sessionId,
            reason: count === target ? 'completed' : 'stopped',
            observation,
            note: note.trim(),
          })
        );
        current.current.ended = true;
        setPhase('done');
      } finally {
        finishing.current = false;
      }
    });
  const stopEarly = () => {
    void piano.stop().catch(() => {});
    setPhase('finish');
  };
  if (!f.ready)
    return (
      <Page title="Opening practice">
        <Body>{f.error ?? 'Please wait…'}</Body>
      </Page>
    );
  if (phase === 'before' && quickStart && !error && !piano.error)
    return (
      <Page title="Let’s listen">
        <Body>Getting the piano ready…</Body>
      </Page>
    );
  if (phase === 'before')
    return (
      <Page
        title="A little listening together"
        subtitle={`${target} presentations · then a break`}
        backgroundPicker
      >
        <Card>
          <Heading>Ready?</Heading>
          <Body>Quiet room, comfortable volume, a willing child.</Body>
          <View style={[styles.row, { justifyContent: 'center' }]}>
            {f.state.preferences.activeChordIds.map(id => (
              <AnimalCard
                key={id}
                id={id}
                size={70}
                disabled={busy || !piano.ready}
                onPress={() => void preview(id)}
              />
            ))}
          </View>
          <View style={{ alignItems: 'center' }}>
            <PictureButton
              icon="volume-high"
              label="Preview sound"
              caption="Hear the sound"
              disabled={busy || !piano.ready}
              onPress={() => void preview(previewId)}
            />
          </View>
          <Body>{previewed ? 'Sound previewed just now.' : 'Heard music or piano just now?'}</Body>
          {!previewed && (
            <View style={styles.row}>
              {(['no', 'yes', 'unknown'] as const).map(value => (
                <Button
                  secondary={pitchReference !== value}
                  key={value}
                  title={value === 'no' ? 'No' : value === 'yes' ? 'Yes' : 'Not sure'}
                  onPress={() => setPitchReference(value)}
                />
              ))}
            </View>
          )}
        </Card>
        {f.state.preferences.introductionChordId && (
          <Notice>
            Introducing {CURRICULUM_BY_ID[f.state.preferences.introductionChordId].color}: give its
            name and show its animal when help is needed.
          </Notice>
        )}
        {(error || piano.error) && <Notice>{error ?? piano.error}</Notice>}
        <Button
          title="We’re ready to listen"
          disabled={!piano.ready || !optionsReady || (!f.debug && !isPrepared(f.state))}
          busy={busy}
          onPress={() => void begin()}
        />
      </Page>
    );
  if (phase === 'finish')
    return (
      <Page
        title={count === target ? 'A little session, finished' : 'It’s fine to stop here'}
        subtitle={`${count} of ${target} presentations recorded.`}
        back={false}
      >
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 70 }} accessibilityLabel="A little rest">
            🌤️
          </Text>
        </View>
        <Button title="Save & finish" busy={busy} onPress={() => void finish()} />
        <Button
          secondary
          title={showObservation ? 'Hide parent note' : 'Add a parent note'}
          onPress={() => setShowObservation(value => !value)}
        />
        {showObservation && (
          <Card>
            <Heading>How was your child today?</Heading>
            {(
              ['not-recorded', 'settled', 'distracted', 'tired', 'upset', 'listening-only'] as const
            ).map(value => (
              <Button
                key={value}
                title={
                  {
                    'not-recorded': 'No observation',
                    settled: 'Settled and willing',
                    distracted: 'Distracted',
                    tired: 'Tired',
                    upset: 'Upset / unwilling',
                    'listening-only': 'Mostly just listening',
                  }[value]
                }
                secondary={observation !== value}
                onPress={() => setObservation(value)}
              />
            ))}
            <TextInput
              accessibilityLabel="Optional parent observation"
              placeholder="Anything to remember? (optional)"
              placeholderTextColor={p.subtleText}
              multiline
              maxLength={2000}
              value={note}
              onChangeText={setNote}
              style={[styles.input, { color: p.text, minHeight: 90, textAlignVertical: 'top' }]}
            />
          </Card>
        )}
        {error && <Notice>{error}</Notice>}
      </Page>
    );
  if (phase === 'done')
    return (
      <Page title="Time for a break" subtitle="Thank you for listening together." back={false}>
        <Card>
          <Heading>
            {count === target ? 'One full session recorded' : `${count} presentations kept`}
          </Heading>
          <Body>Take at least 15 minutes before another session. No catch-up needed.</Body>
          {error && <Notice>{error}</Notice>}
          <Button title="Back to today’s plan" onPress={() => router.replace('/')} />
        </Card>
      </Page>
    );
  const layout = animalGridLayout(choices.length, gridArea.width, gridArea.height);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background.color, padding: 16, gap: 10 }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={{ color: background.textColor, fontSize: 17, fontWeight: '600' }}>
          {count} of {target}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <PictureButton
            small
            icon={paused ? 'play' : 'pause'}
            label={paused ? 'Resume practice' : 'Pause practice'}
            selected={paused}
            disabled={busy}
            onPress={togglePause}
          />
          <PictureButton
            small
            icon="close"
            label="Finish early"
            disabled={busy}
            onPress={stopEarly}
          />
        </View>
      </View>
      <View
        style={{
          flex: 1,
          flexDirection: 'column',
          gap: 16,
          maxWidth: 1400,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <View
          onLayout={event => setGridArea(event.nativeEvent.layout)}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
              width: layout.columns * (layout.size + 20) + (layout.columns - 1) * 10,
            }}
          >
            {choices.map(id => (
              <AnimalCard
                key={id}
                id={id}
                size={layout.size}
                selected={revealed && id === stimulus}
                react={options.animalMotion && phase === 'recorded' && id === stimulus && !paused}
                muted={revealed && id !== stimulus}
                disabled={
                  phase !== 'respond' || busy || paused || revealed || !!pendingTrial.current
                }
                onPress={() => void choose(id)}
              />
            ))}
          </View>
        </View>
        <View
          style={{
            gap: 4,
            width: '100%',
            maxWidth: 650,
            alignSelf: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <Heading>
              {paused
                ? 'A little pause'
                : revealed
                  ? CURRICULUM_BY_ID[stimulus].color
                  : 'Let’s listen'}
            </Heading>
          </View>
          {pendingTrial.current ? (
            <Button
              title="Retry saving response"
              busy={busy}
              onPress={() => void guarded(savePendingTrial)}
            />
          ) : phase === 'recorded' ? (
            <View
              style={{ alignItems: 'center', minHeight: 120, justifyContent: 'center', gap: 12 }}
            >
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Next sound"
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: Math.round(feedbackProgress * 100),
                  text: paused
                    ? 'Paused'
                    : feedbackElapsed && piano.playing
                      ? 'Finishing sound'
                      : 'Next sound',
                }}
                style={{
                  width: '75%',
                  maxWidth: 360,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: background.surfaceColor,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${feedbackProgress * 100}%`,
                    height: '100%',
                    backgroundColor: background.accentColor,
                    borderRadius: 6,
                  }}
                />
              </View>
              {lastResponse !== 'no-response' && (
                <PictureButton
                  small
                  icon={helped ? 'hand-left' : 'hand-left-outline'}
                  label={helped ? 'Undo parent help' : 'I helped'}
                  caption={helped ? 'Help noted' : 'I helped'}
                  selected={helped}
                  disabled={busy}
                  onPress={() => void markHelp()}
                />
              )}
              {error && (
                <Button
                  title="Continue"
                  secondary
                  onPress={() => {
                    setError(null);
                    setFeedbackElapsed(false);
                  }}
                />
              )}
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 120,
                gap: 24,
              }}
            >
              <PictureButton
                icon="volume-high"
                label={phase === 'listen' ? 'Play sound' : 'Replay sound'}
                caption={
                  piano.playing ? 'Listening…' : phase === 'listen' ? 'Listen' : 'Listen again'
                }
                disabled={!piano.ready || piano.playing || replays >= 50 || busy || paused}
                onPress={() => void play()}
              />
              {phase === 'respond' && (
                <NoResponseButton
                  requireHold={options.holdNoResponse}
                  disabled={busy || paused}
                  onRespond={() => void respond('no-response')}
                />
              )}
            </View>
          )}
          {(error || piano.error) && <Notice>{error ?? piano.error}</Notice>}
        </View>
      </View>
    </SafeAreaView>
  );
}
