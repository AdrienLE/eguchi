import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
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
}: {
  id: ChordId;
  size?: number;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  label?: boolean;
  muted?: boolean;
}) {
  const chord = CURRICULUM_BY_ID[id];
  const content = (
    <>
      <Image
        source={FOUNDATION_ANIMALS[id]}
        resizeMode="contain"
        style={{ width: size, height: size, borderRadius: 14, backgroundColor: '#FFFFFF' }}
      />
      {label && (
        <Text
          style={{
            color: '#273C45',
            fontSize: size < 90 ? 12 : 15,
            fontWeight: '600',
            textAlign: 'center',
            maxWidth: size + 16,
          }}
        >
          {chord.color}
        </Text>
      )}
    </>
  );
  const style = {
    width: size + 20,
    padding: 8,
    gap: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderColor: chord.hex,
    borderWidth: selected ? 5 : 2,
    opacity: muted ? 0.45 : 1,
    alignItems: 'center' as const,
  };
  return onPress ? (
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
}
