import { useFocusEffect } from '@react-navigation/native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
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
import {
  TrainingAnimalTile,
  type TrainingTileReaction,
} from '@/components/eguchi/TrainingAnimalTile';
import { useAuth } from '@/auth/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { resolveAudioPlaybackSource } from '@/lib/eguchi/audio-assets';
import type { AudioEntry } from '@/lib/eguchi/audio-pack';
import { pickTrainingAudioEntry } from '@/lib/eguchi/audio-selection';
import { getChordAnimalImageSource, type AnimalEmotion } from '@/lib/eguchi/animal-assets';
import { CHORD_BY_ID, DEFAULT_UNLOCKED_CHORD_IDS, type EguchiChordId } from '@/lib/eguchi/chords';
import {
  advanceLearningPath,
  getActiveTrainingChordIds,
  getTrainingAudioOctaves,
  getTrialHintDelayMs,
  type TrainingOutcome,
} from '@/lib/eguchi/learning-path';
import { maybeApplyAutoUnlock } from '@/lib/eguchi/progression';
import {
  createDefaultEguchiProgress,
  createEguchiTrialId,
  loadEguchiProgress,
  recordTrial,
  saveEguchiProgress,
  type EguchiProgress,
} from '@/lib/eguchi/progress';
import {
  markEguchiProgressDirty,
  queueEguchiTrialEvent,
  syncEguchiStateBestEffort,
} from '@/lib/eguchi/sync';
import { getAutoAdvanceDurationMs, pickRandomChordId } from '@/lib/eguchi/training-loop';
import {
  didPlaybackStart,
  getPlaybackRetryDelayMs,
  getPlaybackRetryLimit,
  STARTUP_PLAYBACK_WATCHDOG_DELAY_MS,
  shouldReplayAfterPlaybackWatchdog,
  type PlaybackOrigin,
} from '@/lib/eguchi/audio-playback';
import {
  classifyTrainingOutcome,
  getAnimalImageRecyclingKey,
  getSuccessTileReaction,
} from '@/lib/eguchi/training-feedback';
import {
  createDefaultEguchiSessionPreferences,
  loadEguchiSessionPreferences,
  type EguchiSessionPreferences,
} from '@/lib/eguchi/session-preferences';
import { getPlayroomBackground } from '@/lib/eguchi/playroom-backgrounds';
import { getEguchiTheme } from '@/lib/eguchi/theme';

const CONTENT_HORIZONTAL_PADDING = 24;
const CONTENT_VERTICAL_PADDING = 20;
const GRID_GAP = 10;
const GRID_MIN_TILE_SIZE = 28;
const GRID_MAX_COLUMNS = 6;
const GRID_BASE_RESERVED_HEIGHT = 30;
const PLAYBACK_START_CONFIRMATION_TIMEOUT_MS = 650;
const FEEDBACK_TO_TRIAL_AUDIO_SETTLE_MS = 220;

type TileReactionState = {
  reaction: TrainingTileReaction;
  nonce: number;
};

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
  const { token } = useAuth();
  const colorScheme = useColorScheme();
  const theme = getEguchiTheme(colorScheme);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [bottomSectionHeight, setBottomSectionHeight] = useState(0);
  const [progress, setProgress] = useState<EguchiProgress | null>(null);
  const [sessionPreferences, setSessionPreferences] = useState<EguchiSessionPreferences | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const progressRef = useRef<EguchiProgress>(createDefaultEguchiProgress());
  const sessionPreferencesRef = useRef<EguchiSessionPreferences>(
    createDefaultEguchiSessionPreferences()
  );
  const [visibleChordIds, setVisibleChordIds] = useState<EguchiChordId[]>(
    DEFAULT_UNLOCKED_CHORD_IDS
  );
  const visibleChords = visibleChordIds.map(id => CHORD_BY_ID[id]);
  const [tileReactions, setTileReactions] = useState<
    Partial<Record<EguchiChordId, TileReactionState>>
  >({});
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const currentHintDelayMsRef = useRef<number | null>(0);
  const hintShownRef = useRef(false);
  const hadIncorrectTapRef = useRef(false);
  const hasInitializedTrialRef = useRef(false);
  const hasAnsweredCurrentTrialRef = useRef(false);
  const [failedAnimalImageKeys, setFailedAnimalImageKeys] = useState<Set<string>>(new Set());
  const syncInFlightRef = useRef(false);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);

  const clearHintTimer = useCallback(() => {
    if (hintTimer.current) {
      clearTimeout(hintTimer.current);
      hintTimer.current = null;
    }
  }, []);

  const triggerTileReaction = useCallback(
    (chordId: EguchiChordId, reaction: Exclude<TrainingTileReaction, null>) => {
      setTileReactions(previous => ({
        ...previous,
        [chordId]: {
          reaction,
          nonce: (previous[chordId]?.nonce ?? 0) + 1,
        },
      }));
    },
    []
  );

  const scheduleTrialHint = useCallback(
    (chordId: EguchiChordId) => {
      clearHintTimer();
      const delayMs = currentHintDelayMsRef.current;
      if (delayMs === null || hasAnsweredCurrentTrialRef.current) {
        return;
      }
      hintTimer.current = setTimeout(() => {
        hintTimer.current = null;
        if (hasAnsweredCurrentTrialRef.current || currentChordRef.current !== chordId) {
          return;
        }
        hintShownRef.current = true;
        triggerTileReaction(chordId, 'hint');
      }, delayMs);
    },
    [clearHintTimer, triggerTileReaction]
  );

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
      progressRef.current = loadedProgress;
      sessionPreferencesRef.current = loadedSessionPreferences;
      setProgress(loadedProgress);
      setSessionPreferences(loadedSessionPreferences);
    } catch (error) {
      console.warn('Failed to load Eguchi training data', error);
      const fallbackProgress = createDefaultEguchiProgress();
      const fallbackPreferences = createDefaultEguchiSessionPreferences();
      progressRef.current = fallbackProgress;
      sessionPreferencesRef.current = fallbackPreferences;
      setProgress(fallbackProgress);
      setSessionPreferences(fallbackPreferences);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncTrainingData = useCallback(
    async (reloadAfterSync = false) => {
      if (!token || syncInFlightRef.current) {
        return;
      }
      syncInFlightRef.current = true;
      try {
        const result = await syncEguchiStateBestEffort(token);
        if (reloadAfterSync && result.ok) {
          await loadTrainingData();
        }
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [loadTrainingData, token]
  );

  useFocusEffect(
    useCallback(() => {
      void loadTrainingData().then(() => syncTrainingData(true));
      return undefined;
    }, [loadTrainingData, syncTrainingData])
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
        if ((origin === 'new-trial' || origin === 'retry') && !hasAnsweredCurrentTrialRef.current) {
          scheduleTrialHint(chordId);
        } else if (
          origin === 'answer-feedback' &&
          hadIncorrectTapRef.current &&
          !hasAnsweredCurrentTrialRef.current
        ) {
          hintShownRef.current = true;
          triggerTileReaction(chordId, 'hint');
        }
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
    [
      clearPlaybackRetry,
      clearStartupPlaybackWatchdog,
      ensureTrainingAudioMode,
      scheduleTrialHint,
      stopSound,
      triggerTileReaction,
    ]
  );

  const startNewTrial = useCallback(() => {
    const activeProgress = progressRef.current;
    const activeSessionPreferences = sessionPreferencesRef.current;
    const activeUnlockedChordIds = getActiveTrainingChordIds(
      activeProgress.learningPath,
      activeProgress.unlockedChordIds
    );

    if (!activeUnlockedChordIds.length) {
      clearAdvanceTimer();
      clearHintTimer();
      clearStartupPlaybackWatchdog();
      currentChordRef.current = null;
      currentAudioRef.current = null;
      setStartupAutoplayPending(false);
      return;
    }

    clearAdvanceTimer();
    clearHintTimer();
    clearStartupPlaybackWatchdog();
    hasAnsweredCurrentTrialRef.current = false;
    hintShownRef.current = false;
    hadIncorrectTapRef.current = false;
    setTileReactions({});
    setVisibleChordIds(activeUnlockedChordIds);

    const nextChordId = pickRandomChordId(activeUnlockedChordIds);
    currentChordRef.current = nextChordId;
    currentHintDelayMsRef.current = getTrialHintDelayMs(activeProgress.learningPath, {
      adaptiveHintsEnabled: activeSessionPreferences.adaptiveHintsEnabled,
      noHintTrialsEnabled: activeSessionPreferences.noHintTrialsEnabled,
    });

    const audioOctaves = getTrainingAudioOctaves(activeProgress.learningPath);
    const nextAudio = pickTrainingAudioEntry(nextChordId, { octaves: audioOctaves });
    if (!nextAudio) {
      console.warn('No audio file available for chord', nextChordId);
    }
    currentAudioRef.current = nextAudio;

    console.log('[Eguchi] New trial', {
      chord: nextChordId,
      animal: CHORD_BY_ID[nextChordId]?.animal,
      file: nextAudio?.fileName ?? 'missing',
      learningPhase: activeProgress.learningPath.phase,
      hintDelayMs: currentHintDelayMsRef.current,
      audioOctaves,
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
  }, [
    clearAdvanceTimer,
    clearHintTimer,
    clearStartupPlaybackWatchdog,
    hasStartedTraining,
    playCurrentAudio,
  ]);

  const handleAnswer = useCallback(
    (id: EguchiChordId) => {
      if (!hasStartedTraining || hasAnsweredCurrentTrialRef.current || isLoading) {
        return;
      }

      const expectedId = currentChordRef.current;
      if (!expectedId) return;
      const expectedAudio = currentAudioRef.current;

      const selectedChord = CHORD_BY_ID[id];
      const expectedChord = CHORD_BY_ID[expectedId];
      const isCorrect = id === expectedId;

      if (!isCorrect) {
        hadIncorrectTapRef.current = true;
        clearHintTimer();
        clearStartupPlaybackWatchdog();
        clearPlaybackRetry();
        playbackRequestIdRef.current += 1;
        triggerTileReaction(id, 'not-me');
        console.log('[Eguchi] Gentle correction', {
          selected: id,
          selectedAnimal: selectedChord?.animal,
          expected: expectedId,
          expectedAnimal: expectedChord?.animal,
        });
        void playCurrentAudio({
          chordId: expectedId,
          entry: expectedAudio,
          origin: 'answer-feedback',
        });
        return;
      }

      hasAnsweredCurrentTrialRef.current = true;
      clearHintTimer();
      clearStartupPlaybackWatchdog();
      clearPlaybackRetry();
      playbackRequestIdRef.current += 1;

      const trialTimestamp = new Date().toISOString();
      const trialId = createEguchiTrialId(trialTimestamp);
      const activeSessionPreferences = sessionPreferencesRef.current;
      const outcome: TrainingOutcome = classifyTrainingOutcome({
        hadIncorrectTap: hadIncorrectTapRef.current,
        hintShown: hintShownRef.current,
      });
      const trialHintDelayMs = currentHintDelayMsRef.current;
      const configuredFeedbackMs = getAutoAdvanceDurationMs(
        activeSessionPreferences.feedbackSeconds
      );
      const autoAdvanceDurationMs =
        outcome === 'independent'
          ? Math.max(1200, Math.min(configuredFeedbackMs, 2400))
          : Math.max(800, Math.min(configuredFeedbackMs, 1600));
      const tileReaction = getSuccessTileReaction(outcome);

      setProgress(previous => {
        const currentProgress = previous ?? createDefaultEguchiProgress();
        const afterRecord = recordTrial(currentProgress, {
          id: trialId,
          chordId: expectedId,
          correct: outcome !== 'corrected',
          outcome,
          promptDelayMs: trialHintDelayMs,
          timestamp: trialTimestamp,
        });
        const learningResult = advanceLearningPath(
          afterRecord.learningPath,
          afterRecord.unlockedChordIds,
          outcome
        );
        let nextProgress: EguchiProgress = {
          ...afterRecord,
          unlockedChordIds: learningResult.unlockedChordIds,
          learningPath: learningResult.state,
        };
        if (!activeSessionPreferences.adaptiveHintsEnabled) {
          nextProgress = maybeApplyAutoUnlock(nextProgress, {
            autoUnlockEnabled: activeSessionPreferences.autoUnlockEnabled,
            perfectDaysRequired: activeSessionPreferences.perfectDaysRequired,
            dailyAttemptTarget: activeSessionPreferences.dailyAttemptTarget,
          }).progress;
        }
        progressRef.current = nextProgress;

        if (learningResult.unlockedChordId) {
          console.log('[Eguchi] Learning path introduced a new friend', {
            chord: learningResult.unlockedChordId,
            animal: CHORD_BY_ID[learningResult.unlockedChordId]?.animal,
          });
        }

        void (async () => {
          try {
            await saveEguchiProgress(nextProgress);
            await queueEguchiTrialEvent({
              id: trialId,
              chordId: expectedId,
              correct: outcome !== 'corrected',
              outcome,
              promptDelayMs: trialHintDelayMs,
              timestamp: trialTimestamp,
            });
            await markEguchiProgressDirty();
            void syncEguchiStateBestEffort(token);
          } catch (error) {
            console.warn('Failed to save Eguchi progress', error);
          }
        })();
        return nextProgress;
      });

      console.log('[Eguchi] Answer selected', {
        selected: id,
        selectedAnimal: selectedChord?.animal,
        expected: expectedId,
        expectedAnimal: expectedChord?.animal,
        outcome,
      });
      triggerTileReaction(expectedId, tileReaction);
      void playCurrentAudio({
        chordId: expectedId,
        entry: expectedAudio,
        origin: 'answer-feedback',
      });

      clearAdvanceTimer();
      advanceTimer.current = setTimeout(() => {
        clearAdvanceTimer();
        startNewTrial();
      }, autoAdvanceDurationMs);
    },
    [
      clearAdvanceTimer,
      clearHintTimer,
      clearPlaybackRetry,
      clearStartupPlaybackWatchdog,
      hasStartedTraining,
      isLoading,
      playCurrentAudio,
      startNewTrial,
      token,
      triggerTileReaction,
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
    if (progress) progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (sessionPreferences) sessionPreferencesRef.current = sessionPreferences;
  }, [sessionPreferences]);

  useEffect(() => {
    return () => {
      clearAdvanceTimer();
      clearHintTimer();
      clearPlaybackRetry();
      clearStartupPlaybackWatchdog();
      setStartupAutoplayPending(false);
      playbackRequestIdRef.current += 1;
      pendingPlaybackRequestRef.current = null;
      void stopSound();
    };
  }, [
    clearAdvanceTimer,
    clearHintTimer,
    clearPlaybackRetry,
    clearStartupPlaybackWatchdog,
    stopSound,
  ]);

  useEffect(() => {
    if (!isReady) {
      hasInitializedTrialRef.current = false;
      return;
    }

    if (hasInitializedTrialRef.current) {
      return;
    }

    hasInitializedTrialRef.current = true;
    startNewTrial();
  }, [isReady, startNewTrial]);

  const buttonBackground = theme.tint;
  const playroomBackground = getPlayroomBackground(
    sessionPreferences?.playroomBackgroundId ?? 'pink'
  );
  const playroomTextColor = getReadableTextColor(playroomBackground.color);
  const startBadgeTextColor = theme.isDark ? '#06202B' : '#FFFFFF';
  const showStartOverlay = !isLoading && !hasStartedTraining;
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
    return getGridLayout(visibleChords.length, availableWidth, availableHeight);
  }, [
    bottomSectionHeight,
    visibleChords.length,
    viewportSize.height,
    viewportSize.width,
    windowHeight,
    windowWidth,
  ]);
  const gridWidth = gridLayout.columns * gridLayout.tileSize + GRID_GAP * (gridLayout.columns - 1);
  const gridRows = Math.max(1, Math.ceil(visibleChords.length / Math.max(1, gridLayout.columns)));
  const gridHeight = gridRows * gridLayout.tileSize + GRID_GAP * (gridRows - 1);

  return (
    <ThemedView style={[styles.container, { backgroundColor: playroomBackground.color }]}>
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
            {visibleChords.map(chord => {
              const tileTextColor = getReadableTextColor(chord.color.hex);
              const animalImageCandidate = resolveAnimalImageCandidate(chord.id);
              const animalImageSource = animalImageCandidate?.source ?? null;
              const tileReaction = tileReactions[chord.id];
              const tileImageRecyclingKey = getAnimalImageRecyclingKey(
                'tile',
                chord.id,
                animalImageCandidate?.emotion ?? 'happy'
              );

              return (
                <TrainingAnimalTile
                  key={chord.id}
                  animal={chord.animal}
                  backgroundColor={chord.color.hex}
                  disabled={isLoading}
                  emoji={ANIMAL_EMOJIS[chord.id]}
                  imageRecyclingKey={tileImageRecyclingKey}
                  imageSource={animalImageSource}
                  onImageError={() => {
                    console.log('[Eguchi] Animal image missing, using emoji fallback', {
                      chord: chord.id,
                      emotion: animalImageCandidate?.emotion ?? 'default',
                      uri:
                        typeof animalImageSource === 'number' ? 'bundle' : animalImageSource?.uri,
                    });
                    markAnimalImageFailed(chord.id, animalImageCandidate?.emotion);
                  }}
                  onPress={() => handleAnswer(chord.id)}
                  reaction={tileReaction?.reaction ?? null}
                  reactionNonce={tileReaction?.nonce ?? 0}
                  size={gridLayout.tileSize}
                  textColor={tileTextColor}
                />
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
              <ThemedText style={[styles.startupHint, { color: playroomTextColor }]}>
                Tap to start sound
              </ThemedText>
            ) : null}
          </View>
        </View>
      </ScrollView>
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
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={[styles.startEmojiBadge, { backgroundColor: buttonBackground }]}>
              <ThemedText style={[styles.startEmoji, { color: startBadgeTextColor }]}>
                🔊
              </ThemedText>
            </View>
            <ThemedText style={[styles.startTitle, { color: theme.text }]}>Tap To Start</ThemedText>
            <ThemedText style={[styles.startSubtitle, { color: theme.subtleText }]}>
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
  buttonDisabled: {
    opacity: 0.5,
  },
});
