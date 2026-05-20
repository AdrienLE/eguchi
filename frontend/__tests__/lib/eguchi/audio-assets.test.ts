import { pickPlayableAudioUri, resolveAudioPlaybackSource } from '@/lib/eguchi/audio-assets';
import type { AudioEntry } from '@/lib/eguchi/audio-pack';

type MockAsset = {
  uri: string | null;
  localUri: string | null;
  downloaded: boolean;
  downloadCalls: number;
  downloadAsync: () => Promise<MockAsset>;
};

const mockAssets = new Map<number, MockAsset>();

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: (moduleId: number) => {
      const asset = mockAssets.get(moduleId);
      if (!asset) {
        throw new Error(`Unknown module ${moduleId}`);
      }
      return asset;
    },
  },
}));

describe('eguchi audio asset resolution', () => {
  beforeEach(() => {
    mockAssets.clear();
  });

  test('prefers downloaded local URIs for playback', () => {
    expect(
      pickPlayableAudioUri({
        localUri: 'file:///cached/chord.mp3',
        uri: 'https://server/chord.mp3',
      })
    ).toBe('file:///cached/chord.mp3');
  });

  test('falls back to served asset URI when no local URI exists', () => {
    expect(
      pickPlayableAudioUri({
        localUri: null,
        uri: 'https://server/chord.mp3',
      })
    ).toBe('https://server/chord.mp3');
  });

  test('rejects blank asset URIs', () => {
    expect(
      pickPlayableAudioUri({
        localUri: '   ',
        uri: '',
      })
    ).toBeNull();
  });

  test('downloads and returns a resolved playback source', async () => {
    const asset: MockAsset = {
      uri: 'https://server/C-E-G.mp3',
      localUri: null,
      downloaded: false,
      downloadCalls: 0,
      downloadAsync: async () => {
        asset.downloadCalls += 1;
        asset.localUri = 'file:///cached/C-E-G.mp3';
        asset.downloaded = true;
        return asset;
      },
    };
    mockAssets.set(42, asset);

    const entry: AudioEntry = {
      module: 42,
      fileName: 'C-E-G.mp3',
    };

    await expect(resolveAudioPlaybackSource(entry)).resolves.toEqual({
      source: { uri: 'file:///cached/C-E-G.mp3' },
      assetUri: 'https://server/C-E-G.mp3',
      localUri: 'file:///cached/C-E-G.mp3',
      downloaded: true,
    });
    expect(asset.downloadCalls).toBe(1);
  });

  test('throws when a downloaded asset has no playable URI', async () => {
    const asset: MockAsset = {
      uri: '',
      localUri: null,
      downloaded: true,
      downloadCalls: 0,
      downloadAsync: async () => {
        asset.downloadCalls += 1;
        return asset;
      },
    };
    mockAssets.set(43, asset);

    const entry: AudioEntry = {
      module: 43,
      fileName: 'F-A-C.mp3',
    };

    await expect(resolveAudioPlaybackSource(entry)).rejects.toThrow(
      'Audio asset did not resolve to a playable URI: F-A-C.mp3'
    );
  });
});
