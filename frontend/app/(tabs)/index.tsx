import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Audio } from 'expo-av';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  CHORD_BY_ID,
  DEFAULT_UNLOCKED_CHORD_IDS,
  type EguchiChordId,
} from '@/lib/eguchi/chords';
import { pickRandomAudioModule } from '@/lib/eguchi/audio-pack';

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

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const unlockedChordIds = DEFAULT_UNLOCKED_CHORD_IDS;
  const unlockedChords = unlockedChordIds.map(id => CHORD_BY_ID[id]);
  const [currentChordId, setCurrentChordId] = useState<EguchiChordId | null>(null);
  const [lastAnswerId, setLastAnswerId] = useState<EguchiChordId | null>(null);
  const [lastResult, setLastResult] = useState<'correct' | 'incorrect' | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

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

  const playChord = useCallback(
    async (chordId: EguchiChordId) => {
      const source = pickRandomAudioModule(chordId);
      if (!source) {
        console.warn('No audio file available for chord', chordId);
        return;
      }
      await stopSound();
      try {
        const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true });
        soundRef.current = sound;
      } catch (error) {
        console.warn('Failed to play chord audio', error);
      }
    },
    [stopSound]
  );

  const startNewTrial = useCallback(() => {
    clearAdvanceTimer();
    setLastAnswerId(null);
    setLastResult(null);
    const nextChordId = pickRandomChordId(unlockedChordIds);
    setCurrentChordId(nextChordId);
    void playChord(nextChordId);
  }, [clearAdvanceTimer, unlockedChordIds, playChord]);

  const handleAnswer = useCallback(
    (id: EguchiChordId) => {
      if (!currentChordId) return;
      setLastAnswerId(id);
      setLastResult(id === currentChordId ? 'correct' : 'incorrect');
      clearAdvanceTimer();
      advanceTimer.current = setTimeout(() => {
        startNewTrial();
      }, AUTO_ADVANCE_MS);
    },
    [clearAdvanceTimer, currentChordId, startNewTrial]
  );

  const handleReplay = useCallback(() => {
    setLastAnswerId(null);
    setLastResult(null);
    if (currentChordId) {
      void playChord(currentChordId);
    }
  }, [currentChordId, playChord]);

  useEffect(() => {
    startNewTrial();
    return () => {
      clearAdvanceTimer();
      void stopSound();
    };
  }, [clearAdvanceTimer, startNewTrial, stopSound]);

  const buttonBackground = Colors[colorScheme ?? 'light'].tint;
  const buttonTextColor = colorScheme === 'light' ? '#FFFFFF' : '#111111';
  const outlineColor = Colors[colorScheme ?? 'light'].icon;

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
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            onPress={startNewTrial}
            style={[styles.primaryButton, { backgroundColor: buttonBackground }]}
          >
            <ThemedText style={[styles.primaryButtonText, { color: buttonTextColor }]}>
              Play
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={handleReplay}
            style={[styles.secondaryButton, { borderColor: outlineColor }]}
          >
            <ThemedText style={styles.secondaryButtonText}>Replay</ThemedText>
          </Pressable>
        </View>
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
                onPress={() => handleAnswer(chord.id)}
                style={[
                  styles.tile,
                  { backgroundColor: chord.color.hex },
                  isCorrectTile && styles.tileCorrect,
                  isWrongSelection && styles.tileIncorrect,
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
});
