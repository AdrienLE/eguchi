import AnimalPlan from './AnimalPlan';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { getEguchiAccountKey, getEguchiAccountStorage } from '@/lib/eguchi/account-storage';
import { useFoundation } from '@/lib/foundation/FoundationProvider';
import { getFoundationStore } from '@/lib/foundation/store';
import { disconnectDevice, requestDevicePermission } from '@/lib/foundation/notifications';
import { makeEvent, validateRoutine, type Preferences } from '@/lib/foundation/program';
import { Body, Button, Card, Heading, Notice, Page, styles, usePalette } from './ui';
interface Contact {
  email: string;
  verified: boolean;
  emailAvailable: boolean;
}
function ParentSettingsReady() {
  const auth = useAuth();
  const f = useFoundation();
  const router = useRouter();
  const palette = usePalette();
  const [goal, setGoal] = useState<4 | 5>(f.state.preferences.dailyGoal);
  const [times, setTimes] = useState(f.state.preferences.practiceTimes);
  const [emailTime, setEmailTime] = useState(f.state.preferences.dailyEmailTime);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [contact, setContact] = useState<Contact | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  useEffect(() => {
    let active = true;
    if (auth.token) {
      void api.get<Contact>('/api/foundation/contact', auth.token).then(result => {
        if (active && result.data) {
          setContact(result.data);
          setEmail(result.data.email);
        }
      });
      const guest = getFoundationStore(getEguchiAccountStorage(null));
      void guest.load().then(() => {
        if (active) setGuestCount(guest.getSnapshot().events.length);
      });
    } else {
      setContact(null);
      setEmail('');
    }
    return () => {
      active = false;
    };
  }, [auth.token]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'The change could not be saved. Please retry.');
    } finally {
      setBusy(false);
    }
  };
  const refreshContact = async () => {
    if (!auth.token) return;
    const response = await api.get<Contact>('/api/foundation/contact', auth.token);
    if (response.data) {
      setContact(response.data);
      setEmail(response.data.email);
    }
  };
  const patch = async (data: Partial<Preferences>) => {
    await f.append(makeEvent('preferences', data));
    await f.sync();
  };
  const saveRoutine = () =>
    run(async () => {
      const error = validateRoutine(goal, times);
      if (error) throw new Error(error);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(emailTime))
        throw new Error('Use a daily email time such as 17:00.');
      await patch({ dailyGoal: goal, practiceTimes: [...times].sort(), dailyEmailTime: emailTime });
      setMessage('Your routine is saved.');
    });
  const toggle = (key: 'dailyEmail' | 'reviewEmail' | 'dailyPush' | 'reviewPush', value: boolean) =>
    run(async () => {
      if (value && key.endsWith('Push') && !(await requestDevicePermission()))
        throw new Error(
          Platform.OS === 'web'
            ? 'Device reminders are available in the iOS and Android app.'
            : 'Notifications are not allowed. Enable them in your device settings.'
        );
      if (value && key.endsWith('Email') && !contact?.verified)
        throw new Error('Verify the parent email address first.');
      await patch({ [key]: value });
    });
  const emailCode = () =>
    run(async () => {
      if (!auth.token) throw new Error('Sign in to set up parent email.');
      if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email.trim()))
        throw new Error('Enter a valid parent email address.');
      const response = await api.post(
        '/api/foundation/contact/request-code',
        { email: email.trim() },
        auth.token
      );
      if (response.error)
        throw new Error(
          response.status === 429
            ? 'Wait one minute before requesting another code.'
            : 'The code could not be sent. Check your inbox or try again shortly.'
        );
      setCodeSent(true);
      await refreshContact();
      setMessage('A six-digit code was sent to the parent email. It expires in ten minutes.');
    });
  const verify = () =>
    run(async () => {
      const response = await api.post(
        '/api/foundation/contact/verify',
        { code: code.trim() },
        auth.token ?? undefined
      );
      if (response.error)
        throw new Error('That code is incorrect or expired. You can request a new one.');
      await refreshContact();
      setCodeSent(false);
      setCode('');
      setMessage('Parent email verified. Choose which reminders you want below.');
    });
  const changeGoal = (value: 4 | 5) => {
    setGoal(value);
    setTimes(
      value === 5
        ? ['07:30', '08:15', '13:00', '16:00', '18:00']
        : ['07:30', '08:15', '16:00', '18:00']
    );
  };
  const toggleRow = (
    label: string,
    key: 'dailyEmail' | 'reviewEmail' | 'dailyPush' | 'reviewPush',
    disabled = false
  ) => (
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <View style={{ flex: 1 }}>
        <Body>{label}</Body>
      </View>
      <Switch
        accessibilityLabel={label}
        value={f.state.preferences[key]}
        onValueChange={value => void toggle(key, value)}
        disabled={busy || disabled}
        trackColor={{ true: '#438E79' }}
      />
    </View>
  );
  return (
    <Page title="Parent settings" subtitle="A routine that fits your family.">
      {message && <Notice>{message}</Notice>}
      <AnimalPlan />
      <Card>
        <Heading>Your daily routine</Heading>
        <Body>
          Choose four or five short sessions. Reminder times are suggestions; the daily plan also
          checks the time since your last session.
        </Body>
        <View style={styles.row}>
          <Button title="4 sessions" secondary={goal !== 4} onPress={() => changeGoal(4)} />
          <Button title="5 sessions" secondary={goal !== 5} onPress={() => changeGoal(5)} />
        </View>
        <Body>Practice times (24-hour clock)</Body>
        <View style={styles.row}>
          {times.map((time, index) => (
            <TextInput
              key={index}
              accessibilityLabel={`Practice time ${index + 1}`}
              value={time}
              maxLength={5}
              onChangeText={value =>
                setTimes(current => current.map((t, i) => (i === index ? value : t)))
              }
              style={[styles.input, { width: 100, color: palette.text }]}
            />
          ))}
        </View>
        <Body muted>Time zone: {f.state.preferences.timeZone.replaceAll('_', ' ')}</Body>
        <Button
          secondary
          title="Use this device’s current time zone"
          onPress={() =>
            void run(async () => {
              await patch({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
              setMessage('Time zone updated.');
            })
          }
        />
        <Body>Daily email time (one email per day)</Body>
        <TextInput
          accessibilityLabel="Daily email time"
          value={emailTime}
          onChangeText={setEmailTime}
          maxLength={5}
          style={[styles.input, { width: 100, color: palette.text }]}
        />
        <Button title="Save routine" busy={busy} onPress={() => void saveRoutine()} />
      </Card>
      <Card>
        <Heading>Account & practice backup</Heading>
        <Body>
          {auth.token
            ? f.syncStatus
            : 'You can practice without an account. Your record stays on this device. Sign in for account backup and parent email reminders.'}
        </Body>
        {auth.token ? (
          <>
            <Button secondary title="Sync now" busy={busy} onPress={() => void run(f.sync)} />
            {guestCount > 0 && (
              <>
                <Body>
                  There is also local guest practice on this device. Import it only if it belongs to
                  this child. The original local copy will be kept.
                </Body>
                <Button
                  secondary
                  title="Import this device’s guest practice"
                  busy={busy}
                  onPress={() =>
                    void run(async () => {
                      const guest = getFoundationStore(getEguchiAccountStorage(null));
                      await guest.load();
                      await f.store.appendMany(guest.getSnapshot().events);
                      await f.sync();
                      setGuestCount(0);
                      setMessage('Local practice was copied into this account.');
                    })
                  }
                />
              </>
            )}
            <Button
              secondary
              title="Sign out"
              busy={busy}
              onPress={() =>
                void run(async () => {
                  await disconnectDevice(auth.token, getEguchiAccountKey(auth.token));
                  await auth.logout();
                })
              }
            />
          </>
        ) : (
          <>
            <Body muted>
              Local practice and account practice are kept separate. After signing in, you can
              import this device’s local record here.
            </Body>
            <Button title="Sign in for backup & parent email" onPress={auth.login} />
          </>
        )}
      </Card>
      <Card>
        <Heading>Parent email</Heading>
        <Body>
          This can be different from the email used to sign in. Only a verified address receives
          reminders.
        </Body>
        {!auth.token ? (
          <Body muted>Sign in above to add a parent email.</Body>
        ) : (
          <>
            <TextInput
              accessibilityLabel="Parent email address"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              placeholder="parent@example.com"
              placeholderTextColor={palette.subtleText}
              style={[styles.input, { color: palette.text }]}
            />
            {contact?.verified && contact.email === email ? (
              <Notice>Parent email verified.</Notice>
            ) : (
              <Button
                title={codeSent ? 'Send another verification code' : 'Send verification code'}
                busy={busy}
                onPress={() => void emailCode()}
              />
            )}
            {codeSent && (
              <>
                <TextInput
                  accessibilityLabel="Six-digit email verification code"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  value={code}
                  onChangeText={setCode}
                  maxLength={6}
                  placeholder="6-digit code"
                  placeholderTextColor={palette.subtleText}
                  style={[styles.input, { color: palette.text }]}
                />
                <Button
                  title="Verify parent email"
                  disabled={code.length !== 6}
                  busy={busy}
                  onPress={() => void verify()}
                />
              </>
            )}
            {!!contact?.email && (
              <Button
                secondary
                title="Remove parent email"
                busy={busy}
                onPress={() =>
                  void run(async () => {
                    const result = await api.delete('/api/foundation/contact', auth.token!);
                    if (result.error)
                      throw new Error('Connect to the internet to remove the parent email.');
                    await refreshContact();
                    setCodeSent(false);
                    await patch({ dailyEmail: false, reviewEmail: false });
                    setMessage('Parent email removed.');
                  })
                }
              />
            )}
            {contact && !contact.emailAvailable && (
              <Notice>
                The server’s email reminder service is not available right now. Your practice record
                is still saved.
              </Notice>
            )}
          </>
        )}
      </Card>
      <Card>
        <Heading>Reminders</Heading>
        <Body>
          Choose each category and channel. Daily reminders stop on rest days and once the day’s
          full sessions are recorded.
        </Body>
        {toggleRow(
          'Daily practice — email',
          'dailyEmail',
          (!contact?.verified && !f.state.preferences.dailyEmail) || !auth.token
        )}
        {toggleRow(
          'Two-week check-in — email',
          'reviewEmail',
          (!contact?.verified && !f.state.preferences.reviewEmail) || !auth.token
        )}
        {toggleRow('Daily practice — device notification', 'dailyPush', Platform.OS === 'web')}
        {toggleRow('Two-week check-in — device notification', 'reviewPush', Platform.OS === 'web')}
        <Body muted>
          {Platform.OS === 'web'
            ? 'Device notifications are available in the native iOS and Android app.'
            : f.notificationMode === 'remote'
              ? 'Device reminders are linked to your account.'
              : f.notificationMode === 'local'
                ? 'Reminders are scheduled on this device. Open the app at least once a week to refresh daily reminders.'
                : f.notificationMode === 'denied'
                  ? 'Device permission is off. Turn on a device reminder to request permission.'
                  : 'Device reminders are off.'}
        </Body>
        {Platform.OS !== 'web' && (
          <Button
            secondary
            title="Open device notification settings"
            onPress={() => void Linking.openSettings()}
          />
        )}
        <Body muted>
          The two-week notification is a reminder to review the record. It does not perform an
          assessment or unlock another chord. Email and account reminders use the latest synced
          record.
        </Body>
      </Card>
      <Button secondary title="Read the parent guide" onPress={() => router.push('/guide')} />
      <Button secondary title="Practice record & export" onPress={() => router.push('/records')} />
    </Page>
  );
}

export default function ParentSettings() {
  const { ready, error } = useFoundation();
  return ready ? (
    <ParentSettingsReady />
  ) : (
    <Page title="Parent settings">
      <Body>{error ?? 'Opening your settings…'}</Body>
    </Page>
  );
}
