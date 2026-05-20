import { useFocusEffect } from '@react-navigation/native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { resolveAudioPlaybackSource } from '@/lib/eguchi/audio-assets';
import { pickRandomAudioEntry, type AudioEntry } from '@/lib/eguchi/audio-pack';
import { getChordAnimalImageSource, type AnimalEmotion } from '@/lib/eguchi/animal-assets';
import { CHORD_BY_ID, DEFAULT_UNLOCKED_CHORD_IDS, type EguchiChordId } from '@/lib/eguchi/chords';
import { getNextLevelProgress, maybeApplyAutoUnlock } from '@/lib/eguchi/progression';
import {
  createDefaultEguchiProgress,
  loadEguchiProgress,
  recordTrial,
  saveEguchiProgress,
  type EguchiProgress,
} from '@/lib/eguchi/progress';
import {
  AUTO_ADVANCE_TICK_MS,
  getAutoAdvanceDurationMs,
  getAutoAdvanceProgress,
  pickRandomChordId,
} from '@/lib/eguchi/training-loop';
import {
  didPlaybackStart,
  getPlaybackRetryDelayMs,
  getPlaybackRetryLimit,
  STARTUP_PLAYBACK_WATCHDOG_DELAY_MS,
  shouldReplayAfterPlaybackWatchdog,
  type PlaybackOrigin,
} from '@/lib/eguchi/audio-playback';
import {
  getAnimalImageRecyclingKey,
  getCountdownVisibleSegmentCount,
  getFeedbackAnimalEmotion,
} from '@/lib/eguchi/training-feedback';
import {
  createDefaultEguchiSessionPreferences,
  loadEguchiSessionPreferences,
  type EguchiSessionPreferences,
} from '@/lib/eguchi/session-preferences';

const CONTENT_HORIZONTAL_PADDING = 24;
const CONTENT_VERTICAL_PADDING = 20;
const GRID_GAP = 10;
const GRID_MIN_TILE_SIZE = 28;
const GRID_MAX_COLUMNS = 6;
const GRID_BASE_RESERVED_HEIGHT = 30;
const PLAYBACK_START_CONFIRMATION_TIMEOUT_MS = 650;
const FEEDBACK_TO_TRIAL_AUDIO_SETTLE_MS = 220;
const COUNTDOWN_RING_SIZE = 58;
const COUNTDOWN_RING_SEGMENT_COUNT = 40;
const COUNTDOWN_RING_SEGMENT_WIDTH = 3;
const COUNTDOWN_RING_SEGMENT_HEIGHT = 8;
const COUNTDOWN_RING_SEGMENT_RADIUS = 23;

type PlayCurrentAudioOptions = {
  chordId?: EguchiChordId | null;
  entry?: AudioEntry | null;
  origin?: PlaybackOrigin;
  retryCount?: number;
  retryLimit?: number;
};

type AnimalImageCandidate = {
  source: ReturnType<typeof getChordAnimalImageSource>;
  emotion: AnimalEmotion;
};

const getReadableTextColor = (hex: string) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '#111111';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111111' : '#FFFFFF';
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const clampProgress = (value: number) => Math.max(0, Math.min(1, value));
const getAnimalImageFailureKey = (chordId: EguchiChordId, emotion?: AnimalEmotion) =>
  `${chordId}__${emotion ?? 'default'}`;

const waitForSoundToStart = (sound: Audio.Sound) =>
  new Promise<boolean>(resolve => {
    let didResolve = false;
    const timeout = setTimeout(() => {
      if (didResolve) {
        return;
      }
      didResolve = true;
      sound.setOnPlaybackStatusUpdate(null);
      resolve(false);
    }, PLAYBACK_START_CONFIRMATION_TIMEOUT_MS);

    sound.setOnPlaybackStatusUpdate(status => {
      if (!didPlaybackStart(status) || didResolve) {
        return;
      }
      didResolve = true;
      clearTimeout(timeout);
      sound.setOnPlaybackStatusUpdate(null);
      resolve(true);
    });
  });

const wait = (durationMs: number) =>
  new Promise(resolve => {
    setTimeout(resolve, durationMs);
  });

const isAutoplayBlockedError = (error: unknown) => {
  if (!error) {
    return false;
  }
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
  return (
    message.includes('NotAllowedError') &&
    message.includes("didn't interact with the document first")
  );
};

const summarizeAudioUri = (uri: string | null) => {
  if (!uri) {
    return null;
  }
  const fileMarker = '/audio/';
  const fileIndex = uri.lastIndexOf(fileMarker);
  if (fileIndex >= 0) {
    return uri.slice(fileIndex + fileMarker.length);
  }
  if (uri.startsWith('file://')) {
    return 'file://...';
  }
  return uri.length > 96 ? `${uri.slice(0, 93)}...` : uri;
};

const getGridLayout = (tileCount: number, availableWidth: number, availableHeight: number) => {
  const safeCount = Math.max(1, tileCount);
  const safeWidth = Math.max(100, availableWidth);
  const safeHeight = Math.max(100, availableHeight);
  const minColumns = safeCount === 1 ? 1 : 2;
  const maxColumns = Math.min(GRID_MAX_COLUMNS, safeCount);

  let best = {
    columns: minColumns,
    tileSize: GRID_MIN_TILE_SIZE,
  };

  for (let columns = minColumns; columns <= maxColumns; columns += 1) {
    const rows = Math.ceil(safeCount / columns);
    const widthLimited = (safeWidth - GRID_GAP * (columns - 1)) / columns;
    const heightLimited = (safeHeight - GRID_GAP * (rows - 1)) / rows;
    const tileSize = Math.floor(Math.min(widthLimited, heightLimited));
    if (tileSize > best.tileSize) {
      best = { columns, tileSize };
    }
  }

  return {
    columns: best.columns,
    tileSize: Math.max(GRID_MIN_TILE_SIZE, best.tileSize),
  };
};

const ANIMAL_EMOJIS: Record<EguchiChordId, string> = {
  'C-E-G': '🦊',
  'F-A-C': '🐋',
  'G-B-D': '🐸',
  'E-G-C': '🐯',
  'A-C-F': '🐙',
  'B-D-G': '🐣',
  'G-C-E': '🐰',
  'C-F-A': '🐢',
  'D-G-B': '🐦',
  'A-C#-E': '🦁',
  'D-F#-A': '🦜',
  'E-G#-B': '🐠',
  'Bb-D-F': '🦭',
  'Eb-G-Bb': '🦀',
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [bottomSectionHeight, setBottomSectionHeight] = useState(0);
  const [progress, setProgress] = useState<EguchiProgress | null>(null);
  const [sessionPreferences, setSessionPreferences] = useState<EguchiSessionPreferences | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const defaultSessionPreferences = useRef(createDefaultEguchiSessionPreferences());
  const unlockedChordIds = progress?.unlockedChordIds.length
    ? progress.unlockedChordIds
    : DEFAULT_UNLOCKED_CHORD_IDS;
  const unlockedChords = unlockedChordIds.map(id => CHORD_BY_ID[id]);
  const unlockedChordKey = unlockedChordIds.join('|');
  const [feedbackChordId, setFeedbackChordId] = useState<EguchiChordId | null>(null);
  const [lastResult, setLastResult] = useState<'correct' | 'incorrect' | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTicker = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoAdvanceRemainingMs, setAutoAdvanceRemainingMs] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const activeSoundOriginRef = useRef<PlaybackOrigin | null>(null);
  const pendingPlaybackRequestRef = useRef<{
    id: number;
    origin: PlaybackOrigin;
  } | null>(null);
  const audioModePromiseRef = useRef<Promise<void> | null>(null);
  const [hasStartedTraining, setHasStartedTraining] = useState(false);
  const hasPlayedAnyAudioRef = useRef(false);
  const playbackRequestIdRef = useRef(0);
  const playbackRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupPlaybackWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [startupAutoplayPending, setStartupAutoplayPending] = useState(false);
  const currentChordRef = useRef<EguchiChordId | null>(null);
  const currentAudioRef = useRef<AudioEntry | null>(null);
  const unlockedChordIdsRef = useRef<EguchiChordId[]>(DEFAULT_UNLOCKED_CHORD_IDS);
  const hasInitializedTrialRef = useRef(false);
  const previousUnlockedChordKeyRef = useRef(unlockedChordKey);
  const hasAnsweredCurrentTrialRef = useRef(false);
  const [unlockAnnouncement, setUnlockAnnouncement] = useState<string | null>(null);
  const [failedAnimalImageKeys, setFailedAnimalImageKeys] = useState<Set<string>>(new Set());

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    if (advanceTicker.current) {
      clearInterval(advanceTicker.current);
      advanceTicker.current = null;
    }
    setAutoAdvanceRemainingMs(null);
  }, []);

  const stopSound = useCallback(async () => {
    if (soundRef.current) {
      const sound = soundRef.current;
      try {
        sound.setOnPlaybackStatusUpdate(null);
        await sound.stopAsync().catch(() => undefined);
        await sound.unloadAsync();
      } catch (error) {
        console.warn('Failed to unload audio', error);
      } finally {
        soundRef.current = null;
        activeSoundOriginRef.current = null;
      }
    }
  }, []);

  const clearPlaybackRetry = useCallback(() => {
    if (playbackRetryTimerRef.current) {
      clearTimeout(playbackRetryTimerRef.current);
      playbackRetryTimerRef.current = null;
    }
  }, []);

  const clearStartupPlaybackWatchdog = useCallback(() => {
    if (startupPlaybackWatchdogRef.current) {
      clearTimeout(startupPlaybackWatchdogRef.current);
      startupPlaybackWatchdogRef.current = null;
    }
  }, []);

  const ensureTrainingAudioMode = useCallback(() => {
    if (!audioModePromiseRef.current) {
      audioModePromiseRef.current = Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      }).catch(error => {
        audioModePromiseRef.current = null;
        throw error;
      });
    }
    return audioModePromiseRef.current;
  }, []);

  useEffect(() => {
    void ensureTrainingAudioMode().catch(error => {
      console.warn('Failed to configure Eguchi training audio mode', error);
    });
  }, [ensureTrainingAudioMode]);

  const loadTrainingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loadedProgress, loadedSessionPreferences] = await Promise.all([
        loadEguchiProgress(),
        loadEguchiSessionPreferences(),
      ]);
      setProgress(loadedProgress);
      setSessionPreferences(loadedSessionPreferences);
    } catch (error) {
      console.warn('Failed to load Eguchi training data', error);
      setProgress(createDefaultEguchiProgress());
      setSessionPreferences(createDefaultEguchiSessionPreferences());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTrainingData();
      return undefined;
    }, [loadTrainingData])
  );

  const playCurrentAudio = useCallback(
    async (options: PlayCurrentAudioOptions = {}) => {
      const chordId = options.chordId ?? currentChordRef.current;
      const entry = options.entry ?? currentAudioRef.current;
      const origin = options.origin ?? 'replay';
      const retryCount = options.retryCount ?? 0;
      const retryLimit =
        options.retryLimit ?? getPlaybackRetryLimit(origin, hasPlayedAnyAudioRef.current);
      const requestId = playbackRequestIdRef.current + 1;
      const previousPlaybackOrigin =
        activeSoundOriginRef.current ?? pendingPlaybackRequestRef.current?.origin ?? null;
      playbackRequestIdRef.current = requestId;
      pendingPlaybackRequestRef.current = { id: requestId, origin };
      clearPlaybackRetry();

      const clearPendingPlaybackRequest = () => {
        if (pendingPlaybackRequestRef.current?.id === requestId) {
          pendingPlaybackRequestRef.current = null;
        }
      };
      const isCurrentPlaybackRequest = () => playbackRequestIdRef.current === requestId;

      if (!chordId || !entry) {
        clearPendingPlaybackRequest();
        console.warn('No audio available for current chord', chordId);
        return;
      }

      try {
        await ensureTrainingAudioMode();
      } catch (error) {
        console.warn('Failed to configure Eguchi training audio mode', error);
      }

      if (soundRef.current) {
        await stopSound();
        if (!isCurrentPlaybackRequest()) {
          clearPendingPlaybackRequest();
          return;
        }
      }

      if (previousPlaybackOrigin === 'answer-feedback' && origin === 'new-trial') {
        await wait(FEEDBACK_TO_TRIAL_AUDIO_SETTLE_MS);
        if (!isCurrentPlaybackRequest()) {
          clearPendingPlaybackRequest();
          return;
        }
      }

      let createdSound: Audio.Sound | null = null;
      try {
        const resolvedAudio = await resolveAudioPlaybackSource(entry);
        if (!isCurrentPlaybackRequest()) {
          clearPendingPlaybackRequest();
          return;
        }

        console.log(
          '[Eguchi] Playing audio',
          JSON.stringify({
            chord: chordId,
            file: entry.fileName,
            origin,
            attempt: retryCount === 0 ? 'initial' : `retry-${retryCount}`,
            assetUri: summarizeAudioUri(resolvedAudio.assetUri),
            localUri: summarizeAudioUri(resolvedAudio.localUri),
            downloaded: resolvedAudio.downloaded,
          })
        );
        const { sound, status } = await Audio.Sound.createAsync(
          resolvedAudio.source,
          {
            shouldPlay: true,
            volume: 1.0,
            positionMillis: 0,
            progressUpdateIntervalMillis: 100,
          },
          null,
          false
        );
        let playbackStatus = status;
        createdSound = sound;
        if (!isCurrentPlaybackRequest()) {
          clearPendingPlaybackRequest();
          await sound.unloadAsync().catch(unloadError => {
            console.warn('Failed to unload stale sound instance', unloadError);
          });
          return;
        }
        soundRef.current = sound;
        activeSoundOriginRef.current = origin;
        clearPendingPlaybackRequest();
        let playbackStarted =
          didPlaybackStart(playbackStatus) || (await waitForSoundToStart(sound));
        if (!isCurrentPlaybackRequest()) {
          if (soundRef.current === sound) {
            soundRef.current = null;
            activeSoundOriginRef.current = null;
          }
          await sound.unloadAsync().catch(unloadError => {
            console.warn('Failed to unload stale sound instance', unloadError);
          });
          return;
        }
        if (shouldReplayAfterPlaybackWatchdog(playbackStarted, isCurrentPlaybackRequest())) {
          console.warn(
            'Audio did not report playback start; replaying once',
            JSON.stringify({
              chord: chordId,
              file: entry.fileName,
              origin,
            })
          );
          playbackStatus = await sound.replayAsync();
          playbackStarted = didPlaybackStart(playbackStatus) || (await waitForSoundToStart(sound));
        }
        if (!isCurrentPlaybackRequest()) {
          if (soundRef.current === sound) {
            soundRef.current = null;
            activeSoundOriginRef.current = null;
          }
          await sound.unloadAsync().catch(unloadError => {
            console.warn('Failed to unload stale sound instance', unloadError);
          });
          return;
        }
        if (!playbackStarted) {
          if (soundRef.current === sound) {
            soundRef.current = null;
            activeSoundOriginRef.current = null;
          }
          await sound.unloadAsync().catch(unloadError => {
            console.warn('Failed to unload silent sound instance', unloadError);
          });
          throw new Error(`Audio playback did not start for ${entry.fileName}`);
        }
        const confirmedPlaybackStatus = await sound.getStatusAsync();
        if (!isCurrentPlaybackRequest()) {
          if (soundRef.current === sound) {
            soundRef.current = null;
            activeSoundOriginRef.current = null;
          }
          await sound.unloadAsync().catch(unloadError => {
            console.warn('Failed to unload stale sound instance', unloadError);
          });
          return;
        }
        console.log(
          '[Eguchi] Audio playback started',
          JSON.stringify({
            chord: chordId,
            file: entry.fileName,
            origin,
            isPlaying: confirmedPlaybackStatus.isLoaded ? confirmedPlaybackStatus.isPlaying : false,
            positionMillis: confirmedPlaybackStatus.isLoaded
              ? confirmedPlaybackStatus.positionMillis
              : null,
            durationMillis: confirmedPlaybackStatus.isLoaded
              ? confirmedPlaybackStatus.durationMillis
              : null,
          })
        );
        hasPlayedAnyAudioRef.current = true;
        setStartupAutoplayPending(false);
        clearStartupPlaybackWatchdog();
      } catch (error) {
        clearPendingPlaybackRequest();
        if (createdSound && soundRef.current === createdSound) {
          soundRef.current = null;
          activeSoundOriginRef.current = null;
          await createdSound.unloadAsync().catch(unloadError => {
            console.warn('Failed to unload failed sound instance', unloadError);
          });
        }
        if (!isCurrentPlaybackRequest()) {
          return;
        }
        console.warn('Failed to play chord audio', error);
        if (isAutoplayBlockedError(error)) {
          setHasStartedTraining(false);
          setStartupAutoplayPending(true);
          return;
        }
        if (playbackRequestIdRef.current !== requestId || retryCount >= retryLimit) {
          return;
        }
        const nextRetryCount = retryCount + 1;
        const retryDelayMs = getPlaybackRetryDelayMs(retryCount);
        playbackRetryTimerRef.current = setTimeout(() => {
          playbackRetryTimerRef.current = null;
          if (playbackRequestIdRef.current !== requestId) {
            return;
          }
          void playCurrentAudio({
            chordId,
            entry,
            origin,
            retryCount: nextRetryCount,
            retryLimit,
          });
        }, retryDelayMs);
      }
    },
    [clearPlaybackRetry, clearStartupPlaybackWatchdog, ensureTrainingAudioMode, stopSound]
  );

  useEffect(() => {
    unlockedChordIdsRef.current = unlockedChordIds;
  }, [unlockedChordIds]);

  const startNewTrial = useCallback(() => {
    const activeUnlockedChordIds = unlockedChordIdsRef.current.length
      ? unlockedChordIdsRef.current
      : DEFAULT_UNLOCKED_CHORD_IDS;

    if (!activeUnlockedChordIds.length) {
      clearAdvanceTimer();
      clearStartupPlaybackWatchdog();
      currentChordRef.current = null;
      currentAudioRef.current = null;
      setStartupAutoplayPending(false);
      return;
    }

    clearAdvanceTimer();
    clearStartupPlaybackWatchdog();
    hasAnsweredCurrentTrialRef.current = false;
    setFeedbackChordId(null);
    setLastResult(null);

    const nextChordId = pickRandomChordId(activeUnlockedChordIds);
    currentChordRef.current = nextChordId;

    const nextAudio = pickRandomAudioEntry(nextChordId);
    if (!nextAudio) {
      console.warn('No audio file available for chord', nextChordId);
    }
    currentAudioRef.current = nextAudio;

    console.log('[Eguchi] New trial', {
      chord: nextChordId,
      animal: CHORD_BY_ID[nextChordId]?.animal,
      file: nextAudio?.fileName ?? 'missing',
    });

    if (!hasStartedTraining) {
      setStartupAutoplayPending(true);
      return;
    }

    if (!hasPlayedAnyAudioRef.current) {
      setStartupAutoplayPending(true);
      startupPlaybackWatchdogRef.current = setTimeout(() => {
        startupPlaybackWatchdogRef.current = null;
        if (hasPlayedAnyAudioRef.current || hasAnsweredCurrentTrialRef.current) {
          return;
        }
        if (!currentChordRef.current || !currentAudioRef.current) {
          return;
        }
        void playCurrentAudio({
          chordId: currentChordRef.current,
          entry: currentAudioRef.current,
          origin: 'retry',
          retryCount: 0,
        });
      }, STARTUP_PLAYBACK_WATCHDOG_DELAY_MS);
    }

    void playCurrentAudio({
      chordId: nextChordId,
      entry: nextAudio,
      origin: 'new-trial',
    });
  }, [clearAdvanceTimer, clearStartupPlaybackWatchdog, hasStartedTraining, playCurrentAudio]);

  const handleAnswer = useCallback(
    (id: EguchiChordId) => {
      if (!hasStartedTraining || hasAnsweredCurrentTrialRef.current || isLoading) {
        return;
      }

      const expectedId = currentChordRef.current;
      if (!expectedId) return;
      const expectedAudio = currentAudioRef.current;

      hasAnsweredCurrentTrialRef.current = true;
      clearStartupPlaybackWatchdog();
      clearPlaybackRetry();
      playbackRequestIdRef.current += 1;

      const selectedChord = CHORD_BY_ID[id];
      const expectedChord = CHORD_BY_ID[expectedId];
      const isCorrect = id === expectedId;
      const activeSessionPreferences = sessionPreferences ?? defaultSessionPreferences.current;
      const autoAdvanceDurationMs = getAutoAdvanceDurationMs(
        activeSessionPreferences.feedbackSeconds
      );

      setFeedbackChordId(expectedId);
      setLastResult(isCorrect ? 'correct' : 'incorrect');
      setUnlockAnnouncement(null);
      setProgress(previous => {
        const currentProgress = previous ?? createDefaultEguchiProgress();
        const afterRecord = recordTrial(currentProgress, {
          chordId: expectedId,
          correct: isCorrect,
        });
        const autoUnlockResult = maybeApplyAutoUnlock(afterRecord, {
          autoUnlockEnabled: activeSessionPreferences.autoUnlockEnabled,
          perfectDaysRequired: activeSessionPreferences.perfectDaysRequired,
          dailyAttemptTarget: activeSessionPreferences.dailyAttemptTarget,
        });

        if (autoUnlockResult.unlocked) {
          const unlockedChordId =
            autoUnlockResult.progress.unlockedChordIds[
              autoUnlockResult.progress.unlockedChordIds.length - 1
            ];
          const unlockedAnimal = unlockedChordId ? CHORD_BY_ID[unlockedChordId]?.animal : null;
          setUnlockAnnouncement(
            unlockedAnimal ? `New friend unlocked: ${unlockedAnimal}.` : 'New friend unlocked.'
          );
          console.log('[Eguchi] Auto-unlocked next level', {
            unlockedCount: autoUnlockResult.progress.unlockedChordIds.length,
            unlockDay: autoUnlockResult.progress.lastAutoUnlockDayKey,
          });
        }

        void saveEguchiProgress(autoUnlockResult.progress).catch(error => {
          console.warn('Failed to save Eguchi progress', error);
        });
        return autoUnlockResult.progress;
      });

      console.log('[Eguchi] Answer selected', {
        selected: id,
        selectedAnimal: selectedChord?.animal,
        expected: expectedId,
        expectedAnimal: expectedChord?.animal,
        correct: isCorrect,
      });
      void playCurrentAudio({
        chordId: expectedId,
        entry: expectedAudio,
        origin: 'answer-feedback',
      });

      clearAdvanceTimer();
      const countdownStartedAt = Date.now();
      setAutoAdvanceRemainingMs(autoAdvanceDurationMs);
      advanceTicker.current = setInterval(() => {
        const elapsed = Date.now() - countdownStartedAt;
        const remaining = Math.max(0, autoAdvanceDurationMs - elapsed);
        setAutoAdvanceRemainingMs(remaining);
      }, AUTO_ADVANCE_TICK_MS);
      advanceTimer.current = setTimeout(() => {
        clearAdvanceTimer();
        startNewTrial();
      }, autoAdvanceDurationMs);
    },
    [
      clearAdvanceTimer,
      clearPlaybackRetry,
      hasStartedTraining,
      isLoading,
      playCurrentAudio,
      sessionPreferences,
      startNewTrial,
    ]
  );

  const handleStartTraining = useCallback(() => {
    setHasStartedTraining(true);
    setStartupAutoplayPending(false);
    if (!currentChordRef.current || !currentAudioRef.current) {
      startNewTrial();
      return;
    }
    void playCurrentAudio({
      chordId: currentChordRef.current,
      entry: currentAudioRef.current,
      origin: 'retry',
      retryCount: 0,
    });
  }, [playCurrentAudio, startNewTrial]);

  const handleReplay = useCallback(() => {
    if (!hasStartedTraining) {
      handleStartTraining();
      return;
    }
    if (!currentChordRef.current || !currentAudioRef.current) {
      startNewTrial();
      return;
    }
    void playCurrentAudio({ origin: 'replay' });
  }, [handleStartTraining, hasStartedTraining, playCurrentAudio, startNewTrial]);

  const markAnimalImageFailed = useCallback((id: EguchiChordId, emotion?: AnimalEmotion) => {
    const failureKey = getAnimalImageFailureKey(id, emotion);
    setFailedAnimalImageKeys(previous => {
      if (previous.has(failureKey)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(failureKey);
      return next;
    });
  }, []);

  const isReady = !isLoading && progress !== null && sessionPreferences !== null;

  useEffect(() => {
    return () => {
      clearAdvanceTimer();
      clearPlaybackRetry();
      clearStartupPlaybackWatchdog();
      setStartupAutoplayPending(false);
      playbackRequestIdRef.current += 1;
      pendingPlaybackRequestRef.current = null;
      void stopSound();
    };
  }, [clearAdvanceTimer, clearPlaybackRetry, clearStartupPlaybackWatchdog, stopSound]);

  useEffect(() => {
    if (!isReady) {
      hasInitializedTrialRef.current = false;
      previousUnlockedChordKeyRef.current = unlockedChordKey;
      return;
    }

    if (hasInitializedTrialRef.current) {
      return;
    }

    hasInitializedTrialRef.current = true;
    previousUnlockedChordKeyRef.current = unlockedChordKey;
    startNewTrial();
  }, [isReady, startNewTrial, unlockedChordKey]);

  useEffect(() => {
    if (!isReady) {
      previousUnlockedChordKeyRef.current = unlockedChordKey;
      return;
    }

    if (!hasInitializedTrialRef.current) {
      previousUnlockedChordKeyRef.current = unlockedChordKey;
      return;
    }

    if (previousUnlockedChordKeyRef.current === unlockedChordKey) {
      return;
    }

    previousUnlockedChordKeyRef.current = unlockedChordKey;
    if (lastResult !== null || autoAdvanceRemainingMs !== null) {
      return;
    }

    startNewTrial();
  }, [autoAdvanceRemainingMs, isReady, lastResult, startNewTrial, unlockedChordKey]);

  const progressionStatus = useMemo(() => {
    if (!progress) {
      return null;
    }
    const activeSessionPreferences = sessionPreferences ?? defaultSessionPreferences.current;
    return getNextLevelProgress(progress, {
      autoUnlockEnabled: activeSessionPreferences.autoUnlockEnabled,
      perfectDaysRequired: activeSessionPreferences.perfectDaysRequired,
      dailyAttemptTarget: activeSessionPreferences.dailyAttemptTarget,
    });
  }, [progress, sessionPreferences]);
  const isDarkMode = colorScheme === 'dark';
  const buttonBackground = Colors[colorScheme ?? 'light'].tint;
  const startCardBackground = isDarkMode ? '#242628' : '#FFFFFF';
  const startCardBorderColor = isDarkMode ? '#3E4448' : '#D0D0D0';
  const startTitleColor = Colors[colorScheme ?? 'light'].text;
  const startSubtitleColor = isDarkMode ? '#C9CED3' : '#4B5560';
  const startBadgeTextColor = isDarkMode ? '#111111' : '#FFFFFF';
  const autoAdvanceMs = getAutoAdvanceDurationMs(
    (sessionPreferences ?? defaultSessionPreferences.current).feedbackSeconds
  );
  const missionProgress = progressionStatus
    ? clampProgress(
        progressionStatus.todaySummary.attempts / Math.max(1, progressionStatus.dailyAttemptTarget)
      )
    : 0;
  const successProgress = progressionStatus
    ? clampProgress(
        progressionStatus.todaySummary.correct /
          Math.max(1, progressionStatus.todaySummary.attempts)
      )
    : 0;
  const streakProgress = progressionStatus
    ? progressionStatus.isMaxLevel
      ? 1
      : clampProgress(
          progressionStatus.perfectDayStreak / Math.max(1, progressionStatus.perfectDaysRequired)
        )
    : 0;
  const feedbackChord = feedbackChordId ? CHORD_BY_ID[feedbackChordId] : null;
  const showStartOverlay = !isLoading && !hasStartedTraining;
  const autoAdvanceProgress =
    autoAdvanceRemainingMs === null
      ? 0
      : getAutoAdvanceProgress(autoAdvanceRemainingMs, autoAdvanceMs);
  const showCenterFlash = Boolean(feedbackChord && lastResult && autoAdvanceRemainingMs !== null);
  const resolveAnimalImageCandidate = useCallback(
    (
      chordId: EguchiChordId,
      options: {
        emotion?: AnimalEmotion;
      } = {}
    ): AnimalImageCandidate | null => {
      const requestedEmotion = options.emotion ?? 'happy';
      const candidates: AnimalEmotion[] = [requestedEmotion];

      if (requestedEmotion !== 'happy') {
        candidates.push('happy');
      }

      for (const emotion of candidates) {
        const failureKey = getAnimalImageFailureKey(chordId, emotion);
        if (failedAnimalImageKeys.has(failureKey)) {
          continue;
        }

        const source = getChordAnimalImageSource(chordId, undefined, { emotion });
        if (source) {
          return {
            source,
            emotion,
          };
        }
      }
      return null;
    },
    [failedAnimalImageKeys]
  );
  const feedbackEmotion = getFeedbackAnimalEmotion(lastResult);
  const feedbackChordImageCandidate =
    feedbackChord && showCenterFlash
      ? resolveAnimalImageCandidate(feedbackChord.id, {
          emotion: feedbackEmotion,
        })
      : null;
  const feedbackChordImageSource = feedbackChordImageCandidate?.source ?? null;
  const feedbackImageRecyclingKey =
    feedbackChord && feedbackEmotion
      ? getAnimalImageRecyclingKey(
          'center',
          feedbackChord.id,
          feedbackChordImageCandidate?.emotion ?? feedbackEmotion
        )
      : undefined;
  const handleViewportLayout = useCallback(
    (width: number, height: number) => {
      setViewportSize(previous => {
        if (Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1) {
          return previous;
        }
        return { width, height };
      });
    },
    [setViewportSize]
  );
  const handleBottomSectionLayout = useCallback((height: number) => {
    setBottomSectionHeight(previous => (Math.abs(previous - height) < 1 ? previous : height));
  }, []);
  const gridLayout = useMemo(() => {
    const viewportWidth = viewportSize.width || windowWidth;
    const viewportHeight = viewportSize.height || windowHeight;
    const availableWidth = viewportWidth - CONTENT_HORIZONTAL_PADDING * 2;
    const availableHeight =
      viewportHeight -
      bottomSectionHeight -
      CONTENT_VERTICAL_PADDING * 2 -
      GRID_BASE_RESERVED_HEIGHT;
    return getGridLayout(unlockedChords.length, availableWidth, availableHeight);
  }, [
    bottomSectionHeight,
    unlockedChords.length,
    viewportSize.height,
    viewportSize.width,
    windowHeight,
    windowWidth,
  ]);
  const gridWidth = gridLayout.columns * gridLayout.tileSize + GRID_GAP * (gridLayout.columns - 1);
  const gridRows = Math.max(1, Math.ceil(unlockedChords.length / Math.max(1, gridLayout.columns)));
  const gridHeight = gridRows * gridLayout.tileSize + GRID_GAP * (gridRows - 1);
  const feedbackViewportShortSide = Math.min(
    viewportSize.width || windowWidth,
    viewportSize.height || windowHeight
  );
  const centerCardSize = Math.max(170, Math.min(430, Math.floor(feedbackViewportShortSide * 0.52)));
  const centerEmojiSize = Math.floor(centerCardSize * 0.58);
  const countdownVisibleSegmentCount = getCountdownVisibleSegmentCount(
    autoAdvanceProgress,
    COUNTDOWN_RING_SEGMENT_COUNT
  );
  const countdownRingSegments = useMemo(
    () =>
      Array.from({ length: COUNTDOWN_RING_SEGMENT_COUNT }, (_, index) => {
        const angleDeg = (index / COUNTDOWN_RING_SEGMENT_COUNT) * 360;
        const angleRad = (angleDeg * Math.PI) / 180;
        return {
          index,
          isVisible: index < countdownVisibleSegmentCount,
          left:
            COUNTDOWN_RING_SIZE / 2 -
            COUNTDOWN_RING_SEGMENT_WIDTH / 2 +
            Math.sin(angleRad) * COUNTDOWN_RING_SEGMENT_RADIUS,
          top:
            COUNTDOWN_RING_SIZE / 2 -
            COUNTDOWN_RING_SEGMENT_HEIGHT / 2 -
            Math.cos(angleRad) * COUNTDOWN_RING_SEGMENT_RADIUS,
          transform: [{ rotate: `${angleDeg}deg` }],
        };
      }),
    [countdownVisibleSegmentCount]
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          handleViewportLayout(width, height);
        }}
      >
        {isLoading ? <ActivityIndicator /> : null}
        <View style={[styles.gridStage, { width: gridWidth, height: gridHeight }]}>
          <View style={[styles.grid, { width: gridWidth }]}>
            {unlockedChords.map(chord => {
              const tileTextColor = getReadableTextColor(chord.color.hex);
              const animalImageCandidate = resolveAnimalImageCandidate(chord.id);
              const animalImageSource = animalImageCandidate?.source ?? null;
              const tileImageRecyclingKey = getAnimalImageRecyclingKey(
                'tile',
                chord.id,
                animalImageCandidate?.emotion ?? 'happy'
              );

              return (
                <Pressable
                  key={chord.id}
                  accessibilityRole="button"
                  disabled={isLoading}
                  onPress={() => handleAnswer(chord.id)}
                  style={[
                    styles.tile,
                    { width: gridLayout.tileSize, height: gridLayout.tileSize },
                    { backgroundColor: chord.color.hex },
                    isLoading && styles.buttonDisabled,
                  ]}
                >
                  {animalImageSource ? (
                    <Image
                      key={tileImageRecyclingKey}
                      recyclingKey={tileImageRecyclingKey}
                      source={animalImageSource}
                      style={styles.tileImage}
                      contentFit="contain"
                      onError={() => {
                        console.log('[Eguchi] Animal image missing, using emoji fallback', {
                          chord: chord.id,
                          emotion: animalImageCandidate?.emotion ?? 'default',
                          uri:
                            typeof animalImageSource === 'number'
                              ? 'bundle'
                              : animalImageSource.uri,
                        });
                        markAnimalImageFailed(chord.id, animalImageCandidate?.emotion);
                      }}
                    />
                  ) : (
                    <ThemedText style={[styles.tileEmoji, { color: tileTextColor }]}>
                      {ANIMAL_EMOJIS[chord.id]}
                    </ThemedText>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
        <View
          style={styles.bottomSection}
          onLayout={event => {
            handleBottomSectionLayout(event.nativeEvent.layout.height);
          }}
        >
          <View style={styles.replayContainer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Replay sound"
              onPress={handleReplay}
              disabled={isLoading}
              style={[
                styles.replayButton,
                { backgroundColor: buttonBackground },
                isLoading && styles.buttonDisabled,
              ]}
            >
              <ThemedText style={styles.replayEmoji}>🔊</ThemedText>
            </Pressable>
            {startupAutoplayPending ? (
              <ThemedText style={styles.startupHint}>Tap to start sound</ThemedText>
            ) : null}
          </View>
          {progressionStatus ? (
            <View style={styles.missionCard}>
              <ThemedText style={styles.missionTitle}>🎯 Today</ThemedText>
              <View style={styles.missionRow}>
                <ThemedText style={styles.missionLabel}>🧩 Rounds</ThemedText>
                <ThemedText style={styles.missionValue}>
                  {progressionStatus.todaySummary.attempts}/{progressionStatus.dailyAttemptTarget}
                </ThemedText>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${missionProgress * 100}%` }]} />
              </View>

              <View style={styles.missionRow}>
                <ThemedText style={styles.missionLabel}>✅ Great taps</ThemedText>
                <ThemedText style={styles.missionValue}>
                  {formatPercent(successProgress)}
                </ThemedText>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    styles.successFill,
                    { width: `${successProgress * 100}%` },
                  ]}
                />
              </View>

              <View style={styles.missionRow}>
                <ThemedText style={styles.missionLabel}>⭐ Star days</ThemedText>
                <ThemedText style={styles.missionValue}>
                  {progressionStatus.perfectDayStreak}/{progressionStatus.perfectDaysRequired}
                </ThemedText>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    styles.streakFill,
                    { width: `${streakProgress * 100}%` },
                  ]}
                />
              </View>

              <ThemedText style={styles.nextFriendText}>
                {progressionStatus.nextChordAnimal
                  ? `🪄 Keep going to meet ${progressionStatus.nextChordAnimal}.`
                  : '🏆 All animal sounds unlocked.'}
              </ThemedText>
              {unlockAnnouncement ? (
                <View style={styles.unlockBanner}>
                  <ThemedText style={styles.unlockBannerText}>{unlockAnnouncement}</ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <Modal
        visible={showCenterFlash && Boolean(feedbackChord)}
        transparent
        animationType="none"
        presentationStyle="overFullScreen"
        statusBarTranslucent
      >
        <View style={styles.feedbackOverlay}>
          {feedbackChord ? (
            <View style={styles.overlayFeedbackStack}>
              <View
                style={[
                  styles.centerFlashCard,
                  {
                    backgroundColor: feedbackChord.color.hex,
                    width: centerCardSize,
                    height: centerCardSize,
                    borderRadius: Math.floor(centerCardSize * 0.12),
                  },
                ]}
              >
                {feedbackChordImageSource ? (
                  <Image
                    key={feedbackImageRecyclingKey}
                    recyclingKey={feedbackImageRecyclingKey}
                    source={feedbackChordImageSource}
                    style={styles.centerFlashImage}
                    contentFit="contain"
                    onError={() => {
                      console.log('[Eguchi] Center flash image missing, using emoji fallback', {
                        chord: feedbackChord.id,
                        emotion: feedbackChordImageCandidate?.emotion ?? 'default',
                        uri:
                          typeof feedbackChordImageSource === 'number'
                            ? 'bundle'
                            : feedbackChordImageSource.uri,
                      });
                      markAnimalImageFailed(feedbackChord.id, feedbackChordImageCandidate?.emotion);
                    }}
                  />
                ) : (
                  <ThemedText
                    style={[
                      styles.centerFlashEmoji,
                      { fontSize: centerEmojiSize, lineHeight: Math.round(centerEmojiSize * 1.06) },
                    ]}
                  >
                    {ANIMAL_EMOJIS[feedbackChord.id]}
                  </ThemedText>
                )}
              </View>
              <View style={styles.overlayCountdownRing}>
                {countdownRingSegments.map(segment => (
                  <View
                    key={segment.index}
                    style={[
                      styles.overlayCountdownSegment,
                      {
                        left: segment.left,
                        top: segment.top,
                        opacity: segment.isVisible ? 0.9 : 0.12,
                        transform: segment.transform,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
      <Modal
        visible={showStartOverlay}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
      >
        <View style={styles.startOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start training"
            onPress={handleStartTraining}
            style={[
              styles.startCard,
              {
                backgroundColor: startCardBackground,
                borderColor: startCardBorderColor,
              },
            ]}
          >
            <View style={[styles.startEmojiBadge, { backgroundColor: buttonBackground }]}>
              <ThemedText style={[styles.startEmoji, { color: startBadgeTextColor }]}>
                🔊
              </ThemedText>
            </View>
            <ThemedText style={[styles.startTitle, { color: startTitleColor }]}>
              Tap To Start
            </ThemedText>
            <ThemedText style={[styles.startSubtitle, { color: startSubtitleColor }]}>
              Listen, then tap the matching animal
            </ThemedText>
          </Pressable>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
    paddingVertical: CONTENT_VERTICAL_PADDING,
    gap: 14,
    position: 'relative',
  },
  bottomSection: {
    gap: 12,
    paddingBottom: 8,
  },
  missionCard: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 7,
  },
  missionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  missionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  missionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  missionValue: {
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'right',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E2E2',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2E7D32',
  },
  successFill: {
    backgroundColor: '#1F9D55',
  },
  streakFill: {
    backgroundColor: '#F4A100',
  },
  nextFriendText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.85,
  },
  unlockBanner: {
    borderRadius: 10,
    backgroundColor: '#E9F7EF',
    borderWidth: 1,
    borderColor: '#9CD7B0',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  unlockBannerText: {
    color: '#166534',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  replayContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    gap: 8,
  },
  replayButton: {
    width: 92,
    height: 92,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  replayEmoji: {
    fontSize: 50,
    lineHeight: 54,
  },
  startupHint: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.78,
    fontWeight: '600',
  },
  startOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 10, 14, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    paddingHorizontal: 24,
  },
  feedbackOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 10, 14, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  startCard: {
    width: '100%',
    maxWidth: 360,
    minHeight: 210,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 22,
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  startEmojiBadge: {
    width: 108,
    height: 108,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  startEmoji: {
    fontSize: 62,
    lineHeight: 66,
  },
  startTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
  },
  startSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
    opacity: 0.9,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    justifyContent: 'center',
    gap: GRID_GAP,
  },
  gridStage: {
    alignSelf: 'center',
    position: 'relative',
  },
  tile: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  tileImage: {
    width: '94%',
    height: '94%',
  },
  tileEmoji: { fontSize: 116, lineHeight: 124 },
  buttonDisabled: {
    opacity: 0.5,
  },
  overlayFeedbackStack: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 1,
  },
  centerFlashCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  centerFlashImage: {
    width: '90%',
    height: '90%',
  },
  overlayCountdownRing: {
    width: COUNTDOWN_RING_SIZE,
    height: COUNTDOWN_RING_SIZE,
  },
  overlayCountdownSegment: {
    position: 'absolute',
    width: COUNTDOWN_RING_SEGMENT_WIDTH,
    height: COUNTDOWN_RING_SEGMENT_HEIGHT,
    borderRadius: COUNTDOWN_RING_SEGMENT_WIDTH,
    backgroundColor: '#FFFFFF',
  },
  centerFlashEmoji: {
    fontSize: 182,
    lineHeight: 192,
  },
});
