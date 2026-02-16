import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { storage, STORAGE_KEYS, type StorageService } from '@/lib/storage';
import { AUDIO_PACK_FILES_BY_CHORD, AUDIO_PACK_NAME, type AudioEntry } from './audio-pack';

const ALL_AUDIO_ENTRIES: AudioEntry[] = Object.values(AUDIO_PACK_FILES_BY_CHORD).flat();

type AudioCacheProgressInput = {
  completed: number;
  total: number;
  fileName: string;
};

type AudioCacheOperationOptions = {
  onProgress?: (progress: AudioCacheProgressInput) => void;
  entries?: AudioEntry[];
};

export type EguchiAudioCacheMeta = {
  packName: string;
  totalFiles: number;
  cachedFiles: number;
  cachedBytes: number;
  lastCachedAt: string | null;
  lastClearedAt: string | null;
};

export type PreloadAudioCacheResult = {
  totalFiles: number;
  cachedFiles: number;
  failedFiles: number;
};

export type ClearAudioCacheResult = {
  totalFiles: number;
  clearedFiles: number;
  skippedFiles: number;
  failedFiles: number;
};

const sanitizeMeta = (stored: Partial<EguchiAudioCacheMeta> | null): EguchiAudioCacheMeta => {
  const defaults = createDefaultEguchiAudioCacheMeta();
  if (!stored) {
    return defaults;
  }

  if (stored.packName !== AUDIO_PACK_NAME) {
    return defaults;
  }

  return {
    packName: AUDIO_PACK_NAME,
    totalFiles:
      typeof stored.totalFiles === 'number' && stored.totalFiles > 0
        ? Math.round(stored.totalFiles)
        : defaults.totalFiles,
    cachedFiles:
      typeof stored.cachedFiles === 'number' && stored.cachedFiles >= 0
        ? Math.round(stored.cachedFiles)
        : 0,
    cachedBytes:
      typeof stored.cachedBytes === 'number' && stored.cachedBytes >= 0
        ? Math.round(stored.cachedBytes)
        : 0,
    lastCachedAt: typeof stored.lastCachedAt === 'string' ? stored.lastCachedAt : null,
    lastClearedAt: typeof stored.lastClearedAt === 'string' ? stored.lastClearedAt : null,
  };
};

const resolveLocalAssetUri = (entry: AudioEntry): string | null => {
  const asset = Asset.fromModule(entry.module);
  return typeof asset.localUri === 'string' ? asset.localUri : null;
};

const shouldManageUri = (uri: string): boolean => {
  if (!uri.startsWith('file://')) {
    return false;
  }
  if (FileSystem.bundleDirectory && uri.startsWith(FileSystem.bundleDirectory)) {
    return false;
  }
  return true;
};

export const getAllAudioEntries = () => ALL_AUDIO_ENTRIES;
export const getAudioPackFileCount = () => ALL_AUDIO_ENTRIES.length;

export const createDefaultEguchiAudioCacheMeta = (): EguchiAudioCacheMeta => ({
  packName: AUDIO_PACK_NAME,
  totalFiles: getAudioPackFileCount(),
  cachedFiles: 0,
  cachedBytes: 0,
  lastCachedAt: null,
  lastClearedAt: null,
});

export const loadEguchiAudioCacheMeta = async (
  storageService: StorageService = storage
): Promise<EguchiAudioCacheMeta> => {
  const stored = await storageService.get<Partial<EguchiAudioCacheMeta>>(
    STORAGE_KEYS.EGUCHI_AUDIO_CACHE_META
  );
  return sanitizeMeta(stored);
};

export const saveEguchiAudioCacheMeta = async (
  metadata: EguchiAudioCacheMeta,
  storageService: StorageService = storage
) => {
  await storageService.set(STORAGE_KEYS.EGUCHI_AUDIO_CACHE_META, metadata);
};

export const estimateCachedAudioPackBytes = async (
  entries: AudioEntry[] = ALL_AUDIO_ENTRIES
): Promise<number> => {
  let totalBytes = 0;
  const inspectedUris = new Set<string>();

  for (const entry of entries) {
    const localUri = resolveLocalAssetUri(entry);
    if (!localUri || !shouldManageUri(localUri) || inspectedUris.has(localUri)) {
      continue;
    }
    inspectedUris.add(localUri);
    try {
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists && typeof info.size === 'number') {
        totalBytes += info.size;
      }
    } catch (error) {
      console.warn('Failed to inspect cached audio file size', localUri, error);
    }
  }

  return totalBytes;
};

export const preloadEguchiAudioPack = async (
  options: AudioCacheOperationOptions = {},
  storageService: StorageService = storage
): Promise<PreloadAudioCacheResult> => {
  const entries = options.entries ?? ALL_AUDIO_ENTRIES;
  let cachedFiles = 0;
  let failedFiles = 0;

  for (const [index, entry] of entries.entries()) {
    try {
      const asset = Asset.fromModule(entry.module);
      await asset.downloadAsync();
      if (asset.localUri) {
        cachedFiles += 1;
      } else {
        failedFiles += 1;
      }
    } catch (error) {
      failedFiles += 1;
      console.warn('Failed to cache audio file', entry.fileName, error);
    }

    options.onProgress?.({
      completed: index + 1,
      total: entries.length,
      fileName: entry.fileName,
    });
  }

  const nextMeta: EguchiAudioCacheMeta = {
    packName: AUDIO_PACK_NAME,
    totalFiles: entries.length,
    cachedFiles,
    cachedBytes: await estimateCachedAudioPackBytes(entries),
    lastCachedAt: new Date().toISOString(),
    lastClearedAt: null,
  };

  await saveEguchiAudioCacheMeta(nextMeta, storageService);

  return {
    totalFiles: entries.length,
    cachedFiles,
    failedFiles,
  };
};

export const clearEguchiAudioPackCache = async (
  options: AudioCacheOperationOptions = {},
  storageService: StorageService = storage
): Promise<ClearAudioCacheResult> => {
  const entries = options.entries ?? ALL_AUDIO_ENTRIES;
  const deletedUris = new Set<string>();
  let clearedFiles = 0;
  let skippedFiles = 0;
  let failedFiles = 0;

  for (const [index, entry] of entries.entries()) {
    const localUri = resolveLocalAssetUri(entry);
    if (!localUri || !shouldManageUri(localUri) || deletedUris.has(localUri)) {
      skippedFiles += 1;
      options.onProgress?.({
        completed: index + 1,
        total: entries.length,
        fileName: entry.fileName,
      });
      continue;
    }

    try {
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        skippedFiles += 1;
      } else {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
        clearedFiles += 1;
        deletedUris.add(localUri);
      }
    } catch (error) {
      failedFiles += 1;
      console.warn('Failed to clear cached audio file', entry.fileName, error);
    }

    options.onProgress?.({
      completed: index + 1,
      total: entries.length,
      fileName: entry.fileName,
    });
  }

  const previousMeta = await loadEguchiAudioCacheMeta(storageService);
  const nextMeta: EguchiAudioCacheMeta = {
    ...previousMeta,
    packName: AUDIO_PACK_NAME,
    totalFiles: entries.length,
    cachedFiles: 0,
    cachedBytes: 0,
    lastClearedAt: new Date().toISOString(),
  };
  await saveEguchiAudioCacheMeta(nextMeta, storageService);

  return {
    totalFiles: entries.length,
    clearedFiles,
    skippedFiles,
    failedFiles,
  };
};
