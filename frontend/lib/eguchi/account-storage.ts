import jwtDecode from 'jwt-decode';
import { storage, STORAGE_KEYS, type StorageService } from '@/lib/storage';

const practiceKeys: string[] = [
  STORAGE_KEYS.EGUCHI_FOUNDATION,
  STORAGE_KEYS.EGUCHI_APPEARANCE,
  STORAGE_KEYS.EGUCHI_PROGRESS,
  STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES,
  STORAGE_KEYS.EGUCHI_SYNC_META,
  STORAGE_KEYS.EGUCHI_SYNC_QUEUE,
];
const stores = new WeakMap<StorageService, Map<string, StorageService>>();

export const getEguchiAccountKey = (token: string | null): string => {
  if (!token) return 'guest';
  const claims = jwtDecode<{ iss?: string; sub?: string }>(token);
  if (
    typeof claims.iss !== 'string' ||
    !claims.iss ||
    typeof claims.sub !== 'string' ||
    !claims.sub
  )
    throw new Error('Account sync requires an identifiable account.');
  return `account:${encodeURIComponent(JSON.stringify([claims.iss, claims.sub]))}`;
};

// Storage handles are immutable: an in-flight request keeps its original account
// even if the caregiver signs out or switches accounts before it completes.
export const getEguchiAccountStorage = (
  token: string | null,
  base: StorageService = storage
): StorageService => {
  const owner = getEguchiAccountKey(token);
  let cache = stores.get(base);
  if (!cache) {
    cache = new Map();
    stores.set(base, cache);
  }
  const existing = cache.get(owner);
  if (existing) return existing;
  // Old unassigned data remains local. It must never be claimed by the next login.
  const prefix = owner === 'guest' ? '' : `eguchi_v2:${owner}:`;
  const getAllKeys = async () =>
    (await base.getAllKeys())
      .filter(key => (prefix ? key.startsWith(prefix) : practiceKeys.includes(key)))
      .map(key => key.slice(prefix.length));
  const scoped: StorageService = {
    get: key => base.get(`${prefix}${key}`),
    set: (key, value) => base.set(`${prefix}${key}`, value),
    remove: key => base.remove(`${prefix}${key}`),
    getAllKeys,
    clear: async () => {
      for (const key of await getAllKeys()) await base.remove(`${prefix}${key}`);
    },
  };
  cache.set(owner, scoped);
  return scoped;
};
