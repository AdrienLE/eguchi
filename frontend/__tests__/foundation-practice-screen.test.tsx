import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, jest, test } from '@jest/globals';
import ParentSettings from '@/components/foundation/ParentSettings';
import AnimalPlan from '@/components/foundation/AnimalPlan';
import AnimalCard from '@/components/foundation/AnimalCard';
import { CHORD_CURRICULUM } from '@/lib/foundation/curriculum';
import Practice from '@/components/foundation/Practice';
import { Button } from '@/components/foundation/ui';
import {
  deriveProgram,
  makeEvent,
  PREPARATION_IDS,
  type FoundationEvent,
} from '@/lib/foundation/program';

let mockBackground: ((state: string) => void) | null = null;
const mockPlay = jest.fn<() => Promise<number>>();
const mockStop = jest.fn<() => Promise<void>>();
const mockAppend = jest.fn<(event: FoundationEvent) => Promise<void>>();
let mockEvents: FoundationEvent[] = [];
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  Image: 'Image',
  Switch: 'Switch',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (value: unknown) => value },
  Platform: { OS: 'ios' },
  useWindowDimensions: () => ({ width: 1024, height: 1366 }),
  AppState: {
    addEventListener: (_name: string, callback: (state: string) => void) => {
      mockBackground = callback;
      return {
        remove: () => {
          mockBackground = null;
        },
      };
    },
  },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ token: null, login: () => {}, logout: async () => {} }),
}));
jest.mock('@/lib/foundation/notifications', () => ({
  requestDevicePermission: async () => true,
  disconnectDevice: async () => {},
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/lib/foundation/usePiano', () => ({
  FOUNDATION_AUDIO: Object.fromEntries(
    require('@/lib/foundation/curriculum').CHORD_CURRICULUM.map((c: { id: string }) => [
      c.id,
      { audioFile: c.id + '.mp3', sha256: 'a'.repeat(64) },
    ])
  ),
  usePiano: () => ({ play: mockPlay, stop: mockStop, ready: true, playing: false, error: null }),
}));
jest.mock('@/lib/foundation/FoundationProvider', () => ({
  useFoundation: () => ({
    ready: true,
    error: null,
    state: deriveProgram(mockEvents),
    snapshot: { events: mockEvents },
    append: mockAppend,
    sync: async () => {},
    store: { append: mockAppend },
  }),
}));
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockEvents = PREPARATION_IDS.map(lessonId => makeEvent('preparation', { lessonId }));
  mockPlay.mockReset().mockResolvedValue(Date.now());
  mockStop.mockReset().mockResolvedValue();
  mockAppend.mockReset().mockImplementation(async event => {
    mockEvents.push(event);
  });
});
const render = async (component = <Practice />) => {
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(component);
  });
  return root;
};
const button = (root: ReactTestRenderer, title: string) =>
  root.root.findAllByType(Button).find(node => node.props.title === title)!;
const press = async (root: ReactTestRenderer, title: string) => {
  await act(async () => {
    const target = button(root, title);
    expect(target).toBeDefined();
    expect(target.props.disabled).not.toBe(true);
    target.props.onPress();
  });
};
const trials = () => mockEvents.filter(event => event.kind === 'trial');

test('audio failure does not count a presentation and can be retried', async () => {
  const root = await render();
  await press(root, 'We’re ready to listen');
  mockPlay.mockRejectedValueOnce(new Error('No sound'));
  await press(root, 'Play the chord');
  expect(trials()).toHaveLength(0);
  await press(root, 'Play the chord');
  await press(root, 'Independent response');
  expect(trials()).toHaveLength(1);
  expect(trials()[0].data.firstSound).toBe(true);
  await act(async () => root.unmount());
});
test('rapid taps create one response, and a full session ends after ten presentations', async () => {
  const root = await render();
  await press(root, 'We’re ready to listen');
  for (let i = 0; i < 10; i++) {
    await press(root, 'Play the chord');
    await act(async () => {
      const respond = button(root, 'Independent response');
      respond.props.onPress();
      respond.props.onPress();
    });
    expect(trials()).toHaveLength(i + 1);
    await press(root, i === 9 ? 'Finish this session' : 'Next presentation');
  }
  await press(root, 'Save & finish');
  expect(mockEvents.filter(event => event.kind === 'sessionEnded')).toHaveLength(1);
  expect(mockEvents.find(event => event.kind === 'sessionEnded')?.data.reason).toBe('completed');
  expect(trials().map(event => event.data.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await act(async () => root.unmount());
});
test('help keeps the original unaided selection empty and records the corrective replay', async () => {
  const root = await render();
  await press(root, 'We’re ready to listen');
  await press(root, 'Play the chord');
  await press(root, 'Needed help');
  expect(trials()[0].data).toMatchObject({ response: 'helped', selectedChordId: null, replays: 1 });
  expect(mockPlay).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});
test('backgrounding ends the session without inventing a parent observation', async () => {
  const root = await render();
  await press(root, 'We’re ready to listen');
  await press(root, 'Play the chord');
  await press(root, 'No response');
  await act(async () => {
    mockBackground?.('background');
  });
  const end = mockEvents.find(event => event.kind === 'sessionEnded');
  expect(end?.data).toMatchObject({ reason: 'interrupted', observation: 'not-recorded' });
  expect(trials()).toHaveLength(1);
  await act(async () => root.unmount());
  expect(mockEvents.filter(event => event.kind === 'sessionEnded')).toHaveLength(1);
});

test('all fourteen choices remain available and the first wrong choice survives correction', async () => {
  const ids = CHORD_CURRICULUM.map(c => c.id);
  mockEvents.push(makeEvent('preferences', { stage: 14, activeChordIds: ids }));
  const root = await render();
  await press(root, 'We’re ready to listen');
  const start = mockEvents.find(e => e.kind === 'sessionStarted')!;
  expect(start.data.target).toBe(30);
  expect(start.data.activeChordIds).toEqual(ids);
  expect(start.data.presentationPlan).toHaveLength(30);
  await press(root, 'Play the chord');
  const heard = start.data.presentationPlan![0];
  const wrong = ids.find(id => id !== heard)!;
  expect(root.root.findAllByType(AnimalCard)).toHaveLength(14);
  await act(async () => {
    root.root
      .findAllByType(AnimalCard)
      .find(c => c.props.id === wrong)!
      .props.onPress();
  });
  expect(trials()[0].data).toMatchObject({
    chordId: heard,
    selectedChordId: wrong,
    response: 'incorrect',
    replays: 1,
  });
  expect(mockPlay).toHaveBeenLastCalledWith(heard);
  await act(async () => root.unmount());
});

test('a failed save retries the same response without losing or replaying the first choice', async () => {
  const root = await render();
  await press(root, 'We’re ready to listen');
  await press(root, 'Play the chord');
  mockAppend.mockRejectedValueOnce(new Error('Storage unavailable'));
  await press(root, 'Needed help');
  expect(trials()).toHaveLength(0);
  await press(root, 'Retry saving response');
  expect(trials()).toHaveLength(1);
  expect(trials()[0].data.response).toBe('helped');
  expect(mockPlay).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});

test('a parent can save all fourteen animals and turn off the introduction mix', async () => {
  const root = await render(<AnimalPlan />);
  await act(async () => {
    root.root
      .findAllByType(AnimalCard)
      .find(c => c.props.id === 'Eb-G-Bb')!
      .props.onPress();
  });
  await press(root, 'Mix familiar sounds evenly');
  await press(root, 'Save animal plan');
  const preferences = deriveProgram(mockEvents).preferences;
  expect(preferences.stage).toBe(14);
  expect(preferences.activeChordIds).toEqual(CHORD_CURRICULUM.map(c => c.id));
  expect(preferences.introductionChordId).toBeNull();
  await act(async () => root.unmount());
});

test('parent settings show one short section and save an explicit device-reminder opt-in', async () => {
  const root = await render(<ParentSettings />);
  expect(root.root.findAllByType(AnimalPlan)).toHaveLength(1);
  await press(root, 'Reminders');
  expect(root.root.findAllByType(AnimalPlan)).toHaveLength(0);
  const reminder = root.root.findAll(
    node =>
      node.type === ('Switch' as any) &&
      node.props.accessibilityLabel === 'Daily practice — device notification'
  )[0];
  await act(async () => {
    reminder.props.onValueChange(true);
  });
  expect(deriveProgram(mockEvents).preferences.dailyPush).toBe(true);
  await press(root, 'Routine');
  expect(root.root.findAll(node => node.type === ('Switch' as any))).toHaveLength(0);
  expect(button(root, 'Save routine')).toBeDefined();
  await act(async () => root.unmount());
});
