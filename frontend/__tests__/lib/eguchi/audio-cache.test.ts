import type { StorageService } from '@/lib/storage';

type MockAsset = {
  localUri: string | null;
  downloadAsync: () => Promise<void>;
};

const mockAssets = new Map<number, MockAsset>();
const mockGetInfoCalls: string[] = [];
const mockDeleteCalls: string[] = [];

const mockGetInfoAsync = async (uri: string) => {
  mockGetInfoCalls.push(uri);
  return {
    exists: true,
    size: 128,
    uri,
    isDirectory: false,
  };
};

const mockDeleteAsync = async (uri: string) => {
  mockDeleteCalls.push(uri);
};

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: (moduleId: number) => {
      const existing = mockAssets.get(moduleId);
      if (existing) {
        return existing;
      }

      const created: MockAsset = {
        localUri: null,
        downloadAsync: async () => {
          created.localUri = `file:///cache/${moduleId}.mp3`;
        },
      };
      mockAssets.set(moduleId, created);
      return created;
    },
  },
}));

jest.mock('expo-file-system', () => ({
  bundleDirectory: 'file:///bundle/',
  getInfoAsync: mockGetInfoAsync,
  deleteAsync: mockDeleteAsync,
}));

jest.mock('@/lib/eguchi/audio-pack', () => ({
  AUDIO_PACK_NAME: 'test-pack',
  AUDIO_PACK_FILES_BY_CHORD: {
    'C-E-G': [
      { module: 1, fileName: 'C-E-G__01.mp3' },
      { module: 2, fileName: 'C-E-G__02.mp3' },
    ],
    'F-A-C': [{ module: 3, fileName: 'F-A-C__01.mp3' }],
  },
}));

import {
  clearEguchiAudioPackCache,
  createDefaultEguchiAudioCacheMeta,
  estimateCachedAudioPackBytes,
  getAudioPackFileCount,
  loadEguchiAudioCacheMeta,
  preloadEguchiAudioPack,
} from '@/lib/eguchi/audio-cache';
import { STORAGE_KEYS } from '@/lib/storage';

type StorageStub = StorageService & {
  setCalls: Array<[string, unknown]>;
};

const makeStorageStub = (storedValue: unknown = null): StorageStub => {
  const setCalls: Array<[string, unknown]> = [];
  return {
    setCalls,
    get: async () => storedValue as any,
    set: async (key, value) => {
      setCalls.push([key, value]);
    },
    remove: async () => undefined,
    clear: async () => undefined,
    getAllKeys: async () => [],
  };
};

describe('eguchi audio cache', () => {
  beforeEach(() => {
    mockAssets.clear();
    mockGetInfoCalls.length = 0;
    mockDeleteCalls.length = 0;
  });

  test('builds default metadata from audio pack', () => {
    const defaults = createDefaultEguchiAudioCacheMeta();
    expect(defaults.packName).toBe('test-pack');
    expect(defaults.totalFiles).toBe(getAudioPackFileCount());
    expect(defaults.totalFiles).toBe(3);
  });

  test('load metadata resets when pack name changed', async () => {
    const storage = makeStorageStub({
      packName: 'outdated-pack',
      totalFiles: 999,
      cachedFiles: 999,
      cachedBytes: 999,
      lastCachedAt: '2026-01-01T00:00:00.000Z',
      lastClearedAt: null,
    });

    const meta = await loadEguchiAudioCacheMeta(storage);
    expect(meta.packName).toBe('test-pack');
    expect(meta.totalFiles).toBe(3);
    expect(meta.cachedFiles).toBe(0);
  });

  test('preload caches files and persists metadata', async () => {
    const storage = makeStorageStub();
    const progressUpdates: number[] = [];
    const entries = [
      { module: 11, fileName: 'a.mp3' },
      { module: 12, fileName: 'b.mp3' },
    ];

    const result = await preloadEguchiAudioPack(
      {
        entries,
        onProgress: progress => progressUpdates.push(progress.completed),
      },
      storage
    );

    expect(result.totalFiles).toBe(2);
    expect(result.cachedFiles).toBe(2);
    expect(result.failedFiles).toBe(0);
    expect(progressUpdates).toEqual([1, 2]);
    expect(storage.setCalls.length).toBe(1);
    expect(storage.setCalls[0][0]).toBe(STORAGE_KEYS.EGUCHI_AUDIO_CACHE_META);
  });

  test('clear removes cache files and tracks skipped entries', async () => {
    const storage = makeStorageStub(createDefaultEguchiAudioCacheMeta());
    mockAssets.set(21, {
      localUri: 'file:///cache/c.mp3',
      downloadAsync: async () => undefined,
    });
    mockAssets.set(22, {
      localUri: 'file:///bundle/d.mp3',
      downloadAsync: async () => undefined,
    });

    const result = await clearEguchiAudioPackCache(
      {
        entries: [
          { module: 21, fileName: 'c.mp3' },
          { module: 22, fileName: 'd.mp3' },
        ],
      },
      storage
    );

    expect(result.totalFiles).toBe(2);
    expect(result.clearedFiles).toBe(1);
    expect(result.skippedFiles).toBe(1);
    expect(mockDeleteCalls.length).toBe(1);
    expect(storage.setCalls[0][0]).toBe(STORAGE_KEYS.EGUCHI_AUDIO_CACHE_META);
  });

  test('estimates bytes from unique local cache files', async () => {
    mockAssets.set(31, {
      localUri: 'file:///cache/one.mp3',
      downloadAsync: async () => undefined,
    });
    mockAssets.set(32, {
      localUri: 'file:///cache/one.mp3',
      downloadAsync: async () => undefined,
    });

    const bytes = await estimateCachedAudioPackBytes([
      { module: 31, fileName: 'one.mp3' },
      { module: 32, fileName: 'one-copy.mp3' },
    ]);

    expect(bytes).toBe(128);
  });
});
