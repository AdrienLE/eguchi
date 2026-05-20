import { Asset } from 'expo-asset';
import type { AudioEntry } from './audio-pack';

export type AudioPlaybackSource = {
  uri: string;
};

export type ResolvedAudioPlaybackSource = {
  source: AudioPlaybackSource;
  assetUri: string | null;
  localUri: string | null;
  downloaded: boolean;
};

type AudioAssetUriInput = {
  localUri?: string | null;
  uri?: string | null;
};

const hasUsableUri = (uri: string | null | undefined): uri is string =>
  typeof uri === 'string' && uri.trim().length > 0;

export const pickPlayableAudioUri = (asset: AudioAssetUriInput): string | null => {
  if (hasUsableUri(asset.localUri)) {
    return asset.localUri;
  }
  if (hasUsableUri(asset.uri)) {
    return asset.uri;
  }
  return null;
};

export const resolveAudioPlaybackSource = async (
  entry: AudioEntry
): Promise<ResolvedAudioPlaybackSource> => {
  const asset = Asset.fromModule(entry.module);
  const downloadedAsset = await asset.downloadAsync();
  const playableUri = pickPlayableAudioUri(downloadedAsset);

  if (!playableUri) {
    throw new Error(`Audio asset did not resolve to a playable URI: ${entry.fileName}`);
  }

  return {
    source: { uri: playableUri },
    assetUri: pickPlayableAudioUri({ uri: downloadedAsset.uri }),
    localUri: pickPlayableAudioUri({ localUri: downloadedAsset.localUri }),
    downloaded: downloadedAsset.downloaded,
  };
};
