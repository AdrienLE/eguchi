import { expect, jest, test } from '@jest/globals';
import { FoundationStore } from '@/lib/foundation/store';
import { makeEvent } from '@/lib/foundation/program';
import type { StorageService } from '@/lib/storage';
import type { ApiClient } from '@/lib/api';
const memory = () => {
  const values = new Map<string, unknown>();
  const service: StorageService = {
    get: async <T>(k: string) => (values.get(k) as T) ?? null,
    set: async (k, v) => {
      values.set(k, v);
    },
    remove: async k => {
      values.delete(k);
    },
    getAllKeys: async () => [...values.keys()],
    clear: async () => values.clear(),
  };
  return service;
};
test('concurrent saves survive a reload and do not overwrite each other', async () => {
  const disk = memory();
  const store = new FoundationStore(disk);
  const a = makeEvent('preparation', { lessonId: 'purpose' });
  const b = makeEvent('preparation', { lessonId: 'care' });
  await Promise.all([store.append(a), store.append(b)]);
  const restored = new FoundationStore(disk);
  await restored.load();
  expect(restored.getSnapshot().events).toHaveLength(2);
  expect(new Set(restored.getSnapshot().pendingIds)).toEqual(new Set([a.id, b.id]));
});
test('a failed local write does not claim that an answer was recorded', async () => {
  const disk = memory();
  disk.set = async () => {
    throw new Error('disk full');
  };
  const store = new FoundationStore(disk);
  await expect(store.append(makeEvent('preparation', { lessonId: 'purpose' }))).rejects.toThrow(
    'disk full'
  );
  expect(store.getSnapshot().events).toHaveLength(0);
});
test('offline sync retains its queue and a retry is safe', async () => {
  const store = new FoundationStore(memory());
  const event = makeEvent('preparation', { lessonId: 'purpose' });
  await store.append(event);
  const post = jest
    .fn<(...args: any[]) => Promise<any>>()
    .mockResolvedValueOnce({ status: 0, error: 'offline' })
    .mockResolvedValueOnce({
      status: 200,
      data: { acknowledged: [event.id], events: [event], cursor: 7, hasMore: false },
    });
  const api = { post } as unknown as ApiClient;
  await expect(store.sync('account-a', api)).rejects.toThrow('Saved on this device');
  expect(store.getSnapshot().pendingIds).toEqual([event.id]);
  await store.sync('account-a', api);
  expect(store.getSnapshot().events).toHaveLength(1);
  expect(store.getSnapshot().pendingIds).toHaveLength(0);
  expect(post.mock.calls[1][1]).toMatchObject({ hasMorePending: false });
});
test('a response arriving during sync does not get lost or sent to another account', async () => {
  const a = new FoundationStore(memory());
  const b = new FoundationStore(memory());
  const first = makeEvent('preparation', { lessonId: 'purpose' });
  await a.append(first);
  let finish!: (value: any) => void;
  let started!: (value?: unknown) => void;
  const hasStarted = new Promise(resolve => {
    started = resolve;
  });
  const second = makeEvent('preparation', { lessonId: 'care' });
  const post = jest
    .fn<(...args: any[]) => Promise<any>>()
    .mockImplementationOnce(async () => {
      started();
      return new Promise(resolve => {
        finish = resolve;
      });
    })
    .mockResolvedValueOnce({
      status: 200,
      data: { acknowledged: [second.id], events: [second], cursor: 2, hasMore: false },
    });
  const sync = a.sync('account-a', { post } as unknown as ApiClient);
  await hasStarted;
  await a.append(second);
  await b.load();
  finish({
    status: 200,
    data: { acknowledged: [first.id], events: [first], cursor: 1, hasMore: false },
  });
  await sync;
  expect(a.getSnapshot().events).toHaveLength(2);
  expect(a.getSnapshot().pendingIds).toHaveLength(0);
  expect(b.getSnapshot().events).toHaveLength(0);
  expect(post.mock.calls.every(call => call[2] === 'account-a')).toBe(true);
});
