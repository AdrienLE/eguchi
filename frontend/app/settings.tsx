import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Platform,
  View,
  useWindowDimensions,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AUDIO_PACK_HASH, AUDIO_PACK_NAME } from '@/lib/eguchi/audio-pack';
import {
  checkEguchiAudioPackVersion,
  type EguchiAudioPackVersionCheck,
} from '@/lib/eguchi/audio-pack-version';
import {
  clearEguchiAudioPackCache,
  createDefaultEguchiAudioCacheMeta,
  loadEguchiAudioCacheMeta,
  preloadEguchiAudioPack,
  type EguchiAudioCacheMeta,
} from '@/lib/eguchi/audio-cache';
import { getChordAnimalImageSource } from '@/lib/eguchi/animal-assets';
import { CHORD_BY_ID, ORDERED_CHORD_IDS } from '@/lib/eguchi/chords';
import { getNextLevelProgress } from '@/lib/eguchi/progression';
import {
  MIN_UNLOCKED_CHORD_COUNT,
  createDefaultEguchiProgress,
  getProgressSnapshot,
  loadEguchiProgress,
  resetEguchiProgress,
  saveEguchiProgress,
  setUnlockedLevel,
  type EguchiProgress,
} from '@/lib/eguchi/progress';
import {
  createDefaultEguchiSessionPreferences,
  loadEguchiSessionPreferences,
  saveEguchiSessionPreferences,
  setAutoUnlockEnabled,
  setDailyAttemptTarget,
  setFeedbackSeconds,
  setPerfectDaysRequired,
  type EguchiSessionPreferences,
} from '@/lib/eguchi/session-preferences';
import {
  ANIMAL_GRID_GAP,
  SETTINGS_CONTENT_MAX_WIDTH,
  getSettingsAnimalGridLayout,
} from '@/lib/eguchi/settings-layout';

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const formatTimestamp = (isoTime: string | null) =>
  isoTime ? new Date(isoTime).toLocaleString() : 'Never';

const formatBytes = (bytes: number) => {
  if (!bytes) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const clampProgress = (value: number) => Math.max(0, Math.min(1, value));
const STEP_REPEAT_START_DELAY_MS = 300;
const STEP_REPEAT_INTERVAL_MS = 90;
const FEEDBACK_STEP_SECONDS = 0.25;

const formatFeedbackSeconds = (value: number) => value.toFixed(2).replace(/\.?0+$/, '');

const sanitizeIntegerInput = (value: string) => value.replace(/[^0-9]/g, '');

const sanitizeDecimalInput = (value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [integerPart, ...fractionParts] = cleaned.split('.');
  if (!fractionParts.length) {
    return integerPart;
  }
  const fraction = fractionParts.join('');
  return `${integerPart}.${fraction}`;
};

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { width: windowWidth } = useWindowDimensions();
  const [progress, setProgress] = useState<EguchiProgress>(createDefaultEguchiProgress());
  const [sessionPreferences, setSessionPreferences] = useState<EguchiSessionPreferences>(
    createDefaultEguchiSessionPreferences()
  );
  const [audioMeta, setAudioMeta] = useState<EguchiAudioCacheMeta>(
    createDefaultEguchiAudioCacheMeta()
  );
  const [loading, setLoading] = useState(true);
  const [savingProgress, setSavingProgress] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
  const [progressionMessage, setProgressionMessage] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioProgress, setAudioProgress] = useState<{
    completed: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);
  const [audioVersionBusy, setAudioVersionBusy] = useState(false);
  const [audioVersionCheck, setAudioVersionCheck] = useState<EguchiAudioPackVersionCheck | null>(
    null
  );
  const [perfectDaysDraft, setPerfectDaysDraft] = useState('14');
  const [dailyAttemptsDraft, setDailyAttemptsDraft] = useState('100');
  const [feedbackSecondsDraft, setFeedbackSecondsDraft] = useState('2');
  const stepRepeatStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRepeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [loadedProgress, loadedSessionPreferences, loadedAudioMeta] = await Promise.all([
          loadEguchiProgress(),
          loadEguchiSessionPreferences(),
          loadEguchiAudioCacheMeta(),
        ]);
        if (isMounted) {
          setProgress(loadedProgress);
          setSessionPreferences(loadedSessionPreferences);
          setAudioMeta(loadedAudioMeta);
        }
      } catch (error) {
        console.warn('Failed to load Eguchi settings', error);
        if (isMounted) {
          setProgress(createDefaultEguchiProgress());
          setSessionPreferences(createDefaultEguchiSessionPreferences());
          setAudioMeta(createDefaultEguchiAudioCacheMeta());
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const persistProgress = useCallback(async (nextProgress: EguchiProgress) => {
    setSavingProgress(true);
    try {
      await saveEguchiProgress(nextProgress);
    } catch (error) {
      console.warn('Failed to save Eguchi progress', error);
    } finally {
      setSavingProgress(false);
    }
  }, []);

  const persistSessionPreferences = useCallback(
    async (nextPreferences: EguchiSessionPreferences) => {
      setSavingSession(true);
      try {
        await saveEguchiSessionPreferences(nextPreferences);
      } catch (error) {
        console.warn('Failed to save Eguchi session preferences', error);
      } finally {
        setSavingSession(false);
      }
    },
    []
  );

  const handleSetUnlockedLevel = useCallback(
    (level: number) => {
      setProgress(previous => {
        const next = setUnlockedLevel(previous, level);
        if (next === previous) {
          return previous;
        }

        setProgressionMessage(`Training level set to ${next.unlockedChordIds.length}.`);
        console.log('[Eguchi] Updated training level', {
          level: next.unlockedChordIds.length,
          unlocked: next.unlockedChordIds,
        });
        void persistProgress(next);
        return next;
      });
    },
    [persistProgress]
  );

  const handleResetProgress = useCallback(async () => {
    setSavingProgress(true);
    try {
      const reset = await resetEguchiProgress();
      console.log('[Eguchi] Progress reset to defaults');
      setProgress(reset);
      setProgressionMessage(`Progress reset. Back to level ${reset.unlockedChordIds.length}.`);
    } catch (error) {
      console.warn('Failed to reset Eguchi progress', error);
    } finally {
      setSavingProgress(false);
    }
  }, []);

  const handleConfirmResetProgress = useCallback(async () => {
    setResetConfirmVisible(false);
    await handleResetProgress();
  }, [handleResetProgress]);

  const handleSessionUpdate = useCallback(
    (updater: (previous: EguchiSessionPreferences) => EguchiSessionPreferences) => {
      setSessionPreferences(previous => {
        const next = updater(previous);
        if (next !== previous) {
          void persistSessionPreferences(next);
        }
        return next;
      });
    },
    [persistSessionPreferences]
  );

  const clearStepRepeater = useCallback(() => {
    if (stepRepeatStartTimeoutRef.current) {
      clearTimeout(stepRepeatStartTimeoutRef.current);
      stepRepeatStartTimeoutRef.current = null;
    }
    if (stepRepeatIntervalRef.current) {
      clearInterval(stepRepeatIntervalRef.current);
      stepRepeatIntervalRef.current = null;
    }
  }, []);

  useEffect(() => () => clearStepRepeater(), [clearStepRepeater]);

  useEffect(() => {
    setPerfectDaysDraft(previous => {
      const next = String(sessionPreferences.perfectDaysRequired);
      return previous === next ? previous : next;
    });
    setDailyAttemptsDraft(previous => {
      const next = String(sessionPreferences.dailyAttemptTarget);
      return previous === next ? previous : next;
    });
    setFeedbackSecondsDraft(previous => {
      const next = formatFeedbackSeconds(sessionPreferences.feedbackSeconds);
      return previous === next ? previous : next;
    });
  }, [
    sessionPreferences.dailyAttemptTarget,
    sessionPreferences.feedbackSeconds,
    sessionPreferences.perfectDaysRequired,
  ]);

  const applyPerfectDaysDelta = useCallback(
    (delta: number) => {
      handleSessionUpdate(previous =>
        setPerfectDaysRequired(previous, previous.perfectDaysRequired + delta)
      );
    },
    [handleSessionUpdate]
  );

  const applyDailyAttemptsDelta = useCallback(
    (delta: number) => {
      handleSessionUpdate(previous =>
        setDailyAttemptTarget(previous, previous.dailyAttemptTarget + delta)
      );
    },
    [handleSessionUpdate]
  );

  const applyUnlockedLevelDelta = useCallback(
    (delta: number) => {
      handleSetUnlockedLevel(progress.unlockedChordIds.length + delta);
    },
    [handleSetUnlockedLevel, progress.unlockedChordIds.length]
  );

  const applyFeedbackSecondsDelta = useCallback(
    (delta: number) => {
      handleSessionUpdate(previous =>
        setFeedbackSeconds(previous, previous.feedbackSeconds + delta)
      );
    },
    [handleSessionUpdate]
  );

  const startRepeatingStep = useCallback(
    (stepAction: () => void) => {
      clearStepRepeater();
      stepRepeatStartTimeoutRef.current = setTimeout(() => {
        stepAction();
        stepRepeatIntervalRef.current = setInterval(stepAction, STEP_REPEAT_INTERVAL_MS);
      }, STEP_REPEAT_START_DELAY_MS);
    },
    [clearStepRepeater]
  );

  const commitPerfectDaysDraft = useCallback(() => {
    const parsed = Number.parseInt(perfectDaysDraft, 10);
    if (Number.isNaN(parsed)) {
      setPerfectDaysDraft(String(sessionPreferences.perfectDaysRequired));
      return;
    }
    handleSessionUpdate(previous => setPerfectDaysRequired(previous, parsed));
  }, [handleSessionUpdate, perfectDaysDraft, sessionPreferences.perfectDaysRequired]);

  const commitDailyAttemptsDraft = useCallback(() => {
    const parsed = Number.parseInt(dailyAttemptsDraft, 10);
    if (Number.isNaN(parsed)) {
      setDailyAttemptsDraft(String(sessionPreferences.dailyAttemptTarget));
      return;
    }
    handleSessionUpdate(previous => setDailyAttemptTarget(previous, parsed));
  }, [dailyAttemptsDraft, handleSessionUpdate, sessionPreferences.dailyAttemptTarget]);

  const commitFeedbackSecondsDraft = useCallback(() => {
    const parsed = Number.parseFloat(feedbackSecondsDraft);
    if (Number.isNaN(parsed)) {
      setFeedbackSecondsDraft(formatFeedbackSeconds(sessionPreferences.feedbackSeconds));
      return;
    }
    handleSessionUpdate(previous => setFeedbackSeconds(previous, parsed));
  }, [feedbackSecondsDraft, handleSessionUpdate, sessionPreferences.feedbackSeconds]);

  const refreshAudioMeta = useCallback(async () => {
    const latestMeta = await loadEguchiAudioCacheMeta();
    setAudioMeta(latestMeta);
  }, []);

  const handleCacheAudioPack = useCallback(async () => {
    setAudioBusy(true);
    setAudioMessage(null);
    try {
      const result = await preloadEguchiAudioPack({
        onProgress: progressUpdate => {
          setAudioProgress(progressUpdate);
        },
      });
      await refreshAudioMeta();
      setAudioMessage(
        result.failedFiles
          ? `Cached ${result.cachedFiles}/${result.totalFiles} files (${result.failedFiles} failed).`
          : `Cached ${result.cachedFiles}/${result.totalFiles} files for offline use.`
      );
      console.log('[Eguchi] Audio pack cached', result);
    } catch (error) {
      console.warn('Failed to cache audio pack', error);
      setAudioMessage('Audio cache failed. Check logs and try again.');
    } finally {
      setAudioBusy(false);
      setAudioProgress(null);
    }
  }, [refreshAudioMeta]);

  const handleClearAudioCache = useCallback(async () => {
    setAudioBusy(true);
    setAudioMessage(null);
    try {
      const result = await clearEguchiAudioPackCache({
        onProgress: progressUpdate => {
          setAudioProgress(progressUpdate);
        },
      });
      await refreshAudioMeta();
      setAudioMessage(
        `Cleared ${result.clearedFiles} files (${result.skippedFiles} skipped, ${result.failedFiles} failed).`
      );
      console.log('[Eguchi] Audio pack cache cleared', result);
    } catch (error) {
      console.warn('Failed to clear audio cache', error);
      setAudioMessage('Could not clear cached audio. Check logs and try again.');
    } finally {
      setAudioBusy(false);
      setAudioProgress(null);
    }
  }, [refreshAudioMeta]);

  const handleCheckAudioPackVersion = useCallback(async () => {
    setAudioVersionBusy(true);
    setAudioMessage(null);
    try {
      const result = await checkEguchiAudioPackVersion();
      setAudioVersionCheck(result);
      if (result.error) {
        setAudioMessage(`Server check unavailable: ${result.error}`);
      } else if (result.isCurrent) {
        setAudioMessage('Bundled audio matches the server pack.');
      } else {
        setAudioMessage('Server audio differs from this app bundle.');
      }
      console.log('[Eguchi] Audio pack version check', result);
    } catch (error) {
      console.warn('Failed to check audio pack version', error);
      setAudioVersionCheck(null);
      setAudioMessage('Could not check the server audio pack.');
    } finally {
      setAudioVersionBusy(false);
    }
  }, []);

  const snapshot = getProgressSnapshot(progress);
  const currentLevel = progress.unlockedChordIds.length;
  const animalGridLayout = getSettingsAnimalGridLayout(windowWidth);
  const animalGridCardWidth = animalGridLayout.cardWidth;
  const levelProgress = clampProgress(
    (currentLevel - MIN_UNLOCKED_CHORD_COUNT) /
      Math.max(1, ORDERED_CHORD_IDS.length - MIN_UNLOCKED_CHORD_COUNT)
  );
  const progressionStatus = useMemo(
    () =>
      getNextLevelProgress(progress, {
        autoUnlockEnabled: sessionPreferences.autoUnlockEnabled,
        perfectDaysRequired: sessionPreferences.perfectDaysRequired,
        dailyAttemptTarget: sessionPreferences.dailyAttemptTarget,
      }),
    [progress, sessionPreferences]
  );
  const streakProgress = progressionStatus.isMaxLevel
    ? 1
    : clampProgress(
        progressionStatus.perfectDayStreak / Math.max(1, progressionStatus.perfectDaysRequired)
      );

  const tintColor = Colors[colorScheme ?? 'light'].tint;
  const iconColor = Colors[colorScheme ?? 'light'].icon;
  const audioProgressPercent = audioProgress
    ? clampProgress(audioProgress.completed / Math.max(1, audioProgress.total))
    : 0;
  const nativeAudioBundleLabel = Platform.OS === 'web' ? 'Web bundle' : 'Included in app';
  const audioVersionCheckLabel = audioVersionCheck
    ? audioVersionCheck.error
      ? 'Unavailable'
      : audioVersionCheck.isCurrent
        ? 'Current'
        : 'Update available'
    : 'Not checked';
  const audioControlsDisabled = audioBusy || audioVersionBusy || loading;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Caregiver Settings',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close settings"
              onPress={() => router.back()}
              hitSlop={8}
              style={[
                styles.closeButton,
                {
                  backgroundColor: colorScheme === 'dark' ? '#2F3438' : '#EFF3F6',
                  borderColor: colorScheme === 'dark' ? '#4A5157' : '#D2D9DE',
                },
              ]}
            >
              <IconSymbol size={18} name="xmark" color={iconColor} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Caregiver Settings
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Manage training level, progression goals, offline audio, and local data.
            </ThemedText>
            <ThemedText style={styles.subtitleNote}>
              No login is required. These settings are saved on this device.
            </ThemedText>
          </View>

          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Practice Progress</ThemedText>
            {savingSession ? <ActivityIndicator size="small" color={tintColor} /> : null}
          </View>

          <View style={styles.progressionCard}>
            <View style={styles.metricGrid}>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricLabel}>Today</ThemedText>
                <ThemedText style={styles.metricValue}>
                  {progressionStatus.todaySummary.correct}/{progressionStatus.todaySummary.attempts}
                </ThemedText>
                <ThemedText style={styles.metricDetail}>
                  target {progressionStatus.dailyAttemptTarget}
                </ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricLabel}>Perfect-day streak</ThemedText>
                <ThemedText style={styles.metricValue}>
                  {progressionStatus.perfectDayStreak}/{progressionStatus.perfectDaysRequired}
                </ThemedText>
                <ThemedText style={styles.metricDetail}>
                  {progressionStatus.isTodayPerfect ? 'today is perfect' : 'today in progress'}
                </ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricLabel}>Days to unlock</ThemedText>
                <ThemedText style={styles.metricValue}>
                  {progressionStatus.isMaxLevel ? '0' : progressionStatus.daysRemaining}
                </ThemedText>
                <ThemedText style={styles.metricDetail}>
                  {progressionStatus.isMaxLevel ? 'all animals active' : 'until next animal'}
                </ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricLabel}>Total accuracy</ThemedText>
                <ThemedText style={styles.metricValue}>
                  {formatPercent(snapshot.totalAccuracy)}
                </ThemedText>
                <ThemedText style={styles.metricDetail}>{snapshot.totalAttempts} rounds</ThemedText>
              </View>
            </View>

            <View style={styles.streakTrack}>
              <View style={[styles.streakFill, { width: `${streakProgress * 100}%` }]} />
            </View>

            <View style={styles.controlRow}>
              <ThemedText style={styles.controlLabel}>Auto unlock</ThemedText>
              <Switch
                value={sessionPreferences.autoUnlockEnabled}
                onValueChange={enabled =>
                  handleSessionUpdate(previous => setAutoUnlockEnabled(previous, enabled))
                }
                trackColor={{ false: '#BDBDBD', true: `${tintColor}99` }}
                thumbColor={sessionPreferences.autoUnlockEnabled ? tintColor : iconColor}
                disabled={loading}
              />
            </View>

            <View style={styles.stepperRow}>
              <ThemedText style={styles.controlLabel}>Perfect days needed</ThemedText>
              <View style={styles.stepperControls}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => applyPerfectDaysDelta(-1)}
                  onPressIn={() => startRepeatingStep(() => applyPerfectDaysDelta(-1))}
                  onPressOut={clearStepRepeater}
                  style={[styles.stepButton, { borderColor: iconColor }]}
                  disabled={loading}
                >
                  <ThemedText style={styles.stepButtonText}>-</ThemedText>
                </Pressable>
                <ThemedTextInput
                  value={perfectDaysDraft}
                  onChangeText={value => setPerfectDaysDraft(sanitizeIntegerInput(value))}
                  onBlur={commitPerfectDaysDraft}
                  onSubmitEditing={commitPerfectDaysDraft}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  selectTextOnFocus
                  editable={!loading}
                  style={[styles.stepInput, { borderColor: iconColor }]}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => applyPerfectDaysDelta(1)}
                  onPressIn={() => startRepeatingStep(() => applyPerfectDaysDelta(1))}
                  onPressOut={clearStepRepeater}
                  style={[styles.stepButton, { borderColor: iconColor }]}
                  disabled={loading}
                >
                  <ThemedText style={styles.stepButtonText}>+</ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.stepperRow}>
              <ThemedText style={styles.controlLabel}>Daily attempts target</ThemedText>
              <View style={styles.stepperControls}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => applyDailyAttemptsDelta(-1)}
                  onPressIn={() => startRepeatingStep(() => applyDailyAttemptsDelta(-1))}
                  onPressOut={clearStepRepeater}
                  style={[styles.stepButton, { borderColor: iconColor }]}
                  disabled={loading}
                >
                  <ThemedText style={styles.stepButtonText}>-</ThemedText>
                </Pressable>
                <ThemedTextInput
                  value={dailyAttemptsDraft}
                  onChangeText={value => setDailyAttemptsDraft(sanitizeIntegerInput(value))}
                  onBlur={commitDailyAttemptsDraft}
                  onSubmitEditing={commitDailyAttemptsDraft}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  selectTextOnFocus
                  editable={!loading}
                  style={[styles.stepInput, { borderColor: iconColor }]}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => applyDailyAttemptsDelta(1)}
                  onPressIn={() => startRepeatingStep(() => applyDailyAttemptsDelta(1))}
                  onPressOut={clearStepRepeater}
                  style={[styles.stepButton, { borderColor: iconColor }]}
                  disabled={loading}
                >
                  <ThemedText style={styles.stepButtonText}>+</ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.stepperRow}>
              <ThemedText style={styles.controlLabel}>Answer reveal seconds</ThemedText>
              <View style={styles.stepperControls}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => applyFeedbackSecondsDelta(-FEEDBACK_STEP_SECONDS)}
                  onPressIn={() =>
                    startRepeatingStep(() => applyFeedbackSecondsDelta(-FEEDBACK_STEP_SECONDS))
                  }
                  onPressOut={clearStepRepeater}
                  style={[styles.stepButton, { borderColor: iconColor }]}
                  disabled={loading}
                >
                  <ThemedText style={styles.stepButtonText}>-</ThemedText>
                </Pressable>
                <ThemedTextInput
                  value={feedbackSecondsDraft}
                  onChangeText={value => setFeedbackSecondsDraft(sanitizeDecimalInput(value))}
                  onBlur={commitFeedbackSecondsDraft}
                  onSubmitEditing={commitFeedbackSecondsDraft}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  selectTextOnFocus
                  editable={!loading}
                  style={[styles.stepInput, { borderColor: iconColor }]}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => applyFeedbackSecondsDelta(FEEDBACK_STEP_SECONDS)}
                  onPressIn={() =>
                    startRepeatingStep(() => applyFeedbackSecondsDelta(FEEDBACK_STEP_SECONDS))
                  }
                  onPressOut={clearStepRepeater}
                  style={[styles.stepButton, { borderColor: iconColor }]}
                  disabled={loading}
                >
                  <ThemedText style={styles.stepButtonText}>+</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Training Level</ThemedText>
            {savingProgress ? <ActivityIndicator size="small" color={tintColor} /> : null}
          </View>

          <View style={styles.levelCard}>
            <View style={styles.levelHeaderRow}>
              <View style={styles.levelTitleGroup}>
                <ThemedText style={styles.levelLabel}>Active animals</ThemedText>
                <ThemedText style={styles.levelValue}>
                  Level {currentLevel} of {ORDERED_CHORD_IDS.length}
                </ThemedText>
              </View>
              <View style={styles.levelStepControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Lower training level"
                  onPress={() => applyUnlockedLevelDelta(-1)}
                  disabled={loading || savingProgress || currentLevel <= MIN_UNLOCKED_CHORD_COUNT}
                  style={[
                    styles.levelStepButton,
                    { borderColor: iconColor },
                    (loading || savingProgress || currentLevel <= MIN_UNLOCKED_CHORD_COUNT) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <IconSymbol size={20} name="minus" color={iconColor} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Raise training level"
                  onPress={() => applyUnlockedLevelDelta(1)}
                  disabled={loading || savingProgress || currentLevel >= ORDERED_CHORD_IDS.length}
                  style={[
                    styles.levelStepButton,
                    { borderColor: iconColor },
                    (loading || savingProgress || currentLevel >= ORDERED_CHORD_IDS.length) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <IconSymbol size={20} name="plus" color={iconColor} />
                </Pressable>
              </View>
            </View>

            <View style={styles.levelTrack}>
              <View style={[styles.levelFill, { width: `${levelProgress * 100}%` }]} />
            </View>

            <ThemedText style={styles.levelHint}>
              Level follows the fixed animal order below.
            </ThemedText>

            <View style={styles.animalLevelGrid}>
              {ORDERED_CHORD_IDS.map((chordId, index) => {
                const chord = CHORD_BY_ID[chordId];
                const animalLevel = Math.max(MIN_UNLOCKED_CHORD_COUNT, index + 1);
                const isEnabled = index < currentLevel;
                const isCurrentLevel = index + 1 === currentLevel;
                const imageSource = getChordAnimalImageSource(chordId);
                const statusLabel = isCurrentLevel ? 'Current' : isEnabled ? 'Active' : 'Locked';

                return (
                  <Pressable
                    key={chordId}
                    accessibilityRole="button"
                    accessibilityLabel={`Set training level through ${chord.animal}`}
                    onPress={() => handleSetUnlockedLevel(animalLevel)}
                    disabled={loading || savingProgress}
                    style={[
                      styles.animalLevelCard,
                      {
                        width: animalGridCardWidth,
                        borderColor: isCurrentLevel
                          ? tintColor
                          : isEnabled
                            ? chord.color.hex
                            : '#D7DDE2',
                      },
                      !isEnabled && styles.animalLevelCardLocked,
                      isCurrentLevel && styles.animalLevelCardCurrent,
                      (loading || savingProgress) && styles.buttonDisabled,
                    ]}
                  >
                    <View
                      style={[
                        styles.animalLevelStripe,
                        { backgroundColor: isEnabled ? chord.color.hex : '#D3D9DE' },
                      ]}
                    />
                    <View style={styles.animalLevelTopRow}>
                      <View
                        style={[
                          styles.animalLevelNumber,
                          { backgroundColor: isEnabled ? tintColor : '#E2E6EA' },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.animalLevelNumberText,
                            isEnabled && styles.animalLevelNumberTextEnabled,
                          ]}
                        >
                          {index + 1}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.animalLevelStatus,
                          isEnabled && { backgroundColor: `${tintColor}22` },
                        ]}
                      >
                        <ThemedText
                          style={[styles.animalLevelStatusText, isEnabled && { color: tintColor }]}
                        >
                          {statusLabel}
                        </ThemedText>
                      </View>
                    </View>
                    {imageSource ? (
                      <Image
                        source={imageSource}
                        style={[
                          styles.animalLevelImage,
                          !isEnabled && styles.animalLevelImageLocked,
                        ]}
                        contentFit="contain"
                      />
                    ) : (
                      <View style={styles.animalLevelImageFallback} />
                    )}
                    <ThemedText
                      style={[styles.animalLevelAnimal, !isEnabled && styles.animalLevelTextLocked]}
                    >
                      {chord.animal}
                    </ThemedText>
                    <ThemedText
                      style={[styles.animalLevelChord, !isEnabled && styles.animalLevelTextLocked]}
                    >
                      {chord.label}
                    </ThemedText>
                    <View style={styles.animalLevelColorRow}>
                      <View
                        style={[
                          styles.colorDot,
                          { backgroundColor: isEnabled ? chord.color.hex : '#B8C0C7' },
                        ]}
                      />
                      <ThemedText
                        style={[
                          styles.animalLevelColorText,
                          !isEnabled && styles.animalLevelTextLocked,
                        ]}
                      >
                        {chord.color.name}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {progressionMessage ? (
              <ThemedText style={styles.progressionMessage}>{progressionMessage}</ThemedText>
            ) : null}
          </View>

          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Audio Pack</ThemedText>
            {audioBusy || audioVersionBusy ? (
              <ActivityIndicator size="small" color={tintColor} />
            ) : null}
          </View>

          <View style={styles.audioCard}>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Pack</ThemedText>
              <ThemedText style={styles.summaryValue}>{AUDIO_PACK_NAME}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Native bundle</ThemedText>
              <ThemedText style={styles.summaryValue}>{nativeAudioBundleLabel}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Pack hash</ThemedText>
              <ThemedText style={styles.summaryValue}>{AUDIO_PACK_HASH.slice(0, 12)}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Server check</ThemedText>
              <ThemedText style={styles.summaryValue}>{audioVersionCheckLabel}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Cached files</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {audioMeta.cachedFiles}/{audioMeta.totalFiles}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Disk usage</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {formatBytes(audioMeta.cachedBytes)}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Last cached</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {formatTimestamp(audioMeta.lastCachedAt)}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Last cleared</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {formatTimestamp(audioMeta.lastClearedAt)}
              </ThemedText>
            </View>

            {audioProgress ? (
              <View style={styles.audioProgressContainer}>
                <ThemedText style={styles.audioProgressText}>
                  {audioProgress.completed}/{audioProgress.total} · {audioProgress.fileName}
                </ThemedText>
                <View style={styles.audioProgressTrack}>
                  <View
                    style={[styles.audioProgressFill, { width: `${audioProgressPercent * 100}%` }]}
                  />
                </View>
              </View>
            ) : null}

            {audioMessage ? (
              <ThemedText style={styles.audioMessage}>{audioMessage}</ThemedText>
            ) : null}

            <View style={styles.audioButtonRow}>
              <Pressable
                accessibilityRole="button"
                onPress={handleCheckAudioPackVersion}
                disabled={audioControlsDisabled}
                style={[
                  styles.audioSecondaryButton,
                  { borderColor: iconColor },
                  audioControlsDisabled && styles.buttonDisabled,
                ]}
              >
                <ThemedText style={styles.audioSecondaryButtonText}>Check Server</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleCacheAudioPack}
                disabled={audioControlsDisabled}
                style={[
                  styles.audioPrimaryButton,
                  { backgroundColor: tintColor },
                  audioControlsDisabled && styles.buttonDisabled,
                ]}
              >
                <ThemedText style={styles.audioPrimaryButtonText}>Download All</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleClearAudioCache}
                disabled={audioControlsDisabled}
                style={[
                  styles.audioSecondaryButton,
                  { borderColor: iconColor },
                  audioControlsDisabled && styles.buttonDisabled,
                ]}
              >
                <ThemedText style={styles.audioSecondaryButtonText}>Clear Cache</ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Danger Zone</ThemedText>
            {savingProgress ? <ActivityIndicator size="small" color="#B42318" /> : null}
          </View>

          <View style={styles.dangerCard}>
            <ThemedText style={styles.dangerText}>
              Reset removes local training history, streaks, and unlocked animals on this device.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset progress"
              onPress={() => setResetConfirmVisible(true)}
              disabled={loading || savingProgress}
              style={[styles.dangerButton, (loading || savingProgress) && styles.buttonDisabled]}
            >
              <ThemedText style={styles.dangerButtonText}>Reset Progress</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={resetConfirmVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => setResetConfirmVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.resetModal}>
            <ThemedText style={styles.resetModalTitle}>Reset progress?</ThemedText>
            <ThemedText style={styles.resetModalBody}>
              This clears training history, streaks, and unlocked animals on this device. This
              cannot be undone.
            </ThemedText>
            <View style={styles.resetModalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setResetConfirmVisible(false)}
                style={styles.resetCancelButton}
              >
                <ThemedText style={styles.resetCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleConfirmResetProgress}
                disabled={savingProgress}
                style={[styles.resetConfirmButton, savingProgress && styles.buttonDisabled]}
              >
                <ThemedText style={styles.resetConfirmText}>Reset</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    paddingBottom: 56,
  },
  content: {
    width: '100%',
    maxWidth: SETTINGS_CONTENT_MAX_WIDTH,
    gap: 16,
  },
  closeButton: {
    marginRight: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  subtitleNote: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.75,
    lineHeight: 18,
  },
  progressionCard: {
    borderWidth: 1,
    borderColor: '#D3D3D3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  levelCard: {
    borderWidth: 1,
    borderColor: '#D3D3D3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  levelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  levelTitleGroup: {
    flexShrink: 1,
  },
  levelLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.75,
  },
  levelValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  levelStepControls: {
    flexDirection: 'row',
    gap: 8,
  },
  levelStepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E1E5E8',
  },
  levelFill: {
    height: '100%',
    backgroundColor: '#1B8B4D',
  },
  animalLevelGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ANIMAL_GRID_GAP,
  },
  animalLevelCard: {
    minHeight: 132,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 9,
    gap: 3,
  },
  animalLevelCardCurrent: {
    borderWidth: 2,
  },
  animalLevelCardLocked: {
    backgroundColor: '#F3F5F6',
  },
  animalLevelStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  animalLevelTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  animalLevelNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animalLevelNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#45515A',
  },
  animalLevelNumberTextEnabled: {
    color: '#FFFFFF',
  },
  animalLevelStatus: {
    borderRadius: 999,
    backgroundColor: '#E1E5E8',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  animalLevelStatusText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    color: '#5B6670',
  },
  animalLevelImage: {
    width: '100%',
    height: 48,
    marginTop: 1,
  },
  animalLevelImageLocked: {
    opacity: 0.28,
  },
  animalLevelImageFallback: {
    height: 48,
  },
  animalLevelAnimal: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  animalLevelChord: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    opacity: 0.82,
    textAlign: 'center',
  },
  animalLevelColorRow: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  animalLevelColorText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    opacity: 0.78,
  },
  animalLevelTextLocked: {
    opacity: 0.5,
  },
  levelHint: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.75,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'right',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricTile: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 142,
    borderWidth: 1,
    borderColor: '#E1E5E8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#F8FAFA',
    gap: 2,
  },
  metricLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    opacity: 0.68,
  },
  metricValue: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
  },
  metricDetail: {
    fontSize: 11,
    lineHeight: 14,
    opacity: 0.72,
  },
  streakTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E1E1E1',
  },
  streakFill: {
    height: '100%',
    backgroundColor: '#1B8B4D',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  stepValue: {
    minWidth: 24,
    textAlign: 'center',
    fontWeight: '600',
  },
  stepInput: {
    width: 68,
    height: 32,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: '600',
    paddingVertical: 0,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  progressionMessage: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.8,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  audioCard: {
    borderWidth: 1,
    borderColor: '#D3D3D3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  audioProgressContainer: {
    gap: 6,
    marginTop: 4,
  },
  audioProgressText: {
    fontSize: 12,
    opacity: 0.8,
  },
  audioProgressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E1E1E1',
  },
  audioProgressFill: {
    height: '100%',
    backgroundColor: '#2E7D32',
  },
  audioMessage: {
    fontSize: 12,
    lineHeight: 17,
  },
  audioButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  audioPrimaryButton: {
    flex: 1,
    minWidth: 140,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  audioPrimaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  audioSecondaryButton: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  audioSecondaryButtonText: {
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: '#FDA29B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#FEF3F2',
  },
  dangerText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#7A271A',
  },
  dangerButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#B42318',
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(16, 24, 40, 0.58)',
  },
  resetModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  resetModalTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#101828',
  },
  resetModalBody: {
    fontSize: 15,
    lineHeight: 21,
    color: '#344054',
  },
  resetModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 2,
  },
  resetCancelButton: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  resetCancelText: {
    color: '#344054',
    fontSize: 14,
    fontWeight: '700',
  },
  resetConfirmButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#B42318',
  },
  resetConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
