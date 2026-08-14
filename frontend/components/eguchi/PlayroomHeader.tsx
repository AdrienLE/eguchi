import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import type { PlayroomBackground } from '@/lib/eguchi/playroom-backgrounds';

const APP_LOGO = require('../../assets/images/eguchi/ui/app-icon.png');

export function PlayroomHeaderTitle({ theme }: { theme: PlayroomBackground }) {
  return (
    <View style={styles.titleRow}>
      <View
        style={[
          styles.logoBadge,
          { backgroundColor: theme.surfaceColor, borderColor: theme.surfaceColor },
        ]}
      >
        <Image
          source={APP_LOGO}
          style={styles.logo}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
      <Text style={[styles.titleText, { color: theme.textColor }]}>Eguchi Ears</Text>
    </View>
  );
}

export function CaregiverButton({
  theme,
  onPress,
}: {
  theme: PlayroomBackground;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open caregiver settings"
      accessibilityHint="Opens caregiver progress and controls"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.caregiverButton,
        {
          backgroundColor: theme.surfaceColor,
          borderColor: `${theme.accentColor}66`,
        },
        pressed && styles.caregiverButtonPressed,
      ]}
    >
      <IconSymbol size={15} name="person.2.fill" color={theme.accentColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#59354A',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  logo: {
    width: 38,
    height: 38,
  },
  titleText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: 0.1,
  },
  caregiverButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caregiverButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
