import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFoundation } from '@/lib/foundation/FoundationProvider';
import { defaultPreferences, makeEvent, type LessonId } from '@/lib/foundation/program';
import { usePiano } from '@/lib/foundation/usePiano';
import PracticeDiagram from './PracticeDiagram';
import { Body, Button, Card, Heading, Notice, Page, styles, usePalette } from './ui';
const STEPS: { ids: LessonId[]; title: string; acknowledgement: string }[] = [
  {
    ids: ['purpose', 'routine'],
    title: 'Little and often',
    acknowledgement: 'Got it — short sessions, spread out',
  },
  {
    ids: ['sound', 'respond'],
    title: 'Try it before your child joins',
    acknowledgement: 'The sound is clear. I’m ready to help.',
  },
  {
    ids: ['care', 'review'],
    title: 'Keep it easy',
    acknowledgement: 'Ready for our first session',
  },
];
function PreparationSteps() {
  const f = useFoundation();
  const router = useRouter();
  const piano = usePiano();
  const p = usePalette();
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      STEPS.findIndex(step => step.ids.some(id => !f.state.prepared.includes(id)))
    )
  );
  const [checkedSound, setCheckedSound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [years, setYears] = useState('');
  const [months, setMonths] = useState('');
  const [prior, setPrior] = useState<'none' | 'some' | 'unknown'>('unknown');
  const step = STEPS[index];
  const next = async () => {
    setBusy(true);
    setError(null);
    try {
      const events = step.ids.map(lessonId => makeEvent('preparation', { lessonId }));
      if (!f.snapshot.events.some(e => e.kind === 'preferences'))
        await f.append(makeEvent('preferences', defaultPreferences()));
      if (index === 2) {
        const age =
          years.trim() || months.trim() ? Number(years || 0) * 12 + Number(months || 0) : null;
        if (
          age !== null &&
          (!Number.isInteger(age) || age < 0 || age > 216 || Number(months || 0) > 11)
        )
          throw new Error('Use whole years and 0–11 months, or leave both blank.');
        await f.append(makeEvent('background', { ageMonths: age, priorTraining: prior, note: '' }));
      }
      await f.store.appendMany(events);
      if (index < 2) setIndex(value => value + 1);
      else router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="Before you begin" subtitle={`Step ${index + 1} of 3`}>
      <Card>
        <Heading>{step.title}</Heading>
        {index === 0 && (
          <>
            <Body>
              Your child learns piano sounds through colors and animals. Begin with Red, then add
              new friends one at a time.
            </Body>
            <PracticeDiagram />
            <View style={styles.row}>
              {['4–5 times a day', '10 at first, then 30', 'About 2–3 minutes'].map(text => (
                <Notice key={text}>{text}</Notice>
              ))}
            </View>
            <Body muted>
              Leave at least 15 minutes between sessions. No more than two in an hour.
            </Body>
          </>
        )}
        {index === 1 && (
          <>
            <Body>Find a quiet spot and a comfortable volume.</Body>
            <Button
              secondary
              title={piano.playing ? 'Playing Red…' : 'Play Red · parent sound check'}
              disabled={!piano.ready || piano.playing}
              onPress={() => {
                void piano
                  .play()
                  .then(() => setCheckedSound(true))
                  .catch(() => {});
              }}
            />
            <PracticeDiagram />
            <Body>
              Show a new friend, play its chord, and say its color. If your child hesitates, gently
              give the answer, tap its animal, and mark “I helped” on the feedback screen.
            </Body>
            {checkedSound && <Body muted>Sound check played ✓</Body>}
            {piano.error && <Notice>{piano.error}</Notice>}
          </>
        )}
        {index === 2 && (
          <>
            <Body>
              Stop if your child is tired or upset. Missed sessions never become extra work
              tomorrow.
            </Body>
            <Body>
              Sign in to get an automatic AI review every two weeks. It can add a new friend when
              your child is ready. You can always change the plan in Parent settings.
            </Body>
            <Body muted>
              Listening comes first. Keep it playful, without pressure to get every answer right.
            </Body>
          </>
        )}
      </Card>
      {index === 2 && (
        <Card>
          <Button
            secondary
            title={
              showContext ? 'Hide optional child context' : 'Add child age & experience (optional)'
            }
            onPress={() => setShowContext(value => !value)}
          />
          {showContext && (
            <>
              <Body>Helpful for the future review. No name or birth date needed.</Body>
              <View style={styles.row}>
                <TextInput
                  accessibilityLabel="Age in years"
                  placeholder="Years"
                  placeholderTextColor={p.subtleText}
                  keyboardType="number-pad"
                  value={years}
                  onChangeText={setYears}
                  maxLength={2}
                  style={[styles.input, { color: p.text, width: 120 }]}
                />
                <TextInput
                  accessibilityLabel="Additional months"
                  placeholder="Months"
                  placeholderTextColor={p.subtleText}
                  keyboardType="number-pad"
                  value={months}
                  onChangeText={setMonths}
                  maxLength={2}
                  style={[styles.input, { color: p.text, width: 120 }]}
                />
              </View>
              <Body>Previous pitch training?</Body>
              {(['none', 'some', 'unknown'] as const).map(option => (
                <Button
                  key={option}
                  secondary={prior !== option}
                  title={
                    option === 'none'
                      ? 'None'
                      : option === 'some'
                        ? 'Some previous training'
                        : 'Not sure / skip'
                  }
                  onPress={() => setPrior(option)}
                />
              ))}
            </>
          )}
        </Card>
      )}
      {error && <Notice>{error}</Notice>}
      <Button
        title={step.acknowledgement}
        disabled={!f.ready || (index === 1 && !checkedSound)}
        busy={busy}
        onPress={() => void next()}
      />
      {index > 0 && (
        <Button secondary title="Previous step" onPress={() => setIndex(value => value - 1)} />
      )}
      <Button
        secondary
        title="More detail in the parent guide"
        onPress={() => router.push('/guide')}
      />
    </Page>
  );
}

export default function Preparation() {
  const { ready, error } = useFoundation();
  return ready ? (
    <PreparationSteps />
  ) : (
    <Page title="Before you begin">
      <Body>{error ?? 'Opening your preparation…'}</Body>
    </Page>
  );
}
