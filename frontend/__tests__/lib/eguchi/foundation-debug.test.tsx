import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import type { StorageService } from '@/lib/storage';
import { debugStageEvent, getDebugStorage, isDebugEnabled } from '@/lib/foundation/debug';
import { FoundationStore, FOUNDATION_STORAGE_KEY } from '@/lib/foundation/store';
import { DebugModeProvider, useDebugMode } from '@/lib/foundation/DebugMode';
import { FoundationProvider, useFoundation } from '@/lib/foundation/FoundationProvider';
import { makeEvent } from '@/lib/foundation/program';

const memory = (): StorageService => {
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
};
let mockDisk = memory();
let mockDebugParam: string | undefined = 'True';
let mockPlatform = 'web';
const mockSetParams = jest.fn();
const mockSync = jest.fn();
const mockReminders = jest.fn<() => Promise<string>>().mockResolvedValue('off');
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatform;
    },
  },
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}));
jest.mock('expo-router', () => ({
  useGlobalSearchParams: () => ({ debug: mockDebugParam }),
  useRootNavigationState: () => ({ key: 'test-root' }),
  useRouter: () => ({ setParams: mockSetParams }),
}));
jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    practiceStorage: getDebugStorage(mockDisk),
    token: 'present-but-never-used',
    loading: false,
  }),
}));
jest.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => mockSync(...args) } }));
jest.mock('@/lib/foundation/notifications', () => ({
  reconcileNotifications: () => mockReminders(),
}));
jest.mock('@/lib/eguchi/account-storage', () => ({ getEguchiAccountKey: () => 'test-account' }));
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  mockDisk = memory();
  mockDebugParam = 'True';
  mockPlatform = 'web';
  mockSetParams.mockClear();
  mockSync.mockClear();
  mockReminders.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

test('only an explicit true query enables web debug; native and false stay normal', () => {
  for (const value of ['True', 'true', 'TRUE']) expect(isDebugEnabled(value, 'web')).toBe(true);
  for (const value of [undefined, '', 'False', '1', ['True']])
    expect(isDebugEnabled(value, 'web')).toBe(false);
  expect(isDebugEnabled('True', 'ios')).toBe(false);
  expect(isDebugEnabled('True', 'android')).toBe(false);
});

test('debug stage changes include all earlier animals and respect curriculum boundaries', () => {
  expect(debugStageEvent(2).data).toEqual({
    stage: 2,
    activeChordIds: ['C-E-G', 'C-F-A'],
    introductionChordId: 'C-F-A',
  });
  expect(debugStageEvent(99).data.activeChordIds).toHaveLength(14);
  expect(debugStageEvent(-1).data).toMatchObject({ stage: 1, introductionChordId: null });
});

test('debug records survive reload and reset without touching real guest or account data', async () => {
  const real = new FoundationStore(mockDisk);
  await real.append(makeEvent('preparation', { lessonId: 'purpose' }));
  await mockDisk.set('account:child-record', { keep: true });
  const initial = await mockDisk.get(FOUNDATION_STORAGE_KEY);
  const sandbox = new FoundationStore(getDebugStorage(mockDisk));
  await sandbox.append(debugStageEvent(14));
  const restored = new FoundationStore(getDebugStorage(mockDisk));
  await restored.load();
  expect(restored.getSnapshot().events[0].data).toMatchObject({ stage: 14 });
  await restored.reset();
  expect(restored.getSnapshot().events).toEqual([]);
  expect(await mockDisk.get(FOUNDATION_STORAGE_KEY)).toEqual(initial);
  expect(await mockDisk.get('account:child-record')).toEqual({ keep: true });
  await getDebugStorage(mockDisk).clear();
  expect(await mockDisk.get(FOUNDATION_STORAGE_KEY)).toEqual(initial);
});

test('navigation retains debug mode and restores the URL flag; explicit false exits', async () => {
  let enabled = false;
  function Read() {
    enabled = useDebugMode();
    return null;
  }
  let root!: ReactTestRenderer;
  const tree = () => (
    <DebugModeProvider>
      <Read />
    </DebugModeProvider>
  );
  await act(async () => {
    root = create(tree());
  });
  expect(enabled).toBe(true);
  mockDebugParam = undefined;
  await act(async () => root.update(tree()));
  expect(enabled).toBe(true);
  expect(mockSetParams).toHaveBeenCalledWith({ debug: 'True' });
  mockDebugParam = 'False';
  await act(async () => root.update(tree()));
  expect(enabled).toBe(false);
  await act(async () => root.unmount());
});

test('debug provider never syncs or schedules reminders, even with a token present', async () => {
  let f!: ReturnType<typeof useFoundation>;
  function Read() {
    f = useFoundation();
    return null;
  }
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(
      <DebugModeProvider>
        <FoundationProvider>
          <Read />
        </FoundationProvider>
      </DebugModeProvider>
    );
  });
  expect(f.ready).toBe(true);
  await act(async () => {
    await f.append(debugStageEvent(3));
    await f.sync();
    jest.advanceTimersByTime(5000);
  });
  expect(mockSync).not.toHaveBeenCalled();
  expect(mockReminders).not.toHaveBeenCalled();
  await act(async () => f.resetDebug());
  expect(f.snapshot.events).toEqual([]);
  expect(await mockDisk.get(FOUNDATION_STORAGE_KEY)).toBeNull();
  await act(async () => root.unmount());
});
