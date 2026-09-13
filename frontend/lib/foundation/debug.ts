import type { StorageService } from '@/lib/storage';
import { CHORD_CURRICULUM, curriculumThrough } from './curriculum';
import { makeEvent } from './program';

export const isDebugEnabled = (value: unknown, platform: string) =>
  platform === 'web' && typeof value === 'string' && value.toLowerCase() === 'true';

const prefix = 'eguchi_debug_v1:';
const handles = new WeakMap<StorageService, StorageService>();
/** A separate local sandbox, never the guest or signed-in child's practice record. */
export const getDebugStorage = (base: StorageService): StorageService => {
  const previous = handles.get(base);
  if (previous) return previous;
  const getAllKeys = async () =>
    (await base.getAllKeys())
      .filter(key => key.startsWith(prefix))
      .map(key => key.slice(prefix.length));
  const scoped: StorageService = {
    get: key => base.get(prefix + key),
    set: (key, value) => base.set(prefix + key, value),
    remove: key => base.remove(prefix + key),
    getAllKeys,
    clear: async () => {
      for (const key of await getAllKeys()) await base.remove(prefix + key);
    },
  };
  handles.set(base, scoped);
  return scoped;
};

export const debugStageEvent = (requested: number) => {
  const stage = Math.max(1, Math.min(CHORD_CURRICULUM.length, Math.trunc(requested) || 1));
  return makeEvent('preferences', {
    stage,
    activeChordIds: curriculumThrough(stage),
    introductionChordId: stage > 1 ? CHORD_CURRICULUM[stage - 1].id : null,
  });
};
