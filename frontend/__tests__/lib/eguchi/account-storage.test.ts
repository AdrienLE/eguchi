import { getEguchiAccountKey, getEguchiAccountStorage } from '@/lib/eguchi/account-storage';
import { STORAGE_KEYS, type StorageService } from '@/lib/storage';
import { createDefaultEguchiProgress, recordTrial } from '@/lib/eguchi/progress';
import {
  loadEguchiSyncQueue,
  persistEguchiProgressChange,
  syncEguchiState,
} from '@/lib/eguchi/sync';

jest.mock('@/lib/eguchi/audio-pack', () => ({ AUDIO_PACK_NAME: 'test', AUDIO_PACK_HASH: 'hash' }));

const token = (sub: string, revision = 1) =>
  `header.${Buffer.from(JSON.stringify({ iss: 'https://auth.test/', sub, exp: 9999999999, revision })).toString('base64url')}.signature`;
const makeBase = (): StorageService => {
  const values = new Map<string, unknown>();
  return {
    get: async <T>(key: string) =>
      values.has(key) ? (JSON.parse(JSON.stringify(values.get(key))) as T) : null,
    set: async (key, value) => {
      values.set(key, JSON.parse(JSON.stringify(value)));
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

describe('account-scoped practice', () => {
  test('isolates guest data, account history, preferences, queues, and cursors', async () => {
    const base = makeBase();
    const guest = getEguchiAccountStorage(null, base);
    const a = getEguchiAccountStorage(token('a'), base);
    const b = getEguchiAccountStorage(token('b'), base);
    for (const key of [
      STORAGE_KEYS.EGUCHI_PROGRESS,
      STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES,
      STORAGE_KEYS.EGUCHI_SYNC_QUEUE,
      STORAGE_KEYS.EGUCHI_SYNC_META,
    ]) {
      await guest.set(key, { guest: true });
      await a.set(key, { account: 'a' });
      expect(await b.get(key)).toBeNull();
      await b.set(key, { account: 'b' });
      expect(await a.get(key)).toEqual({ account: 'a' });
      expect(await guest.get(key)).toEqual({ guest: true });
    }
    expect(getEguchiAccountStorage(token('a', 2), base)).toBe(a);
    await b.clear();
    expect(await a.get(STORAGE_KEYS.EGUCHI_PROGRESS)).toEqual({ account: 'a' });
    expect(await guest.get(STORAGE_KEYS.EGUCHI_PROGRESS)).toEqual({ guest: true });
  });

  test('pending sync remains bound to account A when B begins practicing', async () => {
    const base = makeBase();
    const a = getEguchiAccountStorage(token('a'), base);
    const b = getEguchiAccountStorage(token('b'), base);
    const progress = recordTrial(createDefaultEguchiProgress(), {
      id: 'a-round',
      chordId: 'C-E-G',
      correct: true,
    });
    await persistEguchiProgressChange(progress, progress.trialHistory[0], a);
    let finish!: (value: any) => void;
    let begin!: (value: any) => void;
    const started = new Promise<any>(resolve => {
      begin = resolve;
    });
    const response = new Promise<any>(resolve => {
      finish = resolve;
    });
    const pending = syncEguchiState({
      token: token('a'),
      storageService: a,
      apiClient: {
        post: async (_url, payload) => {
          begin(payload);
          return response;
        },
      },
    });
    const sent = await started;
    await b.set(STORAGE_KEYS.EGUCHI_PROGRESS, { b: true });
    finish({
      status: 200,
      data: {
        acceptedEventIds: ['a-round'],
        trialEvents: sent.trialEvents,
        progressState: sent.progressState,
        sessionPreferences: null,
        serverEventCursor: '2026-09-05T10:00:00.000Z',
        syncedAt: '2026-09-05T10:00:00.000Z',
      },
    });
    await pending;
    expect(await b.get(STORAGE_KEYS.EGUCHI_PROGRESS)).toEqual({ b: true });
    expect(await b.get(STORAGE_KEYS.EGUCHI_SYNC_META)).toBeNull();
    expect((await loadEguchiSyncQueue(b)).trialEvents).toEqual([]);
    expect((await loadEguchiSyncQueue(a)).trialEvents).toEqual([]);
    let bPayload: any;
    await syncEguchiState({
      token: token('b'),
      storageService: b,
      apiClient: {
        post: async (_url, payload) => {
          bPayload = payload;
          return { status: 0, error: 'offline' };
        },
      },
    });
    expect(bPayload.trialEvents).toEqual([]);
    expect(bPayload.lastServerEventCursor).toBeNull();
    expect(bPayload.progressState).toBeNull();
  });

  test('rejects tokens without an account identity', () => {
    expect(() => getEguchiAccountKey('invalid-token')).toThrow();
    const unidentified = `header.${Buffer.from('{}').toString('base64url')}.signature`;
    expect(() => getEguchiAccountKey(unidentified)).toThrow();
  });
});
