import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AUDIO_PACK_NAME } from '@/lib/eguchi/audio-pack';
import {
  clearEguchiAudioPackCache,
  createDefaultEguchiAudioCacheMeta,
  loadEguchiAudioCacheMeta,
  preloadEguchiAudioPack,
  type EguchiAudioCacheMeta,
} from '@/lib/eguchi/audio-cache';
import { CHORD_BY_ID, ORDERED_CHORD_IDS, type EguchiChordId } from '@/lib/eguchi/chords';
import {
  getNextLevelProgress,
  lockLastUnlockedLevel,
  unlockNextLevelManually,
} from '@/lib/eguchi/progression';
import {
  createDefaultEguchiProgress,
  getProgressSnapshot,
  loadEguchiProgress,
  resetEguchiProgress,
  saveEguchiProgress,
  setChordUnlocked,
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
  const [progressionMessage, setProgressionMessage] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioProgress, setAudioProgress] = useState<{
    completed: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);
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

  const handleToggleChord = useCallback(
    (chordId: EguchiChordId, enabled: boolean) => {
      setProgress(previous => {
        const next = setChordUnlocked(previous, chordId, enabled);
        if (next === previous) {
          setProgressionMessage('At least one chord must stay unlocked.');
          return previous;
        }

        setProgressionMessage(null);
        console.log('[Eguchi] Updated unlocked chords', {
          chord: chordId,
          enabled,
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
      setProgressionMessage('Progress reset. Back to level 1.');
    } catch (error) {
      console.warn('Failed to reset Eguchi progress', error);
    } finally {
      setSavingProgress(false);
    }
  }, []);

  const handleManualUnlockNext = useCallback(() => {
    setProgress(previous => {
      const next = unlockNextLevelManually(previous);
      if (next === previous) {
        setProgressionMessage('All levels are already unlocked.');
        return previous;
      }
      setProgressionMessage('Unlocked the next level manually.');
      void persistProgress(next);
      return next;
    });
  }, [persistProgress]);

  const handleManualLockLast = useCallback(() => {
    setProgress(previous => {
      const next = lockLastUnlockedLevel(previous);
      if (next === previous) {
        setProgressionMessage('Cannot lock below one unlocked chord.');
        return previous;
      }
      setProgressionMessage('Locked the latest level manually.');
      void persistProgress(next);
      return next;
    });
  }, [persistProgress]);

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

  const snapshot = getProgressSnapshot(progress);
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
              Manage level progression, unlocked chords, offline audio, and local data.
            </ThemedText>
            <ThemedText style={styles.subtitleNote}>
              No login is required. These settings are saved on this device.
            </ThemedText>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Unlocked chords</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {snapshot.unlockedCount}/{ORDERED_CHORD_IDS.length}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Today</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {snapshot.todayCorrect}/{snapshot.todayAttempts} (
                {formatPercent(snapshot.todayAccuracy)})
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Total</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {snapshot.totalCorrect}/{snapshot.totalAttempts} (
                {formatPercent(snapshot.totalAccuracy)})
              </ThemedText>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Next Level</ThemedText>
            {savingSession ? <ActivityIndicator size="small" color={tintColor} /> : null}
          </View>

          <View style={styles.progressionCard}>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Current level</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {progressionStatus.currentLevel}/{progressionStatus.totalLevels}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Next chord</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {progressionStatus.nextChordId
                  ? `${progressionStatus.nextChordAnimal} (${progressionStatus.nextChordId})`
                  : 'Complete'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Perfect-day streak</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {progressionStatus.perfectDayStreak}/{progressionStatus.perfectDaysRequired}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Today toward streak</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {progressionStatus.todaySummary.correct}/{progressionStatus.todaySummary.attempts}(
                target {progressionStatus.dailyAttemptTarget})
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Days to next unlock</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {progressionStatus.isMaxLevel ? '0' : progressionStatus.daysRemaining}
              </ThemedText>
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

            <View style={styles.manualRow}>
              <Pressable
                accessibilityRole="button"
                onPress={handleManualUnlockNext}
                disabled={loading || savingProgress}
                style={[styles.manualButton, { borderColor: iconColor }]}
              >
                <ThemedText style={styles.manualButtonText}>Unlock Next (Manual)</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleManualLockLast}
                disabled={loading || savingProgress}
                style={[styles.manualButton, { borderColor: iconColor }]}
              >
                <ThemedText style={styles.manualButtonText}>Lock Last (Manual)</ThemedText>
              </Pressable>
            </View>

            {progressionMessage ? (
              <ThemedText style={styles.progressionMessage}>{progressionMessage}</ThemedText>
            ) : null}
          </View>

          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Unlocked Chords</ThemedText>
            {savingProgress ? <ActivityIndicator size="small" color={tintColor} /> : null}
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={tintColor} />
          ) : (
            ORDERED_CHORD_IDS.map(chordId => {
              const chord = CHORD_BY_ID[chordId];
              const isEnabled = progress.unlockedChordIds.includes(chordId);

              return (
                <View key={chordId} style={styles.chordRow}>
                  <View style={styles.chordMeta}>
                    <View style={[styles.colorDot, { backgroundColor: chord.color.hex }]} />
                    <View>
                      <ThemedText style={styles.chordAnimal}>{chord.animal}</ThemedText>
                      <ThemedText style={styles.chordLabel}>
                        {chord.label} · {chord.color.name}
                      </ThemedText>
                    </View>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={enabled => handleToggleChord(chordId, enabled)}
                    trackColor={{ false: '#BDBDBD', true: `${tintColor}99` }}
                    thumbColor={isEnabled ? tintColor : iconColor}
                    disabled={loading}
                  />
                </View>
              );
            })
          )}

          <Pressable
            onPress={handleResetProgress}
            accessibilityRole="button"
            style={[styles.resetButton, { borderColor: iconColor }]}
            disabled={savingProgress || audioBusy}
          >
            <ThemedText style={styles.resetText}>Reset Progress</ThemedText>
          </Pressable>

          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Audio Pack</ThemedText>
            {audioBusy ? <ActivityIndicator size="small" color={tintColor} /> : null}
          </View>

          <View style={styles.audioCard}>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Pack</ThemedText>
              <ThemedText style={styles.summaryValue}>{AUDIO_PACK_NAME}</ThemedText>
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
                onPress={handleCacheAudioPack}
                disabled={audioBusy || loading}
                style={[
                  styles.audioPrimaryButton,
                  { backgroundColor: tintColor },
                  (audioBusy || loading) && styles.buttonDisabled,
                ]}
              >
                <ThemedText style={styles.audioPrimaryButtonText}>
                  Download All for Offline
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleClearAudioCache}
                disabled={audioBusy || loading}
                style={[
                  styles.audioSecondaryButton,
                  { borderColor: iconColor },
                  (audioBusy || loading) && styles.buttonDisabled,
                ]}
              >
                <ThemedText style={styles.audioSecondaryButtonText}>Clear Cached Audio</ThemedText>
              </Pressable>
            </View>
          </View>

          <ThemedText style={styles.note}>
            Manual controls are intentionally subtle for caregiver-only use while keeping child flow
            simple.
          </ThemedText>
        </View>
      </ScrollView>
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
    maxWidth: 760,
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
  summaryCard: {
    borderWidth: 1,
    borderColor: '#D3D3D3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  progressionCard: {
    borderWidth: 1,
    borderColor: '#D3D3D3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
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
  manualRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  manualButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressionMessage: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.8,
  },
  chordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  chordAnimal: {
    fontSize: 16,
    fontWeight: '600',
  },
  chordLabel: {
    fontSize: 12,
    opacity: 0.8,
  },
  resetButton: {
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '600',
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
    gap: 8,
  },
  audioPrimaryButton: {
    flex: 1,
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
  note: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.75,
    lineHeight: 18,
  },
});
