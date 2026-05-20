export type PlaybackOrigin = 'new-trial' | 'answer-feedback' | 'replay' | 'retry';

export const INITIAL_AUDIO_RETRY_DELAY_MS = 180;
export const INITIAL_AUDIO_RETRY_BACKOFF_MS = 120;
export const STANDARD_PLAYBACK_RETRY_LIMIT = 1;
export const STARTUP_PLAYBACK_RETRY_LIMIT = 6;
export const STARTUP_PLAYBACK_WATCHDOG_DELAY_MS = 900;

export const getPlaybackRetryLimit = (
  origin: PlaybackOrigin,
  hasPlayedAudioAtLeastOnce: boolean
) => {
  if (!hasPlayedAudioAtLeastOnce && (origin === 'new-trial' || origin === 'retry')) {
    return STARTUP_PLAYBACK_RETRY_LIMIT;
  }
  return STANDARD_PLAYBACK_RETRY_LIMIT;
};

export const getPlaybackRetryDelayMs = (retryCount: number) =>
  INITIAL_AUDIO_RETRY_DELAY_MS +
  Math.max(0, Math.round(retryCount)) * INITIAL_AUDIO_RETRY_BACKOFF_MS;

export type PlaybackStatusLike = {
  isLoaded: boolean;
  didJustFinish?: boolean;
  isPlaying?: boolean;
};

export const didPlaybackStart = (status: PlaybackStatusLike | null | undefined) =>
  Boolean(status?.isLoaded && (status.isPlaying || status.didJustFinish));
