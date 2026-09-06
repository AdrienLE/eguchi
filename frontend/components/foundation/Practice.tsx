import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
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
import AnimalCard from './AnimalCard';
import { Body, Button, Card, Heading, Notice, Page, styles, usePalette } from './ui';

type Phase = 'before' | 'listen' | 'respond' | 'recorded' | 'finish' | 'done';
export default function Practice() {
  const f = useFoundation();
  const piano = usePiano();
  const router = useRouter();
  const p = usePalette();
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>('before');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [choices, setChoices] = useState<ChordId[]>(f.state.preferences.activeChordIds);
  const [plan, setPlan] = useState<ChordId[]>([]);
  const [pitchReference, setPitchReference] = useState<'yes' | 'no' | 'unknown'>('unknown');
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
      const now = new Date();
      const today = todaySummary(state, now);
      if (!isPrepared(state) || today.paused || !today.remaining || nextSessionAt(state, now) > now)
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
            recentPitchReference: pitchReference,
          },
          now
        )
      );
      current.current = { sessionId: id, count: 0, target: presentations.length, ended: false };
      setChoices(active);
      setPlan(presentations);
      setSessionId(id);
      setPhase('listen');
    });
  const play = () =>
    guarded(async () => {
      if (current.current.ended) return;
      const started = await piano.play(stimulus);
      if (current.current.ended) {
        await piano.stop();
        return;
      }
      if (startedAt.current === null) startedAt.current = started;
      else setReplays(value => Math.min(50, value + 1));
      setPhase('respond');
    });
  const savePendingTrial = async () => {
    const trial = pendingTrial.current;
    if (!trial || current.current.ended) return;
    await f.append(trial);
    pendingTrial.current = null;
    current.current.count = trial.data.index + 1;
    setCount(trial.data.index + 1);
    setLastResponse(trial.data.response);
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
        try {
          await piano.play(stimulus);
          actualReplays = Math.min(50, actualReplays + 1);
        } catch {}
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
  const next = () => {
    if (count === target) setPhase('finish');
    else {
      startedAt.current = null;
      setReplays(0);
      setRevealed(false);
      setPhase('listen');
    }
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
  if (phase === 'before')
    return (
      <Page title="A little listening together" subtitle={`${target} presentations · then a break`}>
        <Card>
          <Heading>Ready?</Heading>
          <Body>Quiet room, comfortable volume, a willing child.</Body>
          <View style={[styles.row, { justifyContent: 'center' }]}>
            {f.state.preferences.activeChordIds.map(id => (
              <AnimalCard key={id} id={id} size={70} />
            ))}
          </View>
          <Body>Heard music or piano just now?</Body>
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
          disabled={!piano.ready || !isPrepared(f.state)}
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
        {error && <Notice>{error}</Notice>}
        <Button title="Save & finish" busy={busy} onPress={() => void finish()} />
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
  const landscape = width > height && width >= 900;
  const layout = animalGridLayout(choices.length, gridArea.width, gridArea.height);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF9ED', padding: 16, gap: 10 }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={{ color: '#536B75', fontSize: 17, fontWeight: '600' }}>
          {count} of {target}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={stopEarly}
          style={{ padding: 12 }}
        >
          <Text style={{ color: p.tint, fontSize: 17 }}>Finish early</Text>
        </Pressable>
      </View>
      <View
        style={{
          flex: 1,
          flexDirection: landscape ? 'row' : 'column',
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
                muted={revealed && id !== stimulus}
                disabled={phase !== 'respond' || busy || revealed || !!pendingTrial.current}
                onPress={() => void choose(id)}
              />
            ))}
          </View>
        </View>
        <View
          style={{
            gap: 10,
            width: landscape ? 290 : '100%',
            maxWidth: landscape ? 290 : 650,
            alignSelf: 'center',
            justifyContent: 'center',
          }}
        >
          <Heading>
            {revealed
              ? `This is ${CURRICULUM_BY_ID[stimulus].color}`
              : phase === 'listen'
                ? 'Let’s listen'
                : 'Which friend did you hear?'}
          </Heading>
          {pendingTrial.current ? (
            <Button
              title="Retry saving response"
              busy={busy}
              onPress={() => void guarded(savePendingTrial)}
            />
          ) : phase === 'recorded' ? (
            <>
              <Body>
                {lastResponse === 'independent'
                  ? 'Response recorded.'
                  : 'Gently give the color name and show its friend.'}
              </Body>
              <Button
                title={count === target ? 'Finish this session' : 'Next presentation'}
                disabled={piano.playing}
                onPress={next}
              />
            </>
          ) : (
            <>
              <Button
                title={
                  piano.playing
                    ? 'Listening…'
                    : phase === 'listen'
                      ? 'Play the chord'
                      : 'Play again'
                }
                disabled={!piano.ready || piano.playing || replays >= 50}
                busy={busy}
                onPress={() => void play()}
              />
              {phase === 'respond' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        secondary
                        title="Needed help"
                        busy={busy}
                        onPress={() => void respond('helped')}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        secondary
                        title="No response"
                        busy={busy}
                        onPress={() => void respond('no-response')}
                      />
                    </View>
                  </View>
                  {choices.length === 1 && (
                    <Button
                      secondary
                      title="Independent response"
                      busy={busy}
                      onPress={() => void choose(stimulus)}
                    />
                  )}
                </>
              )}
              {phase === 'respond' && (
                <Text style={{ fontSize: 14, color: '#536B75', textAlign: 'center' }}>
                  Unsure? Help right away. A parent can tap for the child.
                </Text>
              )}
            </>
          )}
          {(error || piano.error) && <Notice>{error ?? piano.error}</Notice>}
        </View>
      </View>
    </SafeAreaView>
  );
}
