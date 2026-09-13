import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, jest, test } from '@jest/globals';
import { AppearanceProvider, loadBackground, useAppearance } from '@/lib/foundation/Appearance';
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
  await real.set(STORAGE_KEYS.EGUCHI_APPEARANCE, { backgroundId: 'sunshine' });
  mockStorage = getDebugStorage(real);
  const root = await render();
  expect(appearance.background.color).toBe('#FFD6E7');
  await act(async () => appearance.chooseBackground('lavender'));
  mockStorage = real;
  await act(async () => root.update(tree()));
  expect(appearance.background.id).toBe('sunshine');
  expect(await loadBackground(getDebugStorage(real))).toBe('lavender');
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
