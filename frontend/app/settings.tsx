import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
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

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const [progress, setProgress] = useState<EguchiProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const loaded = await loadEguchiProgress();
        if (isMounted) {
          setProgress(loaded);
        }
      } catch (error) {
        console.warn('Failed to load Eguchi settings', error);
        if (isMounted) {
          setProgress(createDefaultEguchiProgress());
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

  const activeProgress = progress ?? createDefaultEguchiProgress();
  const snapshot = getProgressSnapshot(activeProgress);
  const tintColor = Colors[colorScheme ?? 'light'].tint;
  const iconColor = Colors[colorScheme ?? 'light'].icon;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Caregiver Settings' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Caregiver Settings
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Choose unlocked chords and reset progress.
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
        >
          <ThemedText style={styles.resetText}>Reset Progress</ThemedText>
        </Pressable>

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
  note: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.75,
    lineHeight: 18,
  },
});
