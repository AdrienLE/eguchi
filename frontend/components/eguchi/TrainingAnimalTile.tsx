import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import type { AnimalMotionTarget } from '@/lib/eguchi/animal-animation';

export type TrainingTileReaction = 'hint' | 'not-me' | 'assisted' | 'celebrate' | null;

type TrainingAnimalTileProps = {
  animal: string;
  backgroundColor: string;
  disabled: boolean;
  emoji: string;
  hintImageRecyclingKey?: string;
  hintImageSource?: ComponentProps<typeof Image>['source'] | null;
  imageRecyclingKey: string;
  imageSource: ComponentProps<typeof Image>['source'] | null;
  motionTarget: AnimalMotionTarget;
  onHintImageError?: () => void;
  onImageError: () => void;
  onPress: () => void;
  reaction: TrainingTileReaction;
  reactionNonce: number;
  size: number;
  textColor: string;
};

const TIMING = {
  hint: 180,
  tilt: 105,
  hop: 180,
  settle: 260,
} as const;

export function TrainingAnimalTile({
  animal,
  backgroundColor,
  disabled,
  emoji,
  hintImageRecyclingKey,
  hintImageSource,
  imageRecyclingKey,
  imageSource,
  motionTarget,
  onHintImageError,
  onImageError,
  onPress,
  reaction,
  reactionNonce,
  size,
  textColor,
}: TrainingAnimalTileProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showHintImage, setShowHintImage] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const sparkles = useRef(new Animated.Value(0)).current;
  const hasHintImage = Boolean(imageSource && hintImageSource);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    setShowHintImage(false);
    if (reaction !== 'hint' || !hasHintImage) return undefined;

    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const showTimer = setTimeout(
      () => {
        setShowHintImage(true);
        hideTimer = setTimeout(() => setShowHintImage(false), reduceMotion ? 420 : 240);
      },
      reduceMotion ? 0 : 70
    );

    return () => {
      clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [hasHintImage, reaction, reactionNonce, reduceMotion]);

  useEffect(() => {
    scale.stopAnimation();
    lift.stopAnimation();
    tilt.stopAnimation();
    spin.stopAnimation();
    glow.stopAnimation();
    sparkles.stopAnimation();
    scale.setValue(1);
    lift.setValue(0);
    tilt.setValue(0);
    spin.setValue(0);
    glow.setValue(0);
    sparkles.setValue(0);

    if (!reaction) return undefined;

    if (reduceMotion) {
      glow.setValue(reaction === 'not-me' ? 0.25 : 0.9);
      sparkles.setValue(reaction === 'celebrate' ? 1 : 0);
      const fade = Animated.parallel([
        Animated.timing(glow, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sparkles, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      fade.start();
      return () => fade.stop();
    }

    if (reaction === 'hint') {
      const hintAnimations = [
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.055,
            duration: TIMING.hint,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: TIMING.settle,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: TIMING.hint,
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 520,
            useNativeDriver: true,
          }),
        ]),
      ];
      const animation = Animated.parallel(hintAnimations);
      animation.start();
      return () => animation.stop();
    }

    if (reaction === 'not-me') {
      const animation = Animated.sequence([
        Animated.timing(tilt, {
          toValue: -1,
          duration: TIMING.tilt,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(tilt, {
          toValue: 1,
          duration: TIMING.tilt,
          useNativeDriver: true,
        }),
        Animated.timing(tilt, {
          toValue: -0.55,
          duration: TIMING.tilt,
          useNativeDriver: true,
        }),
        Animated.timing(tilt, {
          toValue: 0,
          duration: TIMING.settle,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      animation.start();
      return () => animation.stop();
    }

    if (reaction === 'assisted') {
      const animation = Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.045,
            duration: TIMING.hop,
            useNativeDriver: true,
          }),
          Animated.timing(lift, {
            toValue: -7,
            duration: TIMING.hop,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.72,
            duration: TIMING.hop,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: TIMING.settle,
            useNativeDriver: true,
          }),
          Animated.timing(lift, {
            toValue: 0,
            duration: TIMING.settle,
            easing: Easing.bounce,
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: TIMING.settle,
            useNativeDriver: true,
          }),
        ]),
      ]);
      animation.start();
      return () => animation.stop();
    }

    const celebration = Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.09,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lift, {
          toValue: -14,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(spin, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(sparkles, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.back(1.3)),
          useNativeDriver: true,
        }),
        Animated.timing(lift, {
          toValue: 0,
          duration: 320,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(sparkles, {
          toValue: 0,
          duration: 620,
          useNativeDriver: true,
        }),
      ]),
    ]);
    celebration.start();
    return () => celebration.stop();
  }, [glow, lift, reaction, reactionNonce, reduceMotion, scale, sparkles, spin, tilt]);

  const tiltRotation = tilt.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-7deg', '7deg'],
  });
  const tileSpinRotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const artworkCelebrationRotation = spin.interpolate({
    inputRange: [0, 0.34, 0.68, 1],
    outputRange: ['0deg', '-9deg', '9deg', '0deg'],
  });
  const celebrationRotation =
    motionTarget === 'artwork' ? artworkCelebrationRotation : tileSpinRotation;
  const motionTransform = [
    { translateY: lift },
    { rotate: reaction === 'celebrate' ? celebrationRotation : tiltRotation },
    { scale },
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={animal}
      disabled={disabled}
      onPress={onPress}
      style={[styles.pressable, { width: size, height: size }, disabled && styles.disabled]}
    >
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor,
            opacity: glow,
            transform: [{ scale: 1.1 }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.tile,
          { backgroundColor },
          motionTarget === 'tile' && { transform: motionTransform },
        ]}
      >
        <Animated.View
          style={[styles.artMotion, motionTarget === 'artwork' && { transform: motionTransform }]}
        >
          <View style={styles.artBackdrop}>
            {imageSource ? (
              <>
                <Image
                  key={imageRecyclingKey}
                  recyclingKey={imageRecyclingKey}
                  source={imageSource}
                  style={styles.image}
                  contentFit="contain"
                  onError={onImageError}
                />
                {hintImageSource && showHintImage ? (
                  <View pointerEvents="none" style={styles.hintImageLayer}>
                    <Image
                      key={hintImageRecyclingKey}
                      recyclingKey={hintImageRecyclingKey}
                      source={hintImageSource}
                      style={styles.image}
                      contentFit="contain"
                      onError={onHintImageError}
                    />
                  </View>
                ) : null}
              </>
            ) : (
              <ThemedText
                style={[
                  styles.emoji,
                  {
                    color: textColor,
                    fontSize: Math.max(22, Math.floor(size * 0.52)),
                    lineHeight: Math.max(26, Math.floor(size * 0.58)),
                  },
                ]}
              >
                {emoji}
              </ThemedText>
            )}
          </View>
        </Animated.View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.sparkleLayer, { opacity: sparkles }]}>
        <ThemedText style={[styles.sparkle, styles.sparkleTop]}>✦</ThemedText>
        <ThemedText style={[styles.sparkle, styles.sparkleLeft]}>✧</ThemedText>
        <ThemedText style={[styles.sparkle, styles.sparkleRight]}>✦</ThemedText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  disabled: {
    opacity: 0.72,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },
  tile: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  artMotion: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artBackdrop: {
    width: '90%',
    height: '90%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '96%',
    height: '96%',
  },
  hintImageLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    textAlign: 'center',
  },
  sparkleLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  sparkle: {
    color: '#FFC94A',
    fontSize: 26,
    lineHeight: 30,
    position: 'absolute',
    textShadowColor: 'rgba(111, 69, 0, 0.24)',
    textShadowRadius: 3,
  },
  sparkleTop: {
    right: -8,
    top: -14,
  },
  sparkleLeft: {
    left: -12,
    top: '38%',
  },
  sparkleRight: {
    bottom: -8,
    right: -10,
  },
});
