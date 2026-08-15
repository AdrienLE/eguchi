import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  ANIMAL_ANIMATION_DEMOS,
  getAnimalAnimationProfile,
  type AnimalAnimationDemoId,
} from '@/lib/eguchi/animal-animation';
import { getChordAnimalImageSource } from '@/lib/eguchi/animal-assets';
import { CHORD_BY_ID } from '@/lib/eguchi/chords';
import { getAnimalImageRecyclingKey } from '@/lib/eguchi/training-feedback';
import { getEguchiTheme } from '@/lib/eguchi/theme';
import { TrainingAnimalTile } from './TrainingAnimalTile';

const FOX_CHORD_ID = 'C-E-G' as const;
const FOX_CHORD = CHORD_BY_ID[FOX_CHORD_ID];
const FOX_ANIMATION_PROFILE = getAnimalAnimationProfile(FOX_CHORD_ID);
const DEMO_BY_ID = new Map(ANIMAL_ANIMATION_DEMOS.map(demo => [demo.id, demo]));

export function CaregiverAnimationPlayground() {
  const colorScheme = useColorScheme();
  const theme = getEguchiTheme(colorScheme);
  const { width } = useWindowDimensions();
  const tileSize = width < 480 ? 164 : 206;
  const [activeDemoId, setActiveDemoId] = useState<AnimalAnimationDemoId | null>(null);
  const [reactionNonce, setReactionNonce] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [hintImageFailed, setHintImageFailed] = useState(false);

  const imageSource = useMemo(
    () => (imageFailed ? null : getChordAnimalImageSource(FOX_CHORD_ID)),
    [imageFailed]
  );
  const hintImageSource = useMemo(
    () =>
      hintImageFailed
        ? null
        : getChordAnimalImageSource(FOX_CHORD_ID, undefined, {
            emotion: FOX_ANIMATION_PROFILE.hintEmotion,
          }),
    [hintImageFailed]
  );
  const activeDemo = activeDemoId ? DEMO_BY_ID.get(activeDemoId) : undefined;

  const handleSelectDemo = useCallback((id: AnimalAnimationDemoId) => {
    const demo = DEMO_BY_ID.get(id);
    if (!demo) return;
    setActiveDemoId(demo.id);
    setReactionNonce(previous => previous + 1);
  }, []);

  const handleReplayCurrent = useCallback(() => {
    handleSelectDemo(activeDemo?.id ?? 'hint');
  }, [activeDemo?.id, handleSelectDemo]);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ThemedText style={[styles.intro, { color: theme.subtleText }]}>
        Keep your eye on Fox, then tap any reaction below. These demos never change practice
        progress.
      </ThemedText>

      <View
        style={[
          styles.stage,
          { backgroundColor: theme.surfaceMuted, borderColor: theme.borderMuted },
        ]}
      >
        <TrainingAnimalTile
          animal="Fox animation preview"
          backgroundColor={FOX_CHORD.color.hex}
          disabled={false}
          emoji="🦊"
          hintImageRecyclingKey={getAnimalImageRecyclingKey('caregiver-hint', FOX_CHORD_ID, 'wink')}
          hintImageSource={hintImageSource}
          imageRecyclingKey={getAnimalImageRecyclingKey('caregiver', FOX_CHORD_ID, 'happy')}
          imageSource={imageSource}
          motionTarget={FOX_ANIMATION_PROFILE.motionTarget}
          onHintImageError={() => setHintImageFailed(true)}
          onImageError={() => setImageFailed(true)}
          onPress={handleReplayCurrent}
          reaction={activeDemo?.reaction ?? null}
          reactionNonce={reactionNonce}
          size={tileSize}
          textColor="#3C2415"
        />
        <ThemedText
          accessibilityLiveRegion="polite"
          style={[styles.nowPlaying, { color: theme.subtleText }]}
        >
          {activeDemo ? `${activeDemo.label}: ${activeDemo.detail}` : 'Choose a reaction below.'}
        </ThemedText>
      </View>

      <View style={styles.demoGrid}>
        {ANIMAL_ANIMATION_DEMOS.map(demo => {
          const isActive = activeDemoId === demo.id;
          return (
            <Pressable
              key={demo.id}
              accessibilityRole="button"
              accessibilityLabel={`Preview ${demo.label}`}
              accessibilityState={{ selected: isActive }}
              onPress={() => handleSelectDemo(demo.id)}
              style={({ pressed }) => [
                styles.demoButton,
                {
                  backgroundColor: isActive ? theme.successSurface : theme.surfaceMuted,
                  borderColor: isActive ? theme.successBorder : theme.borderMuted,
                },
                isActive && styles.demoButtonActive,
                pressed && styles.buttonPressed,
              ]}
            >
              <ThemedText style={styles.demoButtonLabel}>{demo.label}</ThemedText>
              <ThemedText style={[styles.demoButtonDetail, { color: theme.subtleText }]}>
                {demo.detail}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  intro: {
    fontSize: 13,
    lineHeight: 19,
  },
  stage: {
    minHeight: 244,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  nowPlaying: {
    minHeight: 36,
    maxWidth: 440,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  demoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoButton: {
    flexGrow: 1,
    flexBasis: 154,
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 2,
  },
  demoButtonActive: {
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  demoButtonLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  demoButtonDetail: {
    fontSize: 11,
    lineHeight: 15,
  },
  buttonPressed: {
    opacity: 0.76,
  },
});
