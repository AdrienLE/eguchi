import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, jest, test } from '@jest/globals';
import {
  AppearanceProvider,
  loadBackground,
  loadPlayroomOptions,
  useAppearance,
} from '@/lib/foundation/Appearance';
import { getDebugStorage } from '@/lib/foundation/debug';
import { STORAGE_KEYS, type StorageService } from '@/lib/storage';

function memory(): StorageService {
  const values = new Map<string, unknown>();
  return {
    get: async <T,>(key: string) => (values.get(key) as T) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async key => {
      values.delete(key);
    },
    getAllKeys: async () => [...values.keys()],
    clear: async () => {
      values.clear();
    },
  };
}
let mockStorage = memory();
jest.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ practiceStorage: mockStorage }) }));
let appearance!: ReturnType<typeof useAppearance>;
function Probe() {
  appearance = useAppearance();
  return null;
}
const tree = () => (
  <AppearanceProvider>
    <Probe />
  </AppearanceProvider>
);
async function render() {
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(tree());
  });
  return root;
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockStorage = memory();
});

test('defaults to Iris’s original pink and reads the previous color without changing teaching settings', async () => {
  expect(await loadBackground(mockStorage)).toBe('pink');
  const legacy = { playroomBackgroundId: 'mint', autoAdvanceMs: 4500, sessionLength: 10 };
  await mockStorage.set(STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES, legacy);
  expect(await loadBackground(mockStorage)).toBe('mint');
  const root = await render();
  await act(async () => appearance.chooseBackground('sky'));
  expect(appearance.background.id).toBe('sky');
  expect(await mockStorage.get(STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES)).toEqual(legacy);
  await act(async () => root.unmount());
  const restored = await render();
  expect(appearance.background.id).toBe('sky');
  await act(async () => restored.unmount());
});

test('debug appearance stays separate and changing accounts reloads the correct background', async () => {
  const real = mockStorage;
  await real.set(STORAGE_KEYS.EGUCHI_APPEARANCE, { backgroundId: 'sunshine', feedbackMs: 4000 });
  mockStorage = getDebugStorage(real);
  const root = await render();
  expect(appearance.background.color).toBe('#FFD6E7');
  await act(async () => appearance.chooseBackground('lavender'));
  await act(async () => appearance.updateOptions({ feedbackMs: 8000 }));
  mockStorage = real;
  await act(async () => root.update(tree()));
  expect(appearance.background.id).toBe('sunshine');
  expect(appearance.options.feedbackMs).toBe(4000);
  expect(await loadBackground(getDebugStorage(real))).toBe('lavender');
  expect((await loadPlayroomOptions(getDebugStorage(real))).feedbackMs).toBe(8000);
  await act(async () => root.unmount());
});

test('a failed save leaves the displayed choice intact and can be retried', async () => {
  const root = await render();
  const write = mockStorage.set;
  mockStorage.set = async () => {
    throw new Error('Full disk');
  };
  await act(async () => appearance.chooseBackground('sky'));
  expect(appearance.background.id).toBe('pink');
  expect(appearance.error).toContain('could not be saved');
  mockStorage.set = write;
  await act(async () => appearance.chooseBackground('sky'));
  expect(appearance.error).toBeNull();
  expect(appearance.background.id).toBe('sky');
  await act(async () => root.unmount());
});

test('unknown stored colors fall back to pink', async () => {
  await mockStorage.set(STORAGE_KEYS.EGUCHI_APPEARANCE, { backgroundId: 'dark' });
  expect(await loadBackground(mockStorage)).toBe('pink');
});

test('timing and parent controls persist across color changes and reload', async () => {
  const root = await render();
  expect(appearance.options).toMatchObject({
    feedbackMs: 3000,
    animalMotion: true,
    holdNoResponse: true,
  });
  await act(async () => appearance.updateOptions({ feedbackMs: 5000, animalMotion: false }));
  await act(async () => appearance.chooseBackground('sky'));
  await act(async () => appearance.updateOptions({ holdNoResponse: false }));
  await act(async () => root.unmount());
  const restored = await render();
  expect(appearance.options).toEqual({
    backgroundId: 'sky',
    feedbackMs: 5000,
    animalMotion: false,
    holdNoResponse: false,
  });
  await act(async () => restored.unmount());
});

test.each([0, -1000, 10001, '5000', null, Number.NaN])(
  'invalid saved timer %s uses the three-second default',
  async feedbackMs => {
    await mockStorage.set(STORAGE_KEYS.EGUCHI_APPEARANCE, { backgroundId: 'mint', feedbackMs });
    expect(await loadPlayroomOptions(mockStorage)).toMatchObject({
      backgroundId: 'mint',
      feedbackMs: 3000,
    });
  }
);

test('a failed timing save preserves the current timer and can be retried', async () => {
  const root = await render();
  const write = mockStorage.set;
  mockStorage.set = async () => {
    throw new Error('Full disk');
  };
  await act(async () => appearance.updateOptions({ feedbackMs: 8000 }));
  expect(appearance.options.feedbackMs).toBe(3000);
  expect(appearance.error).toContain('could not be saved');
  mockStorage.set = write;
  await act(async () => appearance.updateOptions({ feedbackMs: 8000 }));
  expect(appearance.options.feedbackMs).toBe(8000);
  expect((await loadPlayroomOptions(mockStorage)).feedbackMs).toBe(8000);
  await act(async () => root.unmount());
});
