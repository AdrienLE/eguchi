import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { pickRandomAudioEntry, type AudioEntry } from '@/lib/eguchi/audio-pack';
import { getChordAnimalImageSource } from '@/lib/eguchi/animal-assets';
import {
  CHORD_BY_ID,
  DEFAULT_UNLOCKED_CHORD_IDS,
  type EguchiChordId,
} from '@/lib/eguchi/chords';
import { getNextLevelProgress, maybeApplyAutoUnlock } from '@/lib/eguchi/progression';
import {
  createDefaultEguchiProgress,
  loadEguchiProgress,
  recordTrial,
  saveEguchiProgress,
  type EguchiProgress,
} from '@/lib/eguchi/progress';
import {
  AUTO_ADVANCE_DEFAULT_MS,
  AUTO_ADVANCE_TICK_MS,
  getAutoAdvanceProgress,
  getAutoAdvanceSeconds,
  pickRandomChordId,
} from '@/lib/eguchi/training-loop';
import {
  createDefaultEguchiSessionPreferences,
  loadEguchiSessionPreferences,
  type EguchiSessionPreferences,
} from '@/lib/eguchi/session-preferences';

const AUTO_ADVANCE_MS = AUTO_ADVANCE_DEFAULT_MS;
const CONTENT_HORIZONTAL_PADDING = 24;
const GRID_GAP = 10;
const GRID_MIN_TILE_SIZE = 28;
const GRID_MAX_COLUMNS = 6;
const GRID_RESERVED_HEIGHT = 310;

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
  const [progress, setProgress] = useState<EguchiProgress | null>(null);
  const [sessionPreferences, setSessionPreferences] = useState<EguchiSessionPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const defaultSessionPreferences = useRef(createDefaultEguchiSessionPreferences());
  const unlockedChordIds =
    progress?.unlockedChordIds.length ? progress.unlockedChordIds : DEFAULT_UNLOCKED_CHORD_IDS;
  const unlockedChords = unlockedChordIds.map(id => CHORD_BY_ID[id]);
  const unlockedChordKey = unlockedChordIds.join('|');
  const [currentChordId, setCurrentChordId] = useState<EguchiChordId | null>(null);
  const [lastAnswerId, setLastAnswerId] = useState<EguchiChordId | null>(null);
  const [lastResult, setLastResult] = useState<'correct' | 'incorrect' | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTicker = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoAdvanceRemainingMs, setAutoAdvanceRemainingMs] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const currentChordRef = useRef<EguchiChordId | null>(null);
  const currentAudioRef = useRef<AudioEntry | null>(null);
  const hasAnsweredCurrentTrialRef = useRef(false);
  const [failedAnimalImageChordIds, setFailedAnimalImageChordIds] = useState<Set<EguchiChordId>>(
    new Set()
  );

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
      try {
        await soundRef.current.unloadAsync();
      } catch (error) {
        console.warn('Failed to unload audio', error);
      } finally {
        soundRef.current = null;
      }
    }
  }, []);

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

  const playCurrentAudio = useCallback(async () => {
    const chordId = currentChordRef.current;
    const entry = currentAudioRef.current;
    if (!chordId || !entry) {
      console.warn('No audio available for current chord', chordId);
      return;
    }
    await stopSound();
    try {
      console.log('[Eguchi] Playing audio', {
        chord: chordId,
        file: entry.fileName,
      });
      const { sound } = await Audio.Sound.createAsync(entry.module, {
        shouldPlay: true,
        volume: 1.0,
      });
      soundRef.current = sound;
    } catch (error) {
      console.warn('Failed to play chord audio', error);
    }
  }, [stopSound]);

  const startNewTrial = useCallback(() => {
    if (!unlockedChordIds.length) {
      clearAdvanceTimer();
      currentChordRef.current = null;
      currentAudioRef.current = null;
      setCurrentChordId(null);
      return;
    }

    clearAdvanceTimer();
    hasAnsweredCurrentTrialRef.current = false;
    setLastAnswerId(null);
    setLastResult(null);

    const nextChordId = pickRandomChordId(unlockedChordIds);
    currentChordRef.current = nextChordId;
    setCurrentChordId(nextChordId);

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

    void playCurrentAudio();
  }, [clearAdvanceTimer, playCurrentAudio, unlockedChordIds]);

  const handleAnswer = useCallback(
    (id: EguchiChordId) => {
      if (hasAnsweredCurrentTrialRef.current || isLoading) {
        return;
      }

      const expectedId = currentChordRef.current;
      if (!expectedId) return;

      hasAnsweredCurrentTrialRef.current = true;

      const selectedChord = CHORD_BY_ID[id];
      const expectedChord = CHORD_BY_ID[expectedId];
      const isCorrect = id === expectedId;
      const activeSessionPreferences = sessionPreferences ?? defaultSessionPreferences.current;

      setLastAnswerId(id);
      setLastResult(isCorrect ? 'correct' : 'incorrect');
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
      void playCurrentAudio();

      clearAdvanceTimer();
      const countdownStartedAt = Date.now();
      setAutoAdvanceRemainingMs(AUTO_ADVANCE_MS);
      advanceTicker.current = setInterval(() => {
        const elapsed = Date.now() - countdownStartedAt;
        const remaining = Math.max(0, AUTO_ADVANCE_MS - elapsed);
        setAutoAdvanceRemainingMs(remaining);
      }, AUTO_ADVANCE_TICK_MS);
      advanceTimer.current = setTimeout(() => {
        clearAdvanceTimer();
        startNewTrial();
      }, AUTO_ADVANCE_MS);
    },
    [clearAdvanceTimer, isLoading, playCurrentAudio, sessionPreferences, startNewTrial]
  );

  const handleReplay = useCallback(() => {
    if (!currentChordRef.current || !currentAudioRef.current) {
      startNewTrial();
      return;
    }
    void playCurrentAudio();
  }, [playCurrentAudio, startNewTrial]);

  const handleSkip = useCallback(() => {
    clearAdvanceTimer();
    startNewTrial();
  }, [clearAdvanceTimer, startNewTrial]);

  const markAnimalImageFailed = useCallback((id: EguchiChordId) => {
    setFailedAnimalImageChordIds(previous => {
      if (previous.has(id)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(id);
      return next;
    });
  }, []);

  const handleStayOnCard = useCallback(() => {
    clearAdvanceTimer();
  }, [clearAdvanceTimer]);

  const handleNextCard = useCallback(() => {
    clearAdvanceTimer();
    startNewTrial();
  }, [clearAdvanceTimer, startNewTrial]);

  const isReady = !isLoading && progress !== null;
  useEffect(() => {
    if (!isReady) {
      return;
    }

    startNewTrial();
    return () => {
      clearAdvanceTimer();
      void stopSound();
    };
  }, [clearAdvanceTimer, isReady, startNewTrial, stopSound, unlockedChordKey]);

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
  const buttonBackground = Colors[colorScheme ?? 'light'].tint;
  const buttonTextColor = colorScheme === 'light' ? '#FFFFFF' : '#111111';
  const outlineColor = Colors[colorScheme ?? 'light'].icon;
  const missionProgress = progressionStatus
    ? clampProgress(
        progressionStatus.todaySummary.attempts / Math.max(1, progressionStatus.dailyAttemptTarget)
      )
    : 0;
  const successProgress = progressionStatus
    ? clampProgress(
        progressionStatus.todaySummary.correct / Math.max(1, progressionStatus.todaySummary.attempts)
      )
    : 0;
  const streakProgress = progressionStatus
    ? progressionStatus.isMaxLevel
      ? 1
      : clampProgress(
          progressionStatus.perfectDayStreak / Math.max(1, progressionStatus.perfectDaysRequired)
        )
    : 0;
  const currentChord = currentChordId ? CHORD_BY_ID[currentChordId] : null;
  const autoAdvanceProgress =
    autoAdvanceRemainingMs === null
      ? 0
      : getAutoAdvanceProgress(autoAdvanceRemainingMs, AUTO_ADVANCE_MS);
  const autoAdvanceSeconds = getAutoAdvanceSeconds(autoAdvanceRemainingMs);
  const showCenterFlash = Boolean(currentChord && lastResult && autoAdvanceRemainingMs !== null);
  const currentChordImageSource =
    currentChord && !failedAnimalImageChordIds.has(currentChord.id)
      ? getChordAnimalImageSource(currentChord.id)
      : null;
  const gridLayout = useMemo(() => {
    const availableWidth = windowWidth - CONTENT_HORIZONTAL_PADDING * 2;
    const availableHeight = windowHeight - GRID_RESERVED_HEIGHT;
    return getGridLayout(unlockedChords.length, availableWidth, availableHeight);
  }, [unlockedChords.length, windowHeight, windowWidth]);
  const gridWidth = gridLayout.columns * gridLayout.tileSize + GRID_GAP * (gridLayout.columns - 1);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? <ActivityIndicator /> : null}
        {!showCenterFlash ? (
          <View style={[styles.grid, { width: gridWidth }]}>
            {unlockedChords.map(chord => {
              const showCorrect = lastResult !== null;
              const isCorrectTile = showCorrect && currentChordId === chord.id;
              const isWrongSelection =
                lastResult === 'incorrect' && lastAnswerId === chord.id && !isCorrectTile;
              const tileTextColor = getReadableTextColor(chord.color.hex);
              const animalImageSource = failedAnimalImageChordIds.has(chord.id)
                ? null
                : getChordAnimalImageSource(chord.id);

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
                  isCorrectTile && styles.tileCorrect,
                  isWrongSelection && styles.tileIncorrect,
                    isLoading && styles.buttonDisabled,
                  ]}
                >
                  {animalImageSource ? (
                    <Image
                      source={animalImageSource}
                      style={styles.tileImage}
                      contentFit="contain"
                      onError={() => {
                        console.log('[Eguchi] Animal image missing, using emoji fallback', {
                          chord: chord.id,
                          uri:
                            typeof animalImageSource === 'number'
                              ? 'bundle'
                              : animalImageSource.uri,
                        });
                        markAnimalImageFailed(chord.id);
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
        ) : (
          <View style={styles.feedbackGridSpacer} />
        )}
        {lastResult && currentChord ? (
          <View style={styles.feedbackCard}>
            <ThemedText style={styles.feedbackTitle}>
              {lastResult === 'correct'
                ? `✅ Nice tap! ${ANIMAL_EMOJIS[currentChord.id]}`
                : `❌ Best move: ${ANIMAL_EMOJIS[currentChord.id]} ${currentChord.animal}`}
            </ThemedText>
            <ThemedText style={styles.feedbackSubtitle}>
              {autoAdvanceSeconds === null
                ? 'Paused on this card.'
                : `Next card in ${autoAdvanceSeconds}s`}
            </ThemedText>
            <View style={styles.autoAdvanceTrack}>
              <View style={[styles.autoAdvanceFill, { width: `${autoAdvanceProgress * 100}%` }]} />
            </View>
            <View style={styles.feedbackActions}>
              <Pressable
                accessibilityRole="button"
                onPress={handleStayOnCard}
                disabled={autoAdvanceRemainingMs === null}
                style={[
                  styles.feedbackSecondaryButton,
                  { borderColor: outlineColor },
                  autoAdvanceRemainingMs === null && styles.buttonDisabled,
                ]}
              >
                <ThemedText style={styles.feedbackSecondaryButtonText}>⏸ Stay</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleNextCard}
                style={[styles.feedbackPrimaryButton, { backgroundColor: buttonBackground }]}
              >
                <ThemedText style={[styles.feedbackPrimaryButtonText, { color: buttonTextColor }]}>
                  ⏭ Next
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.bottomSection}>
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
                <ThemedText style={styles.missionValue}>{formatPercent(successProgress)}</ThemedText>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, styles.successFill, { width: `${successProgress * 100}%` }]}
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
                  style={[styles.progressFill, styles.streakFill, { width: `${streakProgress * 100}%` }]}
                />
              </View>

              <ThemedText style={styles.nextFriendText}>
                {progressionStatus.nextChordAnimal
                  ? `🪄 Keep going to meet ${progressionStatus.nextChordAnimal}.`
                  : '🏆 All animal sounds unlocked.'}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              onPress={handleReplay}
              disabled={isLoading}
              style={[
                styles.primaryButton,
                { backgroundColor: buttonBackground },
                isLoading && styles.buttonDisabled,
              ]}
            >
              <ThemedText style={[styles.primaryButtonText, { color: buttonTextColor }]}>
                🔊 Replay
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleSkip}
              disabled={isLoading}
              style={[
                styles.secondaryButton,
                { borderColor: outlineColor },
                isLoading && styles.buttonDisabled,
              ]}
            >
              <ThemedText style={styles.secondaryButtonText}>⏭ Skip</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      {showCenterFlash && currentChord ? (
        <View pointerEvents="none" style={styles.centerFlashOverlay}>
          <View style={[styles.centerFlashCard, { backgroundColor: currentChord.color.hex }]}>
            {currentChordImageSource ? (
              <Image
                source={currentChordImageSource}
                style={styles.centerFlashImage}
                contentFit="contain"
                onError={() => {
                  console.log('[Eguchi] Center flash image missing, using emoji fallback', {
                    chord: currentChord.id,
                    uri:
                      typeof currentChordImageSource === 'number'
                        ? 'bundle'
                        : currentChordImageSource.uri,
                  });
                  markAnimalImageFailed(currentChord.id);
                }}
              />
            ) : (
              <ThemedText style={styles.centerFlashEmoji}>{ANIMAL_EMOJIS[currentChord.id]}</ThemedText>
            )}
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
    paddingVertical: 20,
    gap: 14,
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
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 2,
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    justifyContent: 'center',
    gap: GRID_GAP,
  },
  feedbackGridSpacer: {
    minHeight: 20,
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
  tileCorrect: {
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  tileIncorrect: {
    borderWidth: 4,
    borderColor: '#B71C1C',
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  feedbackCard: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  feedbackSubtitle: {
    fontSize: 13,
    opacity: 0.85,
  },
  autoAdvanceTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E2E2',
    overflow: 'hidden',
  },
  autoAdvanceFill: {
    height: '100%',
    backgroundColor: '#607D8B',
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  feedbackPrimaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
  },
  feedbackPrimaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  feedbackSecondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  feedbackSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  centerFlashOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  centerFlashCard: {
    width: 300,
    height: 300,
    borderRadius: 32,
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
  centerFlashEmoji: {
    fontSize: 182,
    lineHeight: 192,
  },
});
