import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { pickRandomAudioEntry, type AudioEntry } from '@/lib/eguchi/audio-pack';
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
  createDefaultEguchiSessionPreferences,
  loadEguchiSessionPreferences,
  type EguchiSessionPreferences,
} from '@/lib/eguchi/session-preferences';

const AUTO_ADVANCE_MS = 900;

const getReadableTextColor = (hex: string) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '#111111';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111111' : '#FFFFFF';
};

const pickRandomChordId = (ids: EguchiChordId[]) =>
  ids[Math.floor(Math.random() * ids.length)];

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const clampProgress = (value: number) => Math.max(0, Math.min(1, value));

export default function HomeScreen() {
  const colorScheme = useColorScheme();
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
  const soundRef = useRef<Audio.Sound | null>(null);
  const currentChordRef = useRef<EguchiChordId | null>(null);
  const currentAudioRef = useRef<AudioEntry | null>(null);
  const hasAnsweredCurrentTrialRef = useRef(false);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
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

      clearAdvanceTimer();
      advanceTimer.current = setTimeout(() => {
        startNewTrial();
      }, AUTO_ADVANCE_MS);
    },
    [clearAdvanceTimer, isLoading, sessionPreferences, startNewTrial]
  );

  const handleReplay = useCallback(() => {
    if (!currentChordRef.current || !currentAudioRef.current) {
      startNewTrial();
      return;
    }
    void playCurrentAudio();
  }, [playCurrentAudio, startNewTrial]);

  const handleSkip = useCallback(() => {
    startNewTrial();
  }, [startNewTrial]);

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

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Eguchi Training
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Listen, then tap the animal you hear.
          </ThemedText>
        </View>
        {progressionStatus ? (
          <View style={styles.missionCard}>
            <ThemedText style={styles.missionTitle}>Today's Mission</ThemedText>
            <ThemedText style={styles.missionSubtitle}>
              Play {progressionStatus.dailyAttemptTarget} rounds today.
            </ThemedText>

            <View style={styles.missionRow}>
              <ThemedText style={styles.missionLabel}>Rounds</ThemedText>
              <ThemedText style={styles.missionValue}>
                {progressionStatus.todaySummary.attempts}/{progressionStatus.dailyAttemptTarget}
              </ThemedText>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${missionProgress * 100}%` }]} />
            </View>

            <View style={styles.missionRow}>
              <ThemedText style={styles.missionLabel}>Great guesses</ThemedText>
              <ThemedText style={styles.missionValue}>
                {progressionStatus.todaySummary.correct}/{progressionStatus.todaySummary.attempts}{' '}
                ({formatPercent(successProgress)})
              </ThemedText>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, styles.successFill, { width: `${successProgress * 100}%` }]}
              />
            </View>

            <View style={styles.missionRow}>
              <ThemedText style={styles.missionLabel}>Star days</ThemedText>
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
                ? `Keep going to meet ${progressionStatus.nextChordAnimal} soon.`
                : 'Amazing. You found all the animal sounds.'}
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
              Replay
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
            <ThemedText style={styles.secondaryButtonText}>Skip</ThemedText>
          </Pressable>
        </View>
        {isLoading ? <ActivityIndicator /> : null}
        <View style={styles.grid}>
          {unlockedChords.map(chord => {
            const showCorrect = lastResult !== null;
            const isCorrectTile = showCorrect && currentChordId === chord.id;
            const isWrongSelection =
              lastResult === 'incorrect' && lastAnswerId === chord.id && !isCorrectTile;
            const tileTextColor = getReadableTextColor(chord.color.hex);

            return (
              <Pressable
                key={chord.id}
                accessibilityRole="button"
                disabled={isLoading}
                onPress={() => handleAnswer(chord.id)}
                style={[
                  styles.tile,
                  { backgroundColor: chord.color.hex },
                  isCorrectTile && styles.tileCorrect,
                  isWrongSelection && styles.tileIncorrect,
                  isLoading && styles.buttonDisabled,
                ]}
              >
                <ThemedText style={[styles.tileLabel, { color: tileTextColor }]}>
                  {chord.animal}
                </ThemedText>
                <ThemedText style={[styles.tileSubLabel, { color: tileTextColor }]}>
                  {chord.color.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 20,
  },
  header: { alignItems: 'center', gap: 8 },
  title: { textAlign: 'center' },
  subtitle: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  missionCard: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 7,
  },
  missionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  missionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
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
    justifyContent: 'space-between',
    gap: 12,
  },
  tile: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  tileLabel: { fontSize: 20, fontWeight: '700' },
  tileSubLabel: { fontSize: 12, marginTop: 6, opacity: 0.8 },
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
});
