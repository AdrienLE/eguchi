import type { StorageService } from '@/lib/storage';
import type { ApiClient } from '@/lib/api';
import { mergeEvents, type FoundationEvent } from './program';

export const FOUNDATION_STORAGE_KEY = 'eguchi_foundation_v1';
export interface FoundationSnapshot {
  version: 1;
  events: FoundationEvent[];
  pendingIds: string[];
  cursor: number;
}
interface SyncResponse {
  acknowledged: string[];
  events: FoundationEvent[];
  cursor: number;
  hasMore: boolean;
}
const empty = (): FoundationSnapshot => ({ version: 1, events: [], pendingIds: [], cursor: 0 });

/** An immutable account handle; network responses cannot leak across account switches. */
export class FoundationStore {
  private snapshot = empty();
  private listeners = new Set<() => void>();
  private writes: Promise<unknown> = Promise.resolve();
  private loading: Promise<void> | null = null;
  private syncing: Promise<void> | null = null;
  constructor(private storage: StorageService) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  load = () => {
    if (!this.loading)
      this.loading = (async () => {
        const saved = await this.storage.get<FoundationSnapshot>(FOUNDATION_STORAGE_KEY);
        if (saved) {
          if (
            saved.version !== 1 ||
            !Array.isArray(saved.events) ||
            !Array.isArray(saved.pendingIds) ||
            !Number.isInteger(saved.cursor)
          )
            throw new Error('This practice record cannot be opened by this version.');
          this.snapshot = saved;
        }
        this.listeners.forEach(listener => listener());
      })();
    return this.loading;
  };
  private update = async (change: (current: FoundationSnapshot) => FoundationSnapshot) => {
    const next = this.writes
      .catch(() => {})
      .then(async () => {
        await this.load();
        const updated = change(this.snapshot);
        // A response is only shown as recorded after durable local storage succeeds.
        await this.storage.set(FOUNDATION_STORAGE_KEY, updated);
        this.snapshot = updated;
        this.listeners.forEach(listener => listener());
      });
    this.writes = next;
    return next;
  };
  append = (event: FoundationEvent) => this.appendMany([event]);
  reset = () => this.update(() => empty());
  appendMany = (events: FoundationEvent[]) =>
    this.update(current => ({
      ...current,
      events: mergeEvents(current.events, events),
      pendingIds: [...new Set([...current.pendingIds, ...events.map(e => e.id)])],
    }));
  sync = (token: string, api: ApiClient): Promise<void> => {
    if (this.syncing) return this.syncing;
    this.syncing = (async () => {
      await this.load();
      let more = true;
      while (more) {
        const snapshot = this.snapshot;
        const pending = new Set(snapshot.pendingIds.slice(0, 100));
        const response = await api.post<SyncResponse>(
          '/api/foundation/sync',
          {
            events: snapshot.events.filter(e => pending.has(e.id)),
            cursor: snapshot.cursor,
            hasMorePending: snapshot.pendingIds.length > pending.size,
          },
          token
        );
        if (!response.data || response.error)
          throw new Error(
            response.status === 401
              ? 'Sign in again to sync your practice.'
              : 'Saved on this device. Account sync will retry when connected.'
          );
        const result = response.data;
        await this.update(current => ({
          ...current,
          events: mergeEvents(current.events, result.events),
          pendingIds: current.pendingIds.filter(id => !result.acknowledged.includes(id)),
          cursor: Math.max(current.cursor, result.cursor),
        }));
        more = result.hasMore || this.snapshot.pendingIds.length > 0;
      }
    })().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  };
}
const stores = new WeakMap<StorageService, FoundationStore>();
export const getFoundationStore = (storage: StorageService) => {
  let store = stores.get(storage);
  if (!store) {
    store = new FoundationStore(storage);
    stores.set(storage, store);
  }
  return store;
};
