import type { ApiResponse } from '@/lib/api';
import type { EguchiAudioPackMetadata } from '@/lib/eguchi/audio-pack-version';

jest.mock('@/lib/eguchi/audio-pack', () => ({
  AUDIO_PACK_NAME: 'eguchi-pack-test',
  AUDIO_PACK_HASH_ALGORITHM: 'sha256',
  AUDIO_PACK_HASH: 'abc123',
  AUDIO_PACK_FILES_BY_CHORD: {
    'C-E-G': [
      { module: 1, fileName: 'C-E-G__01.mp3' },
      { module: 2, fileName: 'C-E-G__02.mp3' },
    ],
    'F-A-C': [{ module: 3, fileName: 'F-A-C__01.mp3' }],
  },
}));

import {
  checkEguchiAudioPackVersion,
  compareAudioPackMetadata,
  getLocalAudioPackMetadata,
} from '@/lib/eguchi/audio-pack-version';

const makeApiClient = (
  response: ApiResponse<EguchiAudioPackMetadata>
): { get<T>(endpoint: string): Promise<ApiResponse<T>>; getCalls: string[] } => {
  const getCalls: string[] = [];
  return {
    getCalls,
    get: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
      getCalls.push(endpoint);
      return response as ApiResponse<T>;
    },
  };
};

describe('eguchi audio pack version checks', () => {
  test('builds local metadata from bundled audio constants', () => {
    expect(getLocalAudioPackMetadata()).toEqual({
      packName: 'eguchi-pack-test',
      hash: 'abc123',
      hashAlgorithm: 'sha256',
      fileCount: 3,
      format: 'mp3',
    });
  });

  test('compares matching metadata as current', () => {
    const local = getLocalAudioPackMetadata();

    expect(compareAudioPackMetadata(local, { ...local })).toBe(true);
  });

  test('treats hash mismatches as an available update', () => {
    const local = getLocalAudioPackMetadata();

    expect(compareAudioPackMetadata(local, { ...local, hash: 'different' })).toBe(false);
  });

  test('checks server metadata through the api client', async () => {
    const local = getLocalAudioPackMetadata();
    const apiClient = makeApiClient({ status: 200, data: local });

    await expect(checkEguchiAudioPackVersion(apiClient)).resolves.toEqual({
      checked: true,
      isCurrent: true,
      local,
      remote: local,
      error: null,
    });
    expect(apiClient.getCalls).toEqual(['/api/eguchi/audio-pack']);
  });

  test('reports unavailable server metadata without marking current', async () => {
    const apiClient = makeApiClient({ status: 0, error: 'Network error' });

    const result = await checkEguchiAudioPackVersion(apiClient);

    expect(result.checked).toBe(true);
    expect(result.isCurrent).toBe(false);
    expect(result.remote).toBeNull();
    expect(result.error).toBe('Network error');
  });
});
