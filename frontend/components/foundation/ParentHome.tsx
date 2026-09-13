import React, { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { useFoundation } from '@/lib/foundation/FoundationProvider';
import { isPrepared, makeEvent, nextSessionAt, todaySummary } from '@/lib/foundation/program';
import { CHORD_CURRICULUM, CURRICULUM_BY_ID } from '@/lib/foundation/curriculum';
import AnimalCard from './AnimalCard';
import { Button, Body, Card, Heading, Notice, Page, PictureButton, styles, usePalette } from './ui';
export default function ParentHome() {
  const f = useFoundation();
  const router = useRouter();
  const p = usePalette();
  const { width } = useWindowDimensions();
  const { token } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pitchReference, setPitchReference] = useState<'yes' | 'no' | 'unknown'>('unknown');
  const { ready, store } = f;
  const current = useRef(f);
  current.current = f;
  useFocusEffect(
    useCallback(() => {
      setPitchReference('unknown');
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
      subtitle={prepared ? undefined : 'Learn piano sounds through colors and animals, together.'}
      back={false}
      backgroundPicker
      headerAction={
        <PictureButton
          small
          icon="settings-outline"
          label="Parent settings"
          caption="Parents"
          onPress={() => router.push('/settings')}
        />
      }
    >
      {error && <Notice>{error}</Notice>}
      {!prepared ? (
        <Card>
          <Heading>Meet your listening friends</Heading>
          <View style={[styles.row, { justifyContent: 'center' }]}>
            {CHORD_CURRICULUM.map(chord => (
              <AnimalCard key={chord.id} id={chord.id} size={76} />
            ))}
          </View>
          <Body>Each friend has a color and a piano sound. Add them one at a time.</Body>
          <Button
            title={`Parent preparation · ${Math.floor(f.state.prepared.length / 2)} of 3 complete`}
            onPress={() => router.push('/prepare')}
          />
        </Card>
      ) : (
        <>
          <Card>
            {f.state.preferences.introductionChordId && (
              <Body muted>
                New friend: {CURRICULUM_BY_ID[f.state.preferences.introductionChordId].color}
              </Body>
            )}
            <View style={[styles.row, { justifyContent: 'center' }]}>
              {f.state.preferences.activeChordIds.map(id => (
                <AnimalCard
                  key={id}
                  id={id}
                  size={
                    f.state.preferences.activeChordIds.length <= 2
                      ? Math.max(
                          44,
                          Math.min(96, Math.floor((Math.min(width, 800) - 112) / 2 - 20))
                        )
                      : f.state.preferences.activeChordIds.length <= 6
                        ? 70
                        : 44
                  }
                />
              ))}
            </View>
            {today.paused && !f.debug ? (
              <>
                <Heading>A rest day</Heading>
                <Body>Take it easy. Your usual plan returns tomorrow.</Body>
                <Button secondary title="Resume today’s plan" onPress={() => void pause()} />
              </>
            ) : today.remaining === 0 && !f.debug ? (
              <>
                <Heading>All done for today!</Heading>
                <Body>Enjoy the rest of your day.</Body>
              </>
            ) : waiting ? (
              <>
                <Heading>Time for a break</Heading>
                <Body>
                  Next session from{' '}
                  {next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
                </Body>
                <Button title="Let’s listen!" disabled onPress={() => {}} />
              </>
            ) : (
              <>
                <View style={[styles.row, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Body muted>Heard music just now?</Body>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['no', 'yes', 'unknown'] as const).map(value => (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityLabel={
                          value === 'no' ? 'No' : value === 'yes' ? 'Yes' : 'Not sure'
                        }
                        accessibilityState={{ selected: pitchReference === value }}
                        style={{
                          minWidth: 44,
                          minHeight: 44,
                          padding: 12,
                          borderRadius: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: pitchReference === value ? p.primary : p.secondary,
                        }}
                        onPress={() => setPitchReference(value)}
                      >
                        <Text style={{ color: p.text, fontSize: 16, fontWeight: '600' }}>
                          {value === 'no' ? 'No' : value === 'yes' ? 'Yes' : 'Not sure'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Button
                  title="Let’s listen!"
                  onPress={() => router.push(`/practice?start=1&reference=${pitchReference}`)}
                />
              </>
            )}
          </Card>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={[styles.row, { justifyContent: 'center' }]}>
              {Array.from({ length: f.state.preferences.dailyGoal }, (_, i) => (
                <View
                  key={i}
                  accessibilityLabel={`Session ${i + 1}${i < today.completed ? ' complete' : ' remaining'}`}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      i < today.completed
                        ? ['#E87F87', '#E5BD51', '#75AEDB', '#87BC96', '#BAA0D4'][i]
                        : '#FFFFFF',
                  }}
                >
                  <Text
                    style={{
                      color: i < today.completed ? '#FFFFFF' : '#625C75',
                      fontSize: 18,
                      fontWeight: '600',
                    }}
                  >
                    {i < today.completed ? '✓' : i + 1}
                  </Text>
                </View>
              ))}
            </View>
            <Body muted>
              {today.completed} of {f.state.preferences.dailyGoal} sessions done · {today.remaining}{' '}
              left today
            </Body>
          </View>
        </>
      )}
      {token && <Body muted>{f.syncStatus}</Body>}
    </Page>
  );
}
