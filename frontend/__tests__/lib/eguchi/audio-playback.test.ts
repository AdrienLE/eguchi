import {
  didPlaybackStart,
  getPlaybackRetryDelayMs,
  getPlaybackRetryLimit,
  INITIAL_AUDIO_RETRY_BACKOFF_MS,
  INITIAL_AUDIO_RETRY_DELAY_MS,
  NEW_TRIAL_PLAYBACK_RETRY_LIMIT,
  STANDARD_PLAYBACK_RETRY_LIMIT,
  STARTUP_PLAYBACK_RETRY_LIMIT,
  STARTUP_PLAYBACK_WATCHDOG_DELAY_MS,
} from '@/lib/eguchi/audio-playback';

describe('eguchi audio playback policy', () => {
  test('uses startup retry limit for first-trial playback', () => {
    expect(getPlaybackRetryLimit('new-trial', false)).toBe(STARTUP_PLAYBACK_RETRY_LIMIT);
  });

  test('uses startup retry limit for startup retry origin', () => {
    expect(getPlaybackRetryLimit('retry', false)).toBe(STARTUP_PLAYBACK_RETRY_LIMIT);
  });

  test('uses standard retry limit for answer feedback even before first success', () => {
    expect(getPlaybackRetryLimit('answer-feedback', false)).toBe(STANDARD_PLAYBACK_RETRY_LIMIT);
  });

  test('uses standard retry limit for replay even before first success', () => {
    expect(getPlaybackRetryLimit('replay', false)).toBe(STANDARD_PLAYBACK_RETRY_LIMIT);
  });

  test('keeps new-trial playback resilient after playback has succeeded once', () => {
    expect(getPlaybackRetryLimit('new-trial', true)).toBe(NEW_TRIAL_PLAYBACK_RETRY_LIMIT);
  });

  test('uses standard retry limit for retry origin after playback has succeeded once', () => {
    expect(getPlaybackRetryLimit('retry', true)).toBe(STANDARD_PLAYBACK_RETRY_LIMIT);
  });

  test('retry delay starts at base delay', () => {
    expect(getPlaybackRetryDelayMs(0)).toBe(INITIAL_AUDIO_RETRY_DELAY_MS);
  });

  test('retry delay increases by backoff per attempt', () => {
    expect(getPlaybackRetryDelayMs(1)).toBe(
      INITIAL_AUDIO_RETRY_DELAY_MS + INITIAL_AUDIO_RETRY_BACKOFF_MS
    );
    expect(getPlaybackRetryDelayMs(2)).toBe(
      INITIAL_AUDIO_RETRY_DELAY_MS + INITIAL_AUDIO_RETRY_BACKOFF_MS * 2
    );
  });

  test('negative retry count clamps to base delay', () => {
    expect(getPlaybackRetryDelayMs(-5)).toBe(INITIAL_AUDIO_RETRY_DELAY_MS);
  });

  test('retry count is rounded before delay calculation', () => {
    expect(getPlaybackRetryDelayMs(1.4)).toBe(
      INITIAL_AUDIO_RETRY_DELAY_MS + INITIAL_AUDIO_RETRY_BACKOFF_MS
    );
    expect(getPlaybackRetryDelayMs(1.6)).toBe(
      INITIAL_AUDIO_RETRY_DELAY_MS + INITIAL_AUDIO_RETRY_BACKOFF_MS * 2
    );
  });

  test('watchdog delay is positive and shorter than many retry cycles', () => {
    expect(STARTUP_PLAYBACK_WATCHDOG_DELAY_MS > 0).toBe(true);
    expect(
      STARTUP_PLAYBACK_WATCHDOG_DELAY_MS <
        INITIAL_AUDIO_RETRY_DELAY_MS + INITIAL_AUDIO_RETRY_BACKOFF_MS * 10
    ).toBe(true);
  });

  test('retry delays are monotonic for first several attempts', () => {
    const firstEight = Array.from({ length: 8 }, (_, index) => getPlaybackRetryDelayMs(index));
    expect(firstEight).toEqual([...firstEight].sort((a, b) => a - b));
  });

  test('playback is only accepted after the native player reports playing', () => {
    expect(didPlaybackStart({ isLoaded: true, isPlaying: true })).toBe(true);
    expect(didPlaybackStart({ isLoaded: true, didJustFinish: true })).toBe(true);
    expect(didPlaybackStart({ isLoaded: true, isPlaying: false })).toBe(false);
    expect(didPlaybackStart({ isLoaded: false })).toBe(false);
    expect(didPlaybackStart(null)).toBe(false);
  });
});
