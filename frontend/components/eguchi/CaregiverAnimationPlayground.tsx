import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  ANIMATION_PLAYGROUND_DEFAULT_EXPANDED,
  ANIMAL_ANIMATION_DEMOS,
  getAnimalAnimationProfile,
  type AnimalAnimationDemoId,
} from '@/lib/eguchi/animal-animation';
import { getAnimalReactionPose } from '@/lib/eguchi/animal-animation-assets';
import { CHORD_ANIMAL_EMOJI_BY_ID, getChordAnimalImageSource } from '@/lib/eguchi/animal-assets';
import { CHORD_BY_ID, EGUCHI_CHORDS, type EguchiChordId } from '@/lib/eguchi/chords';
import { getAnimalImageRecyclingKey } from '@/lib/eguchi/training-feedback';
import { getEguchiTheme } from '@/lib/eguchi/theme';
import { TrainingAnimalTile } from './TrainingAnimalTile';

const DEFAULT_ANIMAL_CHORD_ID = 'C-E-G' as const;
const DEMO_BY_ID = new Map(ANIMAL_ANIMATION_DEMOS.map(demo => [demo.id, demo]));

export function CaregiverAnimationPlayground() {
  const colorScheme = useColorScheme();
  const theme = getEguchiTheme(colorScheme);
  const { width } = useWindowDimensions();
  const tileSize = width < 480 ? 164 : 206;
  const [expanded, setExpanded] = useState(ANIMATION_PLAYGROUND_DEFAULT_EXPANDED);
  const [selectedChordId, setSelectedChordId] = useState<EguchiChordId>(DEFAULT_ANIMAL_CHORD_ID);
  const [activeDemoId, setActiveDemoId] = useState<AnimalAnimationDemoId | null>(null);
  const [reactionNonce, setReactionNonce] = useState(0);
  const [failedBaseImages, setFailedBaseImages] = useState<Partial<Record<EguchiChordId, true>>>(
    {}
  );
  const [failedHintImages, setFailedHintImages] = useState<Partial<Record<EguchiChordId, true>>>(
    {}
  );
  const selectedChord = CHORD_BY_ID[selectedChordId];
  const animationProfile = getAnimalAnimationProfile(selectedChordId);
  const hintEmotion = animationProfile.hintEmotion;

  const imageSource = useMemo(
    () => (failedBaseImages[selectedChordId] ? null : getChordAnimalImageSource(selectedChordId)),
    [failedBaseImages, selectedChordId]
  );
  const hintImageSource = useMemo(
    () =>
      !hintEmotion || failedHintImages[selectedChordId]
        ? null
        : getChordAnimalImageSource(selectedChordId, undefined, {
            emotion: hintEmotion,
          }),
    [failedHintImages, hintEmotion, selectedChordId]
  );
  const activeDemo = activeDemoId ? DEMO_BY_ID.get(activeDemoId) : undefined;

  const handleSelectAnimal = useCallback((chordId: EguchiChordId) => {
    setSelectedChordId(chordId);
    setReactionNonce(previous => previous + 1);
  }, []);

  const handleSelectDemo = useCallback((id: AnimalAnimationDemoId) => {
    const demo = DEMO_BY_ID.get(id);
    if (!demo) return;
    setActiveDemoId(demo.id);
    setReactionNonce(previous => previous + 1);
  }, []);

  const handleReplayCurrent = useCallback(() => {
    handleSelectDemo(activeDemo?.id ?? 'hint');
  }, [activeDemo?.id, handleSelectDemo]);

  const handleBaseImageError = useCallback((chordId: EguchiChordId) => {
    setFailedBaseImages(previous =>
      previous[chordId] ? previous : { ...previous, [chordId]: true }
    );
  }, []);

  const handleHintImageError = useCallback((chordId: EguchiChordId) => {
    setFailedHintImages(previous =>
      previous[chordId] ? previous : { ...previous, [chordId]: true }
    );
  }, []);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? 'Hide animal reaction previews' : 'Show animal reaction previews'
        }
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(previous => !previous)}
        style={({ pressed }) => [styles.disclosure, pressed && styles.buttonPressed]}
      >
        <View style={styles.disclosureText}>
          <ThemedText style={styles.disclosureTitle}>Animal reaction previews</ThemedText>
          <ThemedText style={[styles.disclosureDetail, { color: theme.subtleText }]}>
            Optional visual test tools
          </ThemedText>
        </View>
        <IconSymbol
          name="chevron.right"
          size={22}
          color={theme.subtleText}
          style={expanded ? styles.disclosureIconExpanded : undefined}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.expandedContent}>
          <ThemedText style={[styles.intro, { color: theme.subtleText }]}>
            Choose an animal, then tap any reaction below. These demos never change practice
            progress.
          </ThemedText>

          <ThemedText style={styles.selectorLabel}>Choose an animal</ThemedText>
          <View style={styles.animalGrid}>
            {EGUCHI_CHORDS.map(chord => {
              const isSelected = selectedChordId === chord.id;
              return (
                <Pressable
                  key={chord.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview reactions for ${chord.animal}`}
                  accessibilityHint="Changes the animal shown in the reaction preview"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => handleSelectAnimal(chord.id)}
                  style={({ pressed }) => [
                    styles.animalButton,
                    {
                      backgroundColor: isSelected ? theme.successSurface : theme.surfaceMuted,
                      borderColor: isSelected ? theme.successBorder : theme.borderMuted,
                    },
                    isSelected && styles.animalButtonActive,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <ThemedText style={styles.animalEmoji}>
                    {CHORD_ANIMAL_EMOJI_BY_ID[chord.id]}
                  </ThemedText>
                  <ThemedText
                    numberOfLines={1}
                    style={[styles.animalButtonLabel, isSelected && styles.animalButtonLabelActive]}
                  >
                    {chord.animal}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View
            style={[
              styles.stage,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.borderMuted },
            ]}
          >
            <TrainingAnimalTile
              animal={`Preview ${selectedChord.animal} ${activeDemo?.label ?? 'Wink hint'}`}
              animationPose={getAnimalReactionPose(selectedChordId, activeDemo?.reaction ?? null)}
              backgroundColor={selectedChord.color.hex}
              disabled={false}
              emoji={CHORD_ANIMAL_EMOJI_BY_ID[selectedChordId]}
              hintImageRecyclingKey={
                hintEmotion
                  ? getAnimalImageRecyclingKey('caregiver-hint', selectedChordId, hintEmotion)
                  : undefined
              }
              hintImageSource={hintImageSource}
              imageRecyclingKey={getAnimalImageRecyclingKey('caregiver', selectedChordId, 'happy')}
              imageSource={imageSource}
              motionTarget={animationProfile.motionTarget}
              onHintImageError={() => handleHintImageError(selectedChordId)}
              onImageError={() => handleBaseImageError(selectedChordId)}
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
              {activeDemo
                ? `${selectedChord.animal}, ${activeDemo.label}: ${activeDemo.detail}`
                : `Choose a reaction for ${selectedChord.animal}.`}
            </ThemedText>
          </View>

          <View style={styles.demoGrid}>
            {ANIMAL_ANIMATION_DEMOS.map(demo => {
              const isActive = activeDemoId === demo.id;
              return (
                <Pressable
                  key={demo.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview ${demo.label} for ${selectedChord.animal}`}
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  disclosure: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  disclosureText: {
    flex: 1,
    gap: 2,
  },
  disclosureTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  disclosureDetail: {
    fontSize: 12,
    lineHeight: 16,
  },
  disclosureIconExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  expandedContent: {
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127, 127, 127, 0.28)',
  },
  intro: {
    fontSize: 13,
    lineHeight: 19,
  },
  selectorLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  animalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  animalButton: {
    minWidth: 96,
    maxWidth: 144,
    minHeight: 48,
    flexBasis: 104,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  animalButtonActive: {
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  animalEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  animalButtonLabel: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  animalButtonLabelActive: {
    fontWeight: '900',
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
