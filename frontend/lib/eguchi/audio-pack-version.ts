import { api, type ApiClient } from '@/lib/api';
import {
  AUDIO_PACK_FILES_BY_CHORD,
  AUDIO_PACK_HASH,
  AUDIO_PACK_HASH_ALGORITHM,
  AUDIO_PACK_NAME,
} from './audio-pack';

export type EguchiAudioPackMetadata = {
  packName: string;
  hash: string;
  hashAlgorithm: string;
  fileCount: number;
  format?: string | null;
  generatedAt?: string | null;
};

export type EguchiAudioPackVersionCheck = {
  checked: boolean;
  isCurrent: boolean;
  local: EguchiAudioPackMetadata;
  remote: EguchiAudioPackMetadata | null;
  error: string | null;
};

type AudioPackMetadataApiClient = Pick<ApiClient, 'get'>;

export const getLocalAudioPackMetadata = (): EguchiAudioPackMetadata => ({
  packName: AUDIO_PACK_NAME,
  hash: AUDIO_PACK_HASH,
  hashAlgorithm: AUDIO_PACK_HASH_ALGORITHM,
  fileCount: Object.values(AUDIO_PACK_FILES_BY_CHORD).flat().length,
  format: 'mp3',
});

export const compareAudioPackMetadata = (
  local: EguchiAudioPackMetadata,
  remote: EguchiAudioPackMetadata
) =>
  local.packName === remote.packName &&
  local.hash === remote.hash &&
  local.hashAlgorithm === remote.hashAlgorithm &&
  local.fileCount === remote.fileCount;

export const checkEguchiAudioPackVersion = async (
  apiClient: AudioPackMetadataApiClient = api
): Promise<EguchiAudioPackVersionCheck> => {
  const local = getLocalAudioPackMetadata();
  const response = await apiClient.get<EguchiAudioPackMetadata>('/api/eguchi/audio-pack');

  if (response.error || !response.data) {
    return {
      checked: true,
      isCurrent: false,
      local,
      remote: null,
      error: response.error ?? 'No audio pack metadata returned by server.',
    };
  }

  return {
    checked: true,
    isCurrent: compareAudioPackMetadata(local, response.data),
    local,
    remote: response.data,
    error: null,
  };
};
