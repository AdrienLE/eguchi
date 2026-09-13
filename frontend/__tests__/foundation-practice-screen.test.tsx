import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import ParentSettings from '@/components/foundation/ParentSettings';
import AnimalPlan from '@/components/foundation/AnimalPlan';
import AnimalCard from '@/components/foundation/AnimalCard';
import DebugTools from '@/components/foundation/DebugTools';
import { CHORD_CURRICULUM } from '@/lib/foundation/curriculum';
import Practice, { FEEDBACK_MS } from '@/components/foundation/Practice';
import { Button, PictureButton } from '@/components/foundation/ui';
import {
  deriveProgram,
  makeEvent,
  PREPARATION_IDS,
  recordedResponse,
  type FoundationEvent,
} from '@/lib/foundation/program';

let mockBackground: ((state: string) => void) | null = null;
const mockPlay = jest.fn<() => Promise<number>>();
const mockStop = jest.fn<() => Promise<void>>();
const mockAppend = jest.fn<(event: FoundationEvent) => Promise<void>>();
let mockEvents: FoundationEvent[] = [];
let mockPlaying = false;
let mockDebug = false;
let mockReduceMotion = false;
const mockAnimate = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  Image: 'Image',
  AccessibilityInfo: {
    isReduceMotionEnabled: async () => mockReduceMotion,
    addEventListener: () => ({ remove: () => {} }),
  },
  Animated: {
    View: 'AnimatedView',
    Value: class {
      setValue() {}
      interpolate() {
        return 0;
      }
    },
    timing: () => ({}),
    sequence: () => ({ start: mockAnimate, stop: () => {} }),
  },
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
  usePiano: () => ({
    play: mockPlay,
    stop: mockStop,
    ready: true,
    playing: mockPlaying,
    error: null,
  }),
}));
jest.mock('@/lib/foundation/FoundationProvider', () => ({
  useFoundation: () => ({
    ready: true,
    debug: mockDebug,
    error: null,
    state: deriveProgram(mockEvents),
    snapshot: { events: mockEvents },
    append: mockAppend,
    sync: async () => {},
    store: { append: mockAppend },
  }),
}));
beforeEach(() => {
  jest.useFakeTimers();
  mockPlaying = false;
  mockDebug = false;
  mockReduceMotion = false;
  mockAnimate.mockClear();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockEvents = PREPARATION_IDS.map(lessonId => makeEvent('preparation', { lessonId }));
  mockPlay.mockReset().mockResolvedValue(Date.now());
  mockStop.mockReset().mockResolvedValue();
  mockAppend.mockReset().mockImplementation(async event => {
    mockEvents.push(event);
  });
});
afterEach(() => {
  jest.useRealTimers();
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
    const target =
      button(root, title) ??
      root.root.findAllByType(PictureButton).find(n => n.props.label === title);
    expect(target).toBeDefined();
    expect(target.props.disabled).not.toBe(true);
    target.props.onPress();
  });
};
const trials = () => mockEvents.filter(event => event.kind === 'trial');
const choose = async (root: ReactTestRenderer, id = 'C-E-G') => {
  await act(async () => {
    root.root
      .findAllByType(AnimalCard)
      .find(n => n.props.id === id)!
      .props.onPress();
  });
};
const waitForFeedback = async () => {
  await act(async () => jest.advanceTimersByTime(FEEDBACK_MS));
};

test('Ready previews can be replayed and mark the upcoming first sound as primed', async () => {
  const root = await render();
  await press(root, 'Preview sound');
  await press(root, 'Preview sound');
  expect(mockPlay).toHaveBeenCalledTimes(2);
  expect(trials()).toHaveLength(0);
  await press(root, 'We’re ready to listen');
  expect(mockEvents.find(e => e.kind === 'sessionStarted')?.data.recentPitchReference).toBe('yes');
  await choose(root);
  expect(trials()[0].data.replays).toBe(0);
  await act(async () => root.unmount());
});

test('debug mode can start unprepared and during a rest day or session break', async () => {
  mockDebug = true;
  mockEvents = [
    makeEvent('pause', {
      date: new Date().toLocaleDateString('en-CA'),
      paused: true,
    }),
  ];
  const first = await render();
  await press(first, 'We’re ready to listen');
  await choose(first);
  await act(async () => first.unmount());
  const second = await render();
  await press(second, 'We’re ready to listen');
  expect(mockEvents.filter(e => e.kind === 'sessionStarted')).toHaveLength(2);
  await act(async () => second.unmount());
});

test('normal practice still enforces the break between sessions', async () => {
  const first = await render();
  await press(first, 'We’re ready to listen');
  await choose(first);
  await act(async () => first.unmount());
  const second = await render();
  await press(second, 'We’re ready to listen');
  expect(mockEvents.filter(e => e.kind === 'sessionStarted')).toHaveLength(1);
  await act(async () => second.unmount());
});

test('debug controls stay hidden normally and advance the entire animal plan immediately', async () => {
  const hidden = await render(<DebugTools />);
  expect(hidden.toJSON()).toBeNull();
  await act(async () => hidden.unmount());
  mockDebug = true;
  const root = await render(<DebugTools />);
  const expand = async () => {
    // Real user actions have distinct event times; fake timers otherwise freeze both saves.
    await act(async () => jest.advanceTimersByTime(1));
    await act(async () =>
      root.root
        .findAll(
          n => n.type === ('Pressable' as any) && n.props.accessibilityLabel === 'Debug tools'
        )[0]
        .props.onPress()
    );
  };
  await expand();
  await press(root, 'Next level · Yellow');
  expect(deriveProgram(mockEvents).preferences).toMatchObject({
    stage: 2,
    activeChordIds: ['C-E-G', 'C-F-A'],
  });
  await expand();
  await press(root, 'Unlock all animals');
  expect(deriveProgram(mockEvents).preferences.activeChordIds).toHaveLength(14);
  await expand();
  expect(button(root, 'All levels unlocked').props.disabled).toBe(true);
  await act(async () => root.unmount());
});

test('account and notification actions are absent in the debug sandbox', async () => {
  mockDebug = true;
  const root = await render(<ParentSettings />);
  await press(root, 'Reminders');
  expect(root.root.findAll(n => n.type === ('Switch' as any))).toHaveLength(0);
  await press(root, 'Account & email');
  expect(root.root.findAll(n => n.type === ('TextInput' as any))).toHaveLength(0);
  await act(async () => root.unmount());
});

test('audio failure does not count a presentation and can be retried', async () => {
  const root = await render();
  mockPlay.mockRejectedValueOnce(new Error('No sound'));
  await press(root, 'We’re ready to listen');
  expect(trials()).toHaveLength(0);
  await press(root, 'Play sound');
  await choose(root);
  expect(trials()).toHaveLength(1);
  expect(trials()[0].data.firstSound).toBe(true);
  await act(async () => root.unmount());
});
test('rapid taps create one response, and a full session ends after ten presentations', async () => {
  const root = await render();
  await press(root, 'We’re ready to listen');
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      const respond = root.root.findAllByType(AnimalCard)[0];
      respond.props.onPress();
      respond.props.onPress();
    });
    expect(trials()).toHaveLength(i + 1);
    await waitForFeedback();
  }
  expect(mockPlay).toHaveBeenCalledTimes(10);
  await press(root, 'Save & finish');
  expect(mockEvents.filter(event => event.kind === 'sessionEnded')).toHaveLength(1);
  expect(mockEvents.find(event => event.kind === 'sessionEnded')?.data.reason).toBe('completed');
  expect(trials().map(event => event.data.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await act(async () => root.unmount());
});
test('parent help on feedback annotates the tap, can be undone, and restarts the feedback pause', async () => {
  const root = await render();
  await press(root, 'We’re ready to listen');
  await choose(root);
  await act(async () => jest.advanceTimersByTime(FEEDBACK_MS - 100));
  await press(root, 'I helped');
  expect(recordedResponse(deriveProgram(mockEvents).sessions[0].trials[0])).toBe('helped');
  expect(trials()[0].data.selectedChordId).toBe('C-E-G');
  await act(async () => jest.advanceTimersByTime(200));
  expect(mockPlay).toHaveBeenCalledTimes(1);
  await press(root, 'Undo parent help');
  expect(recordedResponse(deriveProgram(mockEvents).sessions[0].trials[0])).toBe('independent');
  await waitForFeedback();
  expect(mockPlay).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});
test('backgrounding ends the session without inventing a parent observation', async () => {
  const root = await render();
  await press(root, 'We’re ready to listen');
  await press(root, 'No response');
  await act(async () => {
    mockBackground?.('background');
  });
  const end = mockEvents.find(event => event.kind === 'sessionEnded');
  expect(end?.data).toMatchObject({ reason: 'interrupted', observation: 'not-recorded' });
  expect(trials()).toHaveLength(1);
  await waitForFeedback();
  expect(mockPlay).toHaveBeenCalledTimes(2);
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
  mockAppend.mockRejectedValueOnce(new Error('Storage unavailable'));
  await choose(root);
  expect(trials()).toHaveLength(0);
  await waitForFeedback();
  expect(mockPlay).toHaveBeenCalledTimes(1);
  await press(root, 'Retry saving response');
  expect(trials()).toHaveLength(1);
  expect(trials()[0].data.response).toBe('independent');
  expect(mockPlay).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});

test('automatic advance waits for full audio and honors a parent pause', async () => {
  const root = await render();
  await press(root, 'We’re ready to listen');
  mockPlaying = true;
  await act(async () => root.update(<Practice />));
  await choose(root);
  await waitForFeedback();
  expect(mockPlay).toHaveBeenCalledTimes(1);
  await press(root, 'Pause practice');
  mockPlaying = false;
  await act(async () => root.update(<Practice />));
  await waitForFeedback();
  expect(mockPlay).toHaveBeenCalledTimes(1);
  await press(root, 'Resume practice');
  await waitForFeedback();
  expect(mockPlay).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
  await waitForFeedback();
  expect(mockPlay).toHaveBeenCalledTimes(2);
});

test('waiting never invents a no-response result, and replay counts without adding a trial', async () => {
  const root = await render();
  await press(root, 'We’re ready to listen');
  expect(root.root.findAll(n => n.props.accessibilityRole === 'progressbar')).toHaveLength(0);
  await act(async () => jest.advanceTimersByTime(60_000));
  expect(trials()).toHaveLength(0);
  expect(mockPlay).toHaveBeenCalledTimes(1);
  await press(root, 'Replay sound');
  await choose(root);
  expect(trials()[0].data.replays).toBe(1);
  expect(trials()).toHaveLength(1);
  await act(async () => root.unmount());
});

test('the next-sound bar follows feedback, freezes on pause, and restarts after help', async () => {
  const root = await render();
  await press(root, 'We’re ready to listen');
  await choose(root);
  const progress = () =>
    root.root.find(n => n.props.accessibilityRole === 'progressbar').props.accessibilityValue;
  expect(progress().now).toBe(0);
  await act(async () => jest.advanceTimersByTime(FEEDBACK_MS / 2));
  expect(progress().now).toBe(50);
  await press(root, 'Pause practice');
  await waitForFeedback();
  expect(progress()).toMatchObject({ now: 50, text: 'Paused' });
  expect(mockPlay).toHaveBeenCalledTimes(1);
  await press(root, 'Resume practice');
  expect(progress().now).toBe(0);
  await act(async () => jest.advanceTimersByTime(FEEDBACK_MS / 2));
  await press(root, 'I helped');
  expect(progress().now).toBe(0);
  await waitForFeedback();
  expect(root.root.findAll(n => n.props.accessibilityRole === 'progressbar')).toHaveLength(0);
  expect(mockPlay).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});

test.each(['correct', 'incorrect', 'no-response'])(
  'the animal gives the same gentle reaction after a %s response, with no idle animation',
  async response => {
    mockEvents.push(makeEvent('preferences', { stage: 2, activeChordIds: ['C-E-G', 'C-F-A'] }));
    const root = await render();
    await press(root, 'We’re ready to listen');
    expect(mockAnimate).not.toHaveBeenCalled();
    const start = mockEvents.find(e => e.kind === 'sessionStarted')!;
    const heard = start.data.presentationPlan![0];
    if (response === 'no-response') await press(root, 'No response');
    else await choose(root, response === 'correct' ? heard : heard === 'C-E-G' ? 'C-F-A' : 'C-E-G');
    expect(mockAnimate).toHaveBeenCalledTimes(1);
    expect(
      root.root
        .findAllByType(AnimalCard)
        .filter(n => n.props.react)
        .map(n => n.props.id)
    ).toEqual([heard]);
    await act(async () => root.unmount());
  }
);

test('reduced motion keeps the color reveal and feedback bar without a hop', async () => {
  mockReduceMotion = true;
  const root = await render();
  await press(root, 'We’re ready to listen');
  await choose(root);
  expect(mockAnimate).not.toHaveBeenCalled();
  expect(root.root.findAllByType(AnimalCard)[0].props.selected).toBe(true);
  expect(root.root.findAll(n => n.props.accessibilityRole === 'progressbar')).toHaveLength(1);
  await act(async () => root.unmount());
});

test('a failed parent-help save pauses advancement and can be retried', async () => {
  const root = await render();
  await press(root, 'We’re ready to listen');
  await choose(root);
  mockAppend.mockRejectedValueOnce(new Error('Storage unavailable'));
  await press(root, 'I helped');
  await waitForFeedback();
  expect(mockPlay).toHaveBeenCalledTimes(1);
  await press(root, 'I helped');
  expect(recordedResponse(deriveProgram(mockEvents).sessions[0].trials[0])).toBe('helped');
  await waitForFeedback();
  expect(mockPlay).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});

test('a parent can save all fourteen animals and turn off the introduction mix', async () => {
  const root = await render(<AnimalPlan />);
  for (const name of [
    'Black Cat',
    'Pink Flamingo',
    'Brown Bear',
    'Peach Pig',
    'Lavender Butterfly',
  ]) {
    expect(
      root.root.findAll(
        node => node.type === ('Pressable' as any) && node.props.accessibilityLabel === name
      )
    ).toHaveLength(1);
  }
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
