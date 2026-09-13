import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { useFoundation } from '@/lib/foundation/FoundationProvider';
import { dateInZone, makeEvent } from '@/lib/foundation/program';
import { aiReviewSchedule } from '@/lib/foundation/review-status';
import { Body, Button, Card, Heading, Notice, styles } from './ui';

interface ReviewStatus {
  available: boolean;
  enabled: boolean;
  nextReviewOn: string | null;
  status: string;
  failure: string | null;
}

export default function AiReview() {
  const f = useFoundation();
  const { token } = useAuth();
  const [remote, setRemote] = useState<{ token: string; data: ReviewStatus } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = remote?.token === token ? remote?.data : null;
  const latest = f.state.aiReviews.at(-1)?.data;
  useEffect(() => {
    if (!token || f.debug) return;
    let active = true;
    void api.get<ReviewStatus>('/api/foundation/ai-review', token).then(result => {
      if (active && result.data) setRemote({ token, data: result.data });
    });
    return () => {
      active = false;
    };
  }, [token, f.debug, f.syncStatus, latest?.reviewedOn]);
  const toggle = async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await f.append(makeEvent('preferences', { aiReviewEnabled: enabled }));
      await f.sync();
    } catch {
      setError('Could not save the review preference. Please retry.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Heading>Two-week AI review</Heading>
      <Body>
        Every two weeks, the server reviews your synced practice and can introduce one new sound.
        You can pause reviews or change the animal plan yourself.
      </Body>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Body>Automatic level reviews</Body>
        <Switch
          accessibilityLabel="Automatic level reviews"
          value={f.state.preferences.aiReviewEnabled}
          disabled={busy || f.debug}
          onValueChange={value => void toggle(value)}
        />
      </View>
      {f.debug ? (
        <Body muted>AI reviews are off in this debug sandbox.</Body>
      ) : !token ? (
        <Body muted>
          Sign in and sync to receive server reviews. Guest practice stays on this device.
        </Body>
      ) : status?.available === false ? (
        <Notice>
          Server reviews are not configured yet. Your current animal plan stays in place.
        </Notice>
      ) : !f.state.preferences.aiReviewEnabled ? (
        <Body muted>AI reviews are paused. Your manual animal plan stays in place.</Body>
      ) : (
        <Body>
          {status?.status === 'running'
            ? 'AI review in progress.'
            : aiReviewSchedule(
                status?.nextReviewOn ?? latest?.nextReviewOn,
                dateInZone(f.now, f.state.preferences.timeZone)
              )}
        </Body>
      )}
      {status?.status === 'failed' && (
        <Notice>
          The review could not finish. Your plan stayed in place. The server limits retries; contact
          support if this persists.
        </Notice>
      )}
      {latest && (
        <>
          <Heading>
            {latest.decision === 'advance'
              ? 'Ready for the next sound'
              : latest.decision === 'hold'
                ? 'Keep the current sounds'
                : 'A parent or teacher check is needed'}
          </Heading>
          <Body>
            {latest.reviewedOn} ·{' '}
            {latest.applied
              ? `Level ${latest.stageBefore} → ${latest.stageAfter}`
              : `Kept level ${latest.stageBefore}`}
          </Body>
          <Body>{latest.reason}</Body>
          <Body>{latest.nextStep}</Body>
          {latest.uncertainties.length > 0 && (
            <Body muted>Still uncertain: {latest.uncertainties.join(' ')}</Body>
          )}
          <Body muted>Book references: {latest.sourceReferences.join('; ')}.</Body>
          <Body muted>
            {latest.model} · {latest.reasoningEffort} reasoning. This is an app adaptation, not a
            diagnosis of absolute pitch.
          </Body>
        </>
      )}
      <Body muted>
        Reviews send a practice summary and short parent-note excerpts to OpenAI. Email the result
        by verifying a parent address in Account & email and enabling review emails in Reminders.
      </Body>
      {!!token && !f.debug && (
        <Button secondary title="Sync review status" busy={busy} onPress={() => void f.sync()} />
      )}
      {error && <Notice>{error}</Notice>}
    </Card>
  );
}
