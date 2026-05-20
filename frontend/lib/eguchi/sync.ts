import { api, type ApiClient } from '@/lib/api';
import { storage, STORAGE_KEYS, type StorageService } from '@/lib/storage';
import { AUDIO_PACK_HASH, AUDIO_PACK_NAME } from './audio-pack';
import { isValidChordId, type EguchiChordId } from './chords';
import {
  loadEguchiProgress,
  normalizeUnlockedChordIds,
  rebuildProgressWithTrialHistory,
  type EguchiProgress,
  type EguchiTrialRecord,
} from './progress';
import { loadEguchiSessionPreferences, type EguchiSessionPreferences } from './session-preferences';

export type EguchiProgressSyncState = {
  unlockedChordIds: EguchiChordId[];
  lastAutoUnlockDayKey: string | null;
  resetAt: string | null;
};

export type SyncedValue<T> = {
  updatedAt: string;
  data: T;
};

export type EguchiSyncMeta = {
  clientId: string;
  lastSyncAttemptAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  lastServerEventCursor: string | null;
  progressUpdatedAt: string | null;
  progressResetAt: string | null;
  preferencesUpdatedAt: string | null;
};

export type EguchiSyncQueue = {
  trialEvents: EguchiTrialRecord[];
};

export type EguchiTrialEventPayload = EguchiTrialRecord & {
  clientId: string;
  audioPackName: string;
  audioPackHash: string;
};

export type EguchiSyncRequest = {
  clientId: string;
  lastServerEventCursor: string | null;
  trialEvents: EguchiTrialEventPayload[];
  progressState: SyncedValue<EguchiProgressSyncState> | null;
  sessionPreferences: SyncedValue<EguchiSessionPreferences> | null;
};

export type EguchiSyncResponse = {
  acceptedEventIds: string[];
  trialEvents: EguchiTrialEventPayload[];
  serverEventCursor: string | null;
  progressState: SyncedValue<EguchiProgressSyncState> | null;
  sessionPreferences: SyncedValue<EguchiSessionPreferences> | null;
  syncedAt: string;
};

export type EguchiSyncResult = {
  ok: boolean;
  skipped: boolean;
  error: string | null;
  syncedAt: string | null;
  uploadedEventCount: number;
  downloadedEventCount: number;
};

type SyncApiClient = Pick<ApiClient, 'post'>;

const createRandomIdPart = () => {
  const cryptoObject = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoObject?.randomUUID === 'function') {
    return cryptoObject.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const createClientId = () => `client_${createRandomIdPart()}`;

const isValidIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }
  return !Number.isNaN(new Date(value).getTime());
};

const compareIsoTimestamps = (left: string | null, right: string | null) => {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return leftTime - rightTime;
};

export const createDefaultEguchiSyncMeta = (): EguchiSyncMeta => ({
  clientId: createClientId(),
  lastSyncAttemptAt: null,
  lastSyncedAt: null,
  lastSyncError: null,
  lastServerEventCursor: null,
  progressUpdatedAt: null,
  progressResetAt: null,
  preferencesUpdatedAt: null,
});

const sanitizeSyncMeta = (stored: Partial<EguchiSyncMeta> | null): EguchiSyncMeta => ({
  clientId:
    typeof stored?.clientId === 'string' && stored.clientId ? stored.clientId : createClientId(),
  lastSyncAttemptAt: isValidIsoTimestamp(stored?.lastSyncAttemptAt)
    ? stored.lastSyncAttemptAt
    : null,
  lastSyncedAt: isValidIsoTimestamp(stored?.lastSyncedAt) ? stored.lastSyncedAt : null,
  lastSyncError: typeof stored?.lastSyncError === 'string' ? stored.lastSyncError : null,
  lastServerEventCursor: isValidIsoTimestamp(stored?.lastServerEventCursor)
    ? stored.lastServerEventCursor
    : null,
  progressUpdatedAt: isValidIsoTimestamp(stored?.progressUpdatedAt)
    ? stored.progressUpdatedAt
    : null,
  progressResetAt: isValidIsoTimestamp(stored?.progressResetAt) ? stored.progressResetAt : null,
  preferencesUpdatedAt: isValidIsoTimestamp(stored?.preferencesUpdatedAt)
    ? stored.preferencesUpdatedAt
    : null,
});

const sanitizeTrialEvent = (candidate: unknown): EguchiTrialRecord | null => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const maybeTrial = candidate as Partial<EguchiTrialRecord>;
  if (typeof maybeTrial.id !== 'string' || !maybeTrial.id.trim()) {
    return null;
  }
  if (typeof maybeTrial.chordId !== 'string' || !isValidChordId(maybeTrial.chordId)) {
    return null;
  }
  if (typeof maybeTrial.correct !== 'boolean') {
    return null;
  }
  if (!isValidIsoTimestamp(maybeTrial.timestamp)) {
    return null;
  }
  return {
    id: maybeTrial.id.trim(),
    chordId: maybeTrial.chordId,
    correct: maybeTrial.correct,
    timestamp: new Date(maybeTrial.timestamp).toISOString(),
  };
};

const sanitizeSyncQueue = (stored: Partial<EguchiSyncQueue> | null): EguchiSyncQueue => {
  const byId = new Map<string, EguchiTrialRecord>();
  const candidates = Array.isArray(stored?.trialEvents) ? stored.trialEvents : [];
  for (const candidate of candidates) {
    const trial = sanitizeTrialEvent(candidate);
    if (trial && !byId.has(trial.id)) {
      byId.set(trial.id, trial);
    }
  }
  return { trialEvents: [...byId.values()] };
};

export const loadEguchiSyncMeta = async (
  storageService: StorageService = storage
): Promise<EguchiSyncMeta> => {
  const stored = await storageService.get<Partial<EguchiSyncMeta>>(STORAGE_KEYS.EGUCHI_SYNC_META);
  const meta = sanitizeSyncMeta(stored);
  if (!stored?.clientId) {
    await storageService.set(STORAGE_KEYS.EGUCHI_SYNC_META, meta);
  }
  return meta;
};

export const saveEguchiSyncMeta = async (
  meta: EguchiSyncMeta,
  storageService: StorageService = storage
) => {
  await storageService.set(STORAGE_KEYS.EGUCHI_SYNC_META, meta);
};

export const loadEguchiSyncQueue = async (
  storageService: StorageService = storage
): Promise<EguchiSyncQueue> => {
  const stored = await storageService.get<Partial<EguchiSyncQueue>>(STORAGE_KEYS.EGUCHI_SYNC_QUEUE);
  return sanitizeSyncQueue(stored);
};

export const saveEguchiSyncQueue = async (
  queue: EguchiSyncQueue,
  storageService: StorageService = storage
) => {
  await storageService.set(STORAGE_KEYS.EGUCHI_SYNC_QUEUE, sanitizeSyncQueue(queue));
};

export const queueEguchiTrialEvent = async (
  trial: EguchiTrialRecord,
  storageService: StorageService = storage
) => {
  const queue = await loadEguchiSyncQueue(storageService);
  if (!queue.trialEvents.some(item => item.id === trial.id)) {
    await saveEguchiSyncQueue({ trialEvents: [...queue.trialEvents, trial] }, storageService);
  }
};

const markDirty = async (
  field: 'progressUpdatedAt' | 'preferencesUpdatedAt',
  storageService: StorageService = storage,
  updatedAt: string = new Date().toISOString()
) => {
  const meta = await loadEguchiSyncMeta(storageService);
  await saveEguchiSyncMeta({ ...meta, [field]: updatedAt }, storageService);
  return updatedAt;
};

export const markEguchiProgressDirty = async (
  storageService: StorageService = storage,
  updatedAt?: string
) => markDirty('progressUpdatedAt', storageService, updatedAt);

export const markEguchiSessionPreferencesDirty = async (
  storageService: StorageService = storage,
  updatedAt?: string
) => markDirty('preferencesUpdatedAt', storageService, updatedAt);

export const markEguchiProgressReset = async (
  storageService: StorageService = storage,
  resetAt: string = new Date().toISOString()
) => {
  const meta = await loadEguchiSyncMeta(storageService);
  await saveEguchiSyncQueue({ trialEvents: [] }, storageService);
  await saveEguchiSyncMeta(
    {
      ...meta,
      progressUpdatedAt: resetAt,
      progressResetAt: resetAt,
    },
    storageService
  );
  return resetAt;
};

const toProgressSyncState = (
  progress: EguchiProgress,
  meta: EguchiSyncMeta
): EguchiProgressSyncState => ({
  unlockedChordIds: [...progress.unlockedChordIds],
  lastAutoUnlockDayKey: progress.lastAutoUnlockDayKey,
  resetAt: meta.progressResetAt,
});

const toTrialPayload = (trial: EguchiTrialRecord, clientId: string): EguchiTrialEventPayload => ({
  ...trial,
  clientId,
  audioPackName: AUDIO_PACK_NAME,
  audioPackHash: AUDIO_PACK_HASH,
});

const applyRemoteProgressState = (
  progress: EguchiProgress,
  remote: SyncedValue<EguchiProgressSyncState>
): EguchiProgress => ({
  ...progress,
  unlockedChordIds: normalizeUnlockedChordIds(remote.data.unlockedChordIds),
  lastAutoUnlockDayKey:
    typeof remote.data.lastAutoUnlockDayKey === 'string' ? remote.data.lastAutoUnlockDayKey : null,
});

const isAfterReset = (trial: EguchiTrialRecord, resetAt: string | null) =>
  !resetAt || compareIsoTimestamps(trial.timestamp, resetAt) > 0;

const makeSkippedResult = (error: string | null): EguchiSyncResult => ({
  ok: false,
  skipped: true,
  error,
  syncedAt: null,
  uploadedEventCount: 0,
  downloadedEventCount: 0,
});

export const syncEguchiState = async ({
  token,
  apiClient = api,
  storageService = storage,
}: {
  token: string | null;
  apiClient?: SyncApiClient;
  storageService?: StorageService;
}): Promise<EguchiSyncResult> => {
  if (!token) {
    return makeSkippedResult('No auth token available.');
  }

  const [meta, queue, progress, sessionPreferences] = await Promise.all([
    loadEguchiSyncMeta(storageService),
    loadEguchiSyncQueue(storageService),
    loadEguchiProgress(storageService),
    loadEguchiSessionPreferences(storageService),
  ]);
  const attemptedAt = new Date().toISOString();
  const activeQueuedTrials = queue.trialEvents.filter(trial =>
    isAfterReset(trial, meta.progressResetAt)
  );
  const trialEvents = activeQueuedTrials.map(trial => toTrialPayload(trial, meta.clientId));
  const payload: EguchiSyncRequest = {
    clientId: meta.clientId,
    lastServerEventCursor: meta.lastServerEventCursor,
    trialEvents,
    progressState: meta.progressUpdatedAt
      ? {
          updatedAt: meta.progressUpdatedAt,
          data: toProgressSyncState(progress, meta),
        }
      : null,
    sessionPreferences: meta.preferencesUpdatedAt
      ? {
          updatedAt: meta.preferencesUpdatedAt,
          data: sessionPreferences,
        }
      : null,
  };

  const response = await apiClient.post<EguchiSyncResponse>('/api/eguchi/sync', payload, token);
  if (response.error || !response.data) {
    const error = response.error ?? 'No sync response returned by server.';
    await saveEguchiSyncMeta(
      {
        ...meta,
        lastSyncAttemptAt: attemptedAt,
        lastSyncError: error,
      },
      storageService
    );
    return {
      ok: false,
      skipped: false,
      error,
      syncedAt: null,
      uploadedEventCount: 0,
      downloadedEventCount: 0,
    };
  }

  const acceptedEventIds = new Set(response.data.acceptedEventIds);
  const remoteResetAt =
    typeof response.data.progressState?.data.resetAt === 'string'
      ? response.data.progressState.data.resetAt
      : null;
  const effectiveResetAt =
    remoteResetAt && compareIsoTimestamps(remoteResetAt, meta.progressResetAt) > 0
      ? remoteResetAt
      : meta.progressResetAt;
  const remainingQueue = queue.trialEvents.filter(
    trial => !acceptedEventIds.has(trial.id) && isAfterReset(trial, effectiveResetAt)
  );
  const remoteTrials = response.data.trialEvents
    .map(candidate => sanitizeTrialEvent(candidate))
    .filter(
      (trial): trial is EguchiTrialRecord => trial !== null && isAfterReset(trial, effectiveResetAt)
    );

  let nextProgress = progress;
  const resetFilteredLocalHistory = nextProgress.trialHistory.filter(trial =>
    isAfterReset(trial, effectiveResetAt)
  );
  if (resetFilteredLocalHistory.length !== nextProgress.trialHistory.length) {
    nextProgress = rebuildProgressWithTrialHistory(nextProgress, resetFilteredLocalHistory);
  }
  if (remoteTrials.length) {
    nextProgress = rebuildProgressWithTrialHistory(nextProgress, [
      ...nextProgress.trialHistory,
      ...remoteTrials,
    ]);
  }

  const remoteProgress = response.data.progressState;
  const shouldApplyRemoteProgress =
    remoteProgress &&
    (!meta.progressUpdatedAt ||
      compareIsoTimestamps(remoteProgress.updatedAt, meta.progressUpdatedAt) > 0);
  if (shouldApplyRemoteProgress) {
    nextProgress = applyRemoteProgressState(nextProgress, remoteProgress);
  }

  const remotePreferences = response.data.sessionPreferences;
  const shouldApplyRemotePreferences =
    remotePreferences &&
    (!meta.preferencesUpdatedAt ||
      compareIsoTimestamps(remotePreferences.updatedAt, meta.preferencesUpdatedAt) > 0);

  await saveEguchiSyncQueue({ trialEvents: remainingQueue }, storageService);
  if (
    remoteTrials.length ||
    shouldApplyRemoteProgress ||
    resetFilteredLocalHistory.length !== progress.trialHistory.length
  ) {
    await storageService.set(STORAGE_KEYS.EGUCHI_PROGRESS, nextProgress);
  }
  if (shouldApplyRemotePreferences) {
    await storageService.set(STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES, remotePreferences.data);
  }

  const progressSynced =
    meta.progressUpdatedAt &&
    remoteProgress &&
    compareIsoTimestamps(remoteProgress.updatedAt, meta.progressUpdatedAt) >= 0;
  const preferencesSynced =
    meta.preferencesUpdatedAt &&
    remotePreferences &&
    compareIsoTimestamps(remotePreferences.updatedAt, meta.preferencesUpdatedAt) >= 0;

  await saveEguchiSyncMeta(
    {
      ...meta,
      lastSyncAttemptAt: attemptedAt,
      lastSyncedAt: response.data.syncedAt,
      lastSyncError: null,
      lastServerEventCursor: response.data.serverEventCursor,
      progressUpdatedAt: progressSynced ? null : meta.progressUpdatedAt,
      progressResetAt: effectiveResetAt,
      preferencesUpdatedAt: preferencesSynced ? null : meta.preferencesUpdatedAt,
    },
    storageService
  );

  return {
    ok: true,
    skipped: false,
    error: null,
    syncedAt: response.data.syncedAt,
    uploadedEventCount: acceptedEventIds.size,
    downloadedEventCount: remoteTrials.length,
  };
};

export const syncEguchiStateBestEffort = async (token: string | null) => {
  try {
    return await syncEguchiState({ token });
  } catch (error) {
    console.warn('Eguchi sync failed', error);
    return makeSkippedResult(error instanceof Error ? error.message : 'Eguchi sync failed.');
  }
};
