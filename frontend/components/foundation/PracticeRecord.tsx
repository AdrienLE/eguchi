import React, { useState } from 'react';
import { TextInput } from 'react-native';
import { useFoundation } from '@/lib/foundation/FoundationProvider';
import {
  dateInZone,
  makeEvent,
  todaySummary,
  reviewRecord,
  recordedResponse,
  type ResponseKind,
} from '@/lib/foundation/program';
import { CURRICULUM_BY_ID } from '@/lib/foundation/curriculum';
import { exportPracticeRecord } from '@/lib/foundation/export';
import { Body, Button, Card, Heading, Notice, Page, styles } from './ui';
export default function PracticeRecord() {
  const f = useFoundation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const saveCheckIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await f.append(
        makeEvent('checkIn', {
          date: dateInZone(new Date(), f.state.preferences.timeZone),
          timeZone: f.state.preferences.timeZone,
          note: note.trim(),
        })
      );
      setNote('');
    } catch {
      setError('Could not save the check-in. Please retry.');
    } finally {
      setBusy(false);
    }
  };
  const trials = f.state.sessions.flatMap(s => s.trials);
  const count = (kind: ResponseKind) => trials.filter(t => recordedResponse(t) === kind).length;
  const share = async () => {
    setBusy(true);
    try {
      await exportPracticeRecord(reviewRecord(f.snapshot.events));
    } catch {
      setError('Could not share the record. Please retry.');
    } finally {
      setBusy(false);
    }
  };
  const confusions = new Map<string, number>();
  for (const trial of trials)
    if (recordedResponse(trial) === 'incorrect' && trial.data.selectedChordId) {
      const pair = `${CURRICULUM_BY_ID[trial.data.chordId].color} heard → ${CURRICULUM_BY_ID[trial.data.selectedChordId].color} chosen`;
      confusions.set(pair, (confusions.get(pair) ?? 0) + 1);
    }
  return (
    <Page title="Practice record" subtitle="Your notes for the next check-in.">
      <Card>
        <Heading>
          {f.state.reviewOn
            ? `Check-in: ${f.state.reviewOn}`
            : 'Check in after the first two weeks'}
        </Heading>
        <Body>You choose when to change the animal plan. Automatic assessment is not active.</Body>
        {todaySummary(f.state).reviewDue && (
          <>
            <TextInput
              accessibilityLabel="Check-in notes"
              placeholder="What is going well? Any sounds getting mixed up?"
              placeholderTextColor="#69776F"
              multiline
              maxLength={2000}
              value={note}
              onChangeText={setNote}
              style={[styles.input, { minHeight: 80, color: '#25382F' }]}
            />
            <Button title="Save parent check-in" busy={busy} onPress={() => void saveCheckIn()} />
            <Body muted>
              Your next check-in will be in two weeks. Your animal plan stays as you set it.
            </Body>
          </>
        )}
        {f.state.checkIns.length > 0 && (
          <Body muted>
            Last parent check-in: {f.state.checkIns.at(-1)!.data.date}
            {f.state.checkIns.at(-1)!.data.note ? ` · ${f.state.checkIns.at(-1)!.data.note}` : ''}
          </Body>
        )}
      </Card>
      <Card>
        <Heading>Listening so far</Heading>
        <Body>
          {f.state.sessions.length} sessions · {trials.length} presentations
        </Body>
        <Body>
          {count('independent')} identified · {count('incorrect')} another choice ·{' '}
          {count('helped')} helped · {count('no-response')} no response
        </Body>
        <Body muted>
          One-choice trials show participation only. The record keeps the number of choices, first
          sounds, and help separately.
        </Body>
        <Button
          title="Share practice record"
          disabled={!f.ready}
          busy={busy}
          onPress={() => void share()}
        />
        {error && <Notice>{error}</Notice>}
      </Card>
      {confusions.size > 0 && (
        <Card>
          <Heading>Sounds to look at together</Heading>
          {[...confusions.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([pair, total]) => (
              <Body key={pair}>
                {pair} · {total}
              </Body>
            ))}
        </Card>
      )}
      {[...f.state.sessions].reverse().map(session => (
        <Card key={session.start.id}>
          <Heading>
            {session.start.data.date} ·{' '}
            {new Date(session.start.at).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: session.start.data.timeZone,
            })}
          </Heading>
          <Body>
            {session.trials.length} of {session.start.data.target} presentations ·{' '}
            {session.end?.data.reason ?? 'not finished'}
          </Body>
          <Body>
            Observation: {session.end?.data.observation.replaceAll('-', ' ') ?? 'not recorded'}
          </Body>
          {!!session.end?.data.note && <Body>{session.end.data.note}</Body>}
          <Body muted>
            Help: {session.trials.filter(t => recordedResponse(t) === 'helped').length} · Replays:{' '}
            {session.trials.reduce((sum, t) => sum + t.data.replays, 0)}
          </Body>
        </Card>
      ))}
    </Page>
  );
}
