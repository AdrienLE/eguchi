import React, { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { useFoundation } from '@/lib/foundation/FoundationProvider';
import { isPrepared, makeEvent, nextSessionAt, todaySummary } from '@/lib/foundation/program';
import { CHORD_CURRICULUM, sessionTarget } from '@/lib/foundation/curriculum';
import AnimalCard from './AnimalCard';
import { Button, Body, Card, Heading, Notice, Page, styles, usePalette } from './ui';
export default function ParentHome() {
  const f = useFoundation();
  const router = useRouter();
  const p = usePalette();
  const { token } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { ready, store } = f;
  const current = useRef(f);
  current.current = f;
  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      for (const session of current.current.state.sessions.filter(s => !s.end))
        void store
          .append(
            makeEvent('sessionEnded', {
              sessionId: session.start.data.sessionId,
              reason:
                session.trials.length === session.start.data.target ? 'completed' : 'interrupted',
              observation: 'not-recorded',
              note: '',
            })
          )
          .catch(() =>
            setError('An interrupted session could not be saved. Please reopen the app.')
          );
    }, [ready, store])
  );
  if (!ready)
    return (
      <Page title="Eguchi Ears" back={false}>
        <Body>{f.error ?? 'Opening your practice record…'}</Body>
      </Page>
    );
  const today = todaySummary(f.state, f.now);
  const prepared = f.debug || isPrepared(f.state);
  const next = nextSessionAt(f.state, f.now);
  const waiting = !f.debug && next > f.now;
  const pause = async () => {
    try {
      await f.append(makeEvent('pause', { date: today.date, paused: !today.paused }));
    } catch {
      setError('Could not save. Please retry.');
    }
  };
  return (
    <Page
      title={prepared ? 'Hello, listening friends!' : 'A world of sounds to discover'}
      subtitle={
        prepared
          ? 'Little moments, colorful friends.'
          : 'Learn piano sounds through colors and animals, together.'
      }
      back={false}
    >
      {error && <Notice>{error}</Notice>}
      {!prepared ? (
        <Card style={{ backgroundColor: '#EFF9F4', borderColor: '#BBDDCB' }}>
          <Heading>Meet your listening friends</Heading>
          <View style={[styles.row, { justifyContent: 'center' }]}>
            {CHORD_CURRICULUM.map(chord => (
              <AnimalCard key={chord.id} id={chord.id} size={76} />
            ))}
          </View>
          <Body>
            Each friend has a color and a piano sound. Start with Red, then add the others one at a
            time.
          </Body>
          <Button
            title={`Parent preparation · ${Math.floor(f.state.prepared.length / 2)} of 3 complete`}
            onPress={() => router.push('/prepare')}
          />
        </Card>
      ) : (
        <>
          <Card style={{ backgroundColor: '#F0F8FF', borderColor: '#BFD9EC' }}>
            <Heading>
              {f.debug
                ? 'Debug practice'
                : today.paused
                  ? 'A rest day'
                  : today.remaining === 0
                    ? 'All done for today!'
                    : 'Today’s little sessions'}
            </Heading>
            <View style={styles.row}>
              {Array.from({ length: f.state.preferences.dailyGoal }, (_, i) => (
                <View
                  key={i}
                  accessibilityLabel={`Session ${i + 1}${i < today.completed ? ' complete' : ' remaining'}`}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor:
                      i < today.completed
                        ? ['#E87F87', '#E5BD51', '#75AEDB', '#87BC96', '#BAA0D4'][i]
                        : '#FFFFFF',
                    borderWidth: 2,
                    borderColor: i < today.completed ? 'transparent' : '#BFD9EC',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: i < today.completed ? '#FFFFFF' : '#426878',
                      fontSize: 23,
                      fontWeight: '700',
                    }}
                  >
                    {i < today.completed ? '✓' : i + 1}
                  </Text>
                </View>
              ))}
            </View>
            <Body>
              {today.completed} of {f.state.preferences.dailyGoal} done · {today.remaining}{' '}
              remaining{today.shortened ? ` · ${today.shortened} stopped early` : ''}
            </Body>
            <Body muted>
              {f.debug
                ? `${sessionTarget(f.state.preferences.activeChordIds)} presentations · practice waits skipped`
                : today.paused
                  ? 'Rest today. Your usual plan returns tomorrow.'
                  : today.remaining === 0
                    ? 'Enjoy the rest of your day.'
                    : waiting
                      ? `Next session from ${next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
                      : `${sessionTarget(f.state.preferences.activeChordIds)} presentations · about 2–3 minutes.`}
            </Body>
            {(f.debug || (!today.paused && today.remaining > 0)) && (
              <Button
                title={waiting ? 'Time for a break' : 'Let’s listen!'}
                disabled={waiting}
                onPress={() => router.push('/practice')}
              />
            )}
            <Button
              secondary
              title={today.paused ? 'Resume today’s plan' : 'Make today a rest day'}
              onPress={() => void pause()}
            />
          </Card>
          <Card>
            <Heading>Your current friends</Heading>
            <View style={[styles.row, { justifyContent: 'center' }]}>
              {f.state.preferences.activeChordIds.map(id => (
                <AnimalCard key={id} id={id} size={80} />
              ))}
            </View>
            <Button
              secondary
              title="Manage animals & progression"
              onPress={() => router.push('/settings')}
            />
          </Card>
          <Card style={{ backgroundColor: '#FFF4DB', borderColor: '#EED6A1' }}>
            <Heading>{today.reviewDue ? 'Time for a check-in' : 'Your two-week check-in'}</Heading>
            <Body>
              {f.state.reviewOn
                ? `Due ${f.state.reviewOn}. Your practice record is ready to share.`
                : 'The first check-in is two weeks after practice begins.'}
            </Body>
            <Button
              secondary
              title="Open practice record"
              onPress={() => router.push('/records')}
            />
          </Card>
        </>
      )}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings?section=reminders')}
          style={{ padding: 12, minHeight: 44 }}
        >
          <Text style={{ color: p.tint, fontSize: 17, fontWeight: '600' }}>
            Parent settings & reminders
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/guide')}
          style={{ padding: 12, minHeight: 44 }}
        >
          <Text style={{ color: p.tint, fontSize: 17, fontWeight: '600' }}>Parent guide</Text>
        </Pressable>
      </View>
      <Body muted>{token ? f.syncStatus : 'Saved on this device.'}</Body>
    </Page>
  );
}
