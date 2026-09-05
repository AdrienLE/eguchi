import type { ApiResponse } from '@/lib/api';
import { DEFAULT_UNLOCKED_CHORD_IDS } from '@/lib/eguchi/chords';
import {
  createDefaultEguchiProgress,
  recordTrial,
  type EguchiProgress,
  type EguchiTrialRecord,
} from '@/lib/eguchi/progress';
import {
  createDefaultEguchiSessionPreferences,
  type EguchiSessionPreferences,
} from '@/lib/eguchi/session-preferences';
import { STORAGE_KEYS, type StorageService } from '@/lib/storage';

jest.mock('@/lib/eguchi/audio-pack', () => ({
  AUDIO_PACK_NAME: 'eguchi-pack-test',
  AUDIO_PACK_HASH: 'hash',
}));

import {
  loadEguchiSyncQueue,
  markEguchiProgressDirty,
  markEguchiProgressReset,
  queueEguchiTrialEvent,
  syncEguchiState,
  type EguchiSyncResponse,
} from '@/lib/eguchi/sync';

type StorageStub = StorageService & {
  values: Map<string, unknown>;
};

const makeStorage = (initial: Record<string, unknown> = {}): StorageStub => {
  const values = new Map<string, unknown>(Object.entries(initial));
  return {
    values,
    get: async key => (values.has(key) ? (values.get(key) as any) : null),
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async key => {
      values.delete(key);
    },
    clear: async () => {
      values.clear();
    },
    getAllKeys: async () => [...values.keys()],
  };
};

const makeApiClient = (response: ApiResponse<EguchiSyncResponse>) => {
  const posts: Array<{ endpoint: string; data: unknown; token?: string }> = [];
  return {
    posts,
    post: async <T>(endpoint: string, data?: any, token?: string): Promise<ApiResponse<T>> => {
      posts.push({ endpoint, data, token });
      return response as ApiResponse<T>;
    },
  };
};

const trial = (id: string): EguchiTrialRecord => ({
  id,
  chordId: 'C-E-G',
  correct: true,
  outcome: null,
  promptDelayMs: null,
  timestamp: '2026-01-11T10:00:00.000Z',
});

describe('eguchi local-first sync', () => {
  test('queues trial events durably and dedupes by id', async () => {
    const storage = makeStorage();

    await queueEguchiTrialEvent(trial('trial-1'), storage);
    await queueEguchiTrialEvent(trial('trial-1'), storage);

    await expect(loadEguchiSyncQueue(storage)).resolves.toEqual({
      trialEvents: [trial('trial-1')],
    });
  });

  test('sync uploads queued events and clears accepted local work', async () => {
    const progress = recordTrial(createDefaultEguchiProgress(), {
      id: 'trial-1',
      chordId: 'C-E-G',
      correct: true,
      timestamp: '2026-01-11T10:00:00.000Z',
    });
    const preferences = createDefaultEguchiSessionPreferences();
    const storage = makeStorage({
      [STORAGE_KEYS.EGUCHI_PROGRESS]: progress,
      [STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES]: preferences,
      [STORAGE_KEYS.EGUCHI_SYNC_META]: {
        clientId: 'client-a',
        progressUpdatedAt: '2026-01-11T10:01:00.000Z',
      },
      [STORAGE_KEYS.EGUCHI_SYNC_QUEUE]: { trialEvents: [trial('trial-1')] },
    });
    const apiClient = makeApiClient({
      status: 200,
      data: {
        acceptedEventIds: ['trial-1'],
        trialEvents: [],
        serverEventCursor: '2026-01-11T10:02:00.000Z',
        progressState: {
          updatedAt: '2026-01-11T10:01:00.000Z',
          data: {
            unlockedChordIds: DEFAULT_UNLOCKED_CHORD_IDS,
            lastAutoUnlockDayKey: null,
            resetAt: null,
          },
        },
        sessionPreferences: null,
        syncedAt: '2026-01-11T10:02:00.000Z',
      },
    });

    const result = await syncEguchiState({ token: 'token', apiClient, storageService: storage });

    expect(result.ok).toBe(true);
    expect(apiClient.posts[0].endpoint).toBe('/api/eguchi/sync');
    expect(apiClient.posts[0].token).toBe('token');
    expect((apiClient.posts[0].data as any).trialEvents.length).toBe(1);
    expect(await loadEguchiSyncQueue(storage)).toEqual({ trialEvents: [] });
    expect((storage.values.get(STORAGE_KEYS.EGUCHI_SYNC_META) as any).progressUpdatedAt).toBeNull();
  });

  test('sync failure keeps queued work and stores the error', async () => {
    const storage = makeStorage({
      [STORAGE_KEYS.EGUCHI_SYNC_META]: { clientId: 'client-a' },
      [STORAGE_KEYS.EGUCHI_SYNC_QUEUE]: { trialEvents: [trial('trial-1')] },
    });
    const apiClient = makeApiClient({ status: 0, error: 'Network error' });

    const result = await syncEguchiState({ token: 'token', apiClient, storageService: storage });

    expect(result.ok).toBe(false);
    expect(await loadEguchiSyncQueue(storage)).toEqual({ trialEvents: [trial('trial-1')] });
    expect((storage.values.get(STORAGE_KEYS.EGUCHI_SYNC_META) as any).lastSyncError).toBe(
      'Network error'
    );
  });

  test('remote events and preferences merge into local storage', async () => {
    const localProgress = createDefaultEguchiProgress();
    const remotePreferences: EguchiSessionPreferences = {
      ...createDefaultEguchiSessionPreferences(),
      feedbackSeconds: 3,
    };
    const storage = makeStorage({
      [STORAGE_KEYS.EGUCHI_PROGRESS]: localProgress,
      [STORAGE_KEYS.EGUCHI_SYNC_META]: { clientId: 'client-a' },
    });
    const apiClient = makeApiClient({
      status: 200,
      data: {
        acceptedEventIds: [],
        trialEvents: [
          {
            ...trial('remote-trial-1'),
            clientId: 'client-b',
            audioPackName: 'pack',
            audioPackHash: 'hash',
          },
        ],
        serverEventCursor: '2026-01-11T10:03:00.000Z',
        progressState: null,
        sessionPreferences: {
          updatedAt: '2026-01-11T10:03:00.000Z',
          data: remotePreferences,
        },
        syncedAt: '2026-01-11T10:03:00.000Z',
      },
    });

    await syncEguchiState({ token: 'token', apiClient, storageService: storage });

    const savedProgress = storage.values.get(STORAGE_KEYS.EGUCHI_PROGRESS) as EguchiProgress;
    expect(savedProgress.trialHistory.map(item => item.id)).toEqual(['remote-trial-1']);
    expect(savedProgress.dailySummaries['2026-01-11']).toEqual({ attempts: 1, correct: 1 });
    expect(storage.values.get(STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES)).toEqual(remotePreferences);
  });

  test('marking progress dirty does not require a server call', async () => {
    const storage = makeStorage();

    await markEguchiProgressDirty(storage, '2026-01-11T10:00:00.000Z');

    expect((storage.values.get(STORAGE_KEYS.EGUCHI_SYNC_META) as any).progressUpdatedAt).toBe(
      '2026-01-11T10:00:00.000Z'
    );
  });

  test('reset marker clears queued trials and filters older remote events', async () => {
    const storage = makeStorage({
      [STORAGE_KEYS.EGUCHI_PROGRESS]: recordTrial(createDefaultEguchiProgress(), {
        id: 'old-local',
        chordId: 'C-E-G',
        correct: true,
        timestamp: '2026-01-11T09:00:00.000Z',
      }),
      [STORAGE_KEYS.EGUCHI_SYNC_META]: { clientId: 'client-a' },
      [STORAGE_KEYS.EGUCHI_SYNC_QUEUE]: { trialEvents: [trial('queued-before-reset')] },
    });
    await markEguchiProgressReset(storage, '2026-01-11T10:00:00.000Z');
    const apiClient = makeApiClient({
      status: 200,
      data: {
        acceptedEventIds: [],
        trialEvents: [
          {
            ...trial('old-remote'),
            timestamp: '2026-01-11T09:30:00.000Z',
            clientId: 'client-b',
            audioPackName: 'pack',
            audioPackHash: 'hash',
          },
          {
            ...trial('new-remote'),
            timestamp: '2026-01-11T10:30:00.000Z',
            clientId: 'client-b',
            audioPackName: 'pack',
            audioPackHash: 'hash',
          },
        ],
        serverEventCursor: '2026-01-11T10:31:00.000Z',
        progressState: {
          updatedAt: '2026-01-11T10:00:00.000Z',
          data: {
            unlockedChordIds: DEFAULT_UNLOCKED_CHORD_IDS,
            lastAutoUnlockDayKey: null,
            resetAt: '2026-01-11T10:00:00.000Z',
          },
        },
        sessionPreferences: null,
        syncedAt: '2026-01-11T10:31:00.000Z',
      },
    });

    await syncEguchiState({ token: 'token', apiClient, storageService: storage });

    expect((apiClient.posts[0].data as any).trialEvents).toEqual([]);
    const savedProgress = storage.values.get(STORAGE_KEYS.EGUCHI_PROGRESS) as EguchiProgress;
    expect(savedProgress.trialHistory.map(item => item.id)).toEqual(['new-remote']);
    expect((storage.values.get(STORAGE_KEYS.EGUCHI_SYNC_META) as any).progressResetAt).toBe(
      '2026-01-11T10:00:00.000Z'
    );
  });
});

describe('edits during sync', () => {
  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => {
      resolve = done;
    });
    return { promise, resolve };
  };

  for (const fail of [false, true]) {
    test(`preserves new work while request fails=${fail}`, async () => {
      const { persistEguchiProgressChange, persistEguchiPreferencesChange } = await import(
        '@/lib/eguchi/sync'
      );
      const storage = makeStorage();
      const first = recordTrial(createDefaultEguchiProgress(), {
        ...trial('first'),
        outcome: undefined,
      });
      await persistEguchiProgressChange(first, trial('first'), storage);
      const started = deferred<any>();
      const response = deferred<any>();
      const apiClient = {
        post: async (_url: string, payload?: any) => {
          started.resolve(payload);
          return response.promise;
        },
      };
      const pending = syncEguchiState({ token: 'token', apiClient, storageService: storage });
      const payload = await started.promise;
      await persistEguchiProgressChange(
        recordTrial(first, { ...trial('second'), outcome: undefined }),
        trial('second'),
        storage
      );
      const preferences = { ...createDefaultEguchiSessionPreferences(), feedbackSeconds: 7 };
      await persistEguchiPreferencesChange(preferences, storage);
      const revision = (storage.values.get(STORAGE_KEYS.EGUCHI_SYNC_META) as any).progressUpdatedAt;
      response.resolve(
        fail
          ? { error: 'offline', status: 0 }
          : {
              status: 200,
              data: {
                acceptedEventIds: ['first'],
                trialEvents: payload.trialEvents,
                progressState: payload.progressState,
                sessionPreferences: {
                  updatedAt: payload.progressState.updatedAt,
                  data: createDefaultEguchiSessionPreferences(),
                },
                serverEventCursor: '2026-01-11T11:00:00.000Z',
                syncedAt: '2026-01-11T11:00:00.000Z',
              },
            }
      );
      await pending;
      expect(
        (storage.values.get(STORAGE_KEYS.EGUCHI_PROGRESS) as EguchiProgress).trialHistory.map(
          t => t.id
        )
      ).toEqual(['first', 'second']);
      expect((await loadEguchiSyncQueue(storage)).trialEvents.map(t => t.id)).toEqual(
        fail ? ['first', 'second'] : ['second']
      );
      expect(storage.values.get(STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES)).toEqual(preferences);
      expect((storage.values.get(STORAGE_KEYS.EGUCHI_SYNC_META) as any).progressUpdatedAt).toBe(
        revision
      );
      expect(
        (storage.values.get(STORAGE_KEYS.EGUCHI_SYNC_META) as any).preferencesUpdatedAt
      ).toBeTruthy();
    });
  }
  test('concurrent queue writes retain both events', async () => {
    const storage = makeStorage();
    await Promise.all([
      queueEguchiTrialEvent(trial('a'), storage),
      queueEguchiTrialEvent(trial('b'), storage),
    ]);
    expect((await loadEguchiSyncQueue(storage)).trialEvents.map(t => t.id)).toEqual(['a', 'b']);
  });

  test('a reset during sync cannot resurrect old rounds', async () => {
    const { persistEguchiProgressChange, resetEguchiSyncedProgress } = await import(
      '@/lib/eguchi/sync'
    );
    const storage = makeStorage();
    await persistEguchiProgressChange(
      recordTrial(createDefaultEguchiProgress(), { ...trial('old'), outcome: undefined }),
      trial('old'),
      storage
    );
    const started = deferred<any>();
    const response = deferred<any>();
    const apiClient = {
      post: async (_url: string, payload?: any) => {
        started.resolve(payload);
        return response.promise;
      },
    };
    const pending = syncEguchiState({ token: 'token', apiClient, storageService: storage });
    const payload = await started.promise;
    await resetEguchiSyncedProgress(storage);
    response.resolve({
      status: 200,
      data: {
        acceptedEventIds: ['old'],
        trialEvents: payload.trialEvents,
        progressState: payload.progressState,
        sessionPreferences: null,
        serverEventCursor: null,
        syncedAt: new Date().toISOString(),
      },
    });
    await pending;
    expect(
      (storage.values.get(STORAGE_KEYS.EGUCHI_PROGRESS) as EguchiProgress).trialHistory
    ).toEqual([]);
    expect((await loadEguchiSyncQueue(storage)).trialEvents).toEqual([]);
    expect(
      (storage.values.get(STORAGE_KEYS.EGUCHI_SYNC_META) as any).progressUpdatedAt
    ).toBeTruthy();
  });
});
