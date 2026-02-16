import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
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
  createDefaultEguchiProgress,
  getProgressSnapshot,
  loadEguchiProgress,
  resetEguchiProgress,
  saveEguchiProgress,
  setChordUnlocked,
  type EguchiProgress,
} from '@/lib/eguchi/progress';

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const formatTimestamp = (isoTime: string | null) => (isoTime ? new Date(isoTime).toLocaleString() : 'Never');
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

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const [progress, setProgress] = useState<EguchiProgress | null>(null);
  const [audioMeta, setAudioMeta] = useState<EguchiAudioCacheMeta>(createDefaultEguchiAudioCacheMeta());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioProgress, setAudioProgress] = useState<{
    completed: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [loaded, loadedAudioMeta] = await Promise.all([
          loadEguchiProgress(),
          loadEguchiAudioCacheMeta(),
        ]);
        if (isMounted) {
          setProgress(loaded);
          setAudioMeta(loadedAudioMeta);
        }
      } catch (error) {
        console.warn('Failed to load Eguchi settings', error);
        if (isMounted) {
          setProgress(createDefaultEguchiProgress());
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
    setSaving(true);
    try {
      await saveEguchiProgress(nextProgress);
    } catch (error) {
      console.warn('Failed to save Eguchi settings', error);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleToggleChord = useCallback(
    (chordId: EguchiChordId, enabled: boolean) => {
      setProgress(previous => {
        const current = previous ?? createDefaultEguchiProgress();
        const next = setChordUnlocked(current, chordId, enabled);

        if (next === current) {
          console.log('[Eguchi] Kept at least one chord unlocked', {
            attemptedChord: chordId,
          });
          return current;
        }

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
    setSaving(true);
    try {
      const reset = await resetEguchiProgress();
      console.log('[Eguchi] Progress reset to defaults');
      setProgress(reset);
    } catch (error) {
      console.warn('Failed to reset Eguchi progress', error);
    } finally {
      setSaving(false);
    }
  }, []);

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

  const activeProgress = progress ?? createDefaultEguchiProgress();
  const snapshot = getProgressSnapshot(activeProgress);
  const tintColor = Colors[colorScheme ?? 'light'].tint;
  const iconColor = Colors[colorScheme ?? 'light'].icon;
  const audioProgressPercent = audioProgress
    ? Math.max(0, Math.min(1, audioProgress.completed / Math.max(1, audioProgress.total)))
    : 0;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Caregiver Settings' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Caregiver Settings
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Manage unlocked chords, offline audio, and local training data.
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
              {snapshot.todayCorrect}/{snapshot.todayAttempts} ({formatPercent(snapshot.todayAccuracy)})
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Total</ThemedText>
            <ThemedText style={styles.summaryValue}>
              {snapshot.totalCorrect}/{snapshot.totalAttempts} ({formatPercent(snapshot.totalAccuracy)})
            </ThemedText>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle">Unlocked Chords</ThemedText>
          {saving ? <ActivityIndicator size="small" color={tintColor} /> : null}
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={tintColor} />
        ) : (
          ORDERED_CHORD_IDS.map(chordId => {
            const chord = CHORD_BY_ID[chordId];
            const isEnabled = activeProgress.unlockedChordIds.includes(chordId);

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
                />
              </View>
            );
          })
        )}

        <Pressable
          onPress={handleResetProgress}
          accessibilityRole="button"
          style={[styles.resetButton, { borderColor: iconColor }]}
          disabled={saving || audioBusy}
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
            <ThemedText style={styles.summaryValue}>{formatBytes(audioMeta.cachedBytes)}</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Last cached</ThemedText>
            <ThemedText style={styles.summaryValue}>{formatTimestamp(audioMeta.lastCachedAt)}</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Last cleared</ThemedText>
            <ThemedText style={styles.summaryValue}>{formatTimestamp(audioMeta.lastClearedAt)}</ThemedText>
          </View>

          {audioProgress ? (
            <View style={styles.audioProgressContainer}>
              <ThemedText style={styles.audioProgressText}>
                {audioProgress.completed}/{audioProgress.total} · {audioProgress.fileName}
              </ThemedText>
              <View style={styles.audioProgressTrack}>
                <View style={[styles.audioProgressFill, { width: `${audioProgressPercent * 100}%` }]} />
              </View>
            </View>
          ) : null}

          {audioMessage ? <ThemedText style={styles.audioMessage}>{audioMessage}</ThemedText> : null}

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
              <ThemedText style={styles.audioPrimaryButtonText}>Download All for Offline</ThemedText>
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
          The app always keeps at least one chord unlocked so training stays playable.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 16,
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
  summaryCard: {
    borderWidth: 1,
    borderColor: '#D3D3D3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
