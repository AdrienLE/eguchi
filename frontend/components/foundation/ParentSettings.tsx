import AnimalPlan from './AnimalPlan';
import BackgroundPicker from './BackgroundPicker';
import PracticeControls from './PracticeControls';
import AiReview from './AiReview';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { getEguchiAccountKey, getEguchiAccountStorage } from '@/lib/eguchi/account-storage';
import { useFoundation } from '@/lib/foundation/FoundationProvider';
import { getFoundationStore } from '@/lib/foundation/store';
import { disconnectDevice, requestDevicePermission } from '@/lib/foundation/notifications';
import {
  makeEvent,
  todaySummary,
  validateRoutine,
  type Preferences,
} from '@/lib/foundation/program';
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
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState(
    ['animals', 'routine', 'controls', 'appearance', 'reminders', 'account'].includes(
      params.section ?? ''
    )
      ? params.section!
      : 'overview'
  );
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
  const today = todaySummary(f.state, f.now);
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
      {section === 'overview' ? (
        <Card>
          {(
            [
              [
                'animals',
                'sparkles-outline',
                'AI reviews & animals',
                'Review status and your animal plan',
              ],
              ['routine', 'time-outline', 'Daily routine', 'Practice times and rest days'],
              [
                'controls',
                'options-outline',
                'Practice controls',
                'Feedback time, movement and parent taps',
              ],
              ['reminders', 'notifications-outline', 'Reminders', 'Email and device notifications'],
              [
                'records',
                'list-outline',
                'Practice record',
                'Sessions, AI decisions and optional notes',
              ],
              ['appearance', 'color-palette-outline', 'Background', 'Choose your playroom color'],
              ['account', 'person-outline', 'Account & email', 'Sign in, sync and parent email'],
              ['sound', 'volume-high-outline', 'Sound check', 'Preview a sound before practice'],
              ['guide', 'book-outline', 'Parent guide', 'A quick refresher whenever you need it'],
            ] as const
          ).map(([key, icon, title, detail]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={title}
              onPress={() =>
                key === 'records'
                  ? router.push('/records')
                  : key === 'guide'
                    ? router.push('/guide')
                    : key === 'sound'
                      ? router.push('/practice')
                      : setSection(key)
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 10,
                minHeight: 60,
              }}
            >
              <Ionicons name={icon} size={26} color={palette.tint} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: '600' }}>
                  {title}
                </Text>
                <Text style={{ color: palette.subtleText, fontSize: 14 }}>{detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={palette.subtleText} />
            </Pressable>
          ))}
        </Card>
      ) : (
        <Button secondary title="All parent settings" onPress={() => setSection('overview')} />
      )}
      {section === 'animals' && (
        <>
          <AiReview />
          <AnimalPlan
            key={`${f.state.preferences.stage}-${f.state.preferences.activeChordIds.join(',')}-${f.state.preferences.introductionChordId}`}
          />
        </>
      )}
      {section === 'appearance' && (
        <Card>
          <Heading>Choose your playroom</Heading>
          <BackgroundPicker expanded />
        </Card>
      )}
      {section === 'controls' && <PracticeControls />}
      {section === 'routine' && (
        <Card>
          <Heading>Your daily routine</Heading>
          <Body>Choose four or five short sessions, spread through your day.</Body>
          <Button
            secondary
            title={today.paused ? 'Resume today’s plan' : 'Make today a rest day'}
            onPress={() =>
              void run(() =>
                f.append(makeEvent('pause', { date: today.date, paused: !today.paused }))
              )
            }
          />
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
      )}
      {f.debug && (section === 'account' || section === 'reminders') && (
        <Notice>
          Account sync and reminders are off in this debug sandbox. Exit debug mode to configure
          them.
        </Notice>
      )}
      {!f.debug && section === 'account' && (
        <>
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
                      There is also local guest practice on this device. Import it only if it
                      belongs to this child. The original local copy will be kept.
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
                    The server’s email reminder service is not available right now. Your practice
                    record is still saved.
                  </Notice>
                )}
              </>
            )}
          </Card>
        </>
      )}
      {!f.debug && section === 'reminders' && (
        <Card>
          <Heading>Reminders</Heading>
          <Body>Daily reminders stop on rest days and when today’s sessions are complete.</Body>
          {toggleRow(
            'Daily practice — email',
            'dailyEmail',
            (!contact?.verified && !f.state.preferences.dailyEmail) || !auth.token
          )}
          {toggleRow(
            'AI decisions & two-week check-ins — email',
            'reviewEmail',
            (!contact?.verified && !f.state.preferences.reviewEmail) || !auth.token
          )}
          {toggleRow('Daily practice — device notification', 'dailyPush', Platform.OS === 'web')}
          {toggleRow(
            'Two-week check-in — device notification',
            'reviewPush',
            Platform.OS === 'web'
          )}
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
            Check-in reminders open your record; they do not change the animal plan.
          </Body>
          <Button secondary title="Set up parent email" onPress={() => setSection('account')} />
        </Card>
      )}
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
