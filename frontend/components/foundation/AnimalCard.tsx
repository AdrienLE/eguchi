import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, Pressable, Text, View } from 'react-native';
import { CURRICULUM_BY_ID, type ChordId } from '@/lib/foundation/curriculum';
import { FOUNDATION_ANIMALS } from '@/lib/foundation/animal-assets';
export default function AnimalCard({
  id,
  size = 100,
  onPress,
  disabled = false,
  selected = false,
  label = true,
  muted = false,
  react = false,
}: {
  id: ChordId;
  size?: number;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  label?: boolean;
  muted?: boolean;
  react?: boolean;
}) {
  const chord = CURRICULUM_BY_ID[id];
  const motion = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (active) setReduceMotion(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    motion.setValue(0);
    if (!react || reduceMotion) return;
    // The same small greeting follows every revealed answer, regardless of accuracy.
    const animation = Animated.sequence([
      Animated.timing(motion, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(motion, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [react, reduceMotion, motion]);
  const content = (
    <>
      <Image
        source={FOUNDATION_ANIMALS[id]}
        resizeMode="contain"
        style={{ width: size, height: size, borderRadius: 14, backgroundColor: chord.hex }}
      />
      {label && (
        <Text
          style={{
            color: '#273C45',
            fontSize: size < 65 ? 10 : size < 90 ? 12 : 15,
            lineHeight: size < 65 ? 12 : size < 90 ? 14 : 18,
            fontWeight: '600',
            textAlign: 'center',
            maxWidth: size + 16,
            backgroundColor: '#FFFFFFEB',
            paddingHorizontal: size < 90 ? 4 : 9,
            paddingVertical: 2,
            borderRadius: 10,
          }}
        >
          {chord.color}
        </Text>
      )}
    </>
  );
  const style = {
    width: size + 20,
    height: size + (label ? 58 : 20),
    padding: 7,
    gap: 6,
    borderRadius: 20,
    backgroundColor: chord.hex,
    borderColor: selected ? '#FFFFFF' : chord.hex,
    borderWidth: 3,
    opacity: muted ? 0.45 : 1,
    alignItems: 'center' as const,
  };
  const card = onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${chord.color} ${chord.animal}`}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={style}
    >
      {content}
    </Pressable>
  ) : (
    <View accessibilityLabel={`${chord.color} ${chord.animal}`} style={style}>
      {content}
    </View>
  );
  return (
    <Animated.View
      style={{
        transform: [
          { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
          { scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
        ],
      }}
    >
      {card}
    </Animated.View>
  );
}
