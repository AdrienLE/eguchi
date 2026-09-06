import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getEguchiTheme } from '@/lib/eguchi/theme';
export const usePalette = () => getEguchiTheme('light');
export const Page = ({
  title,
  subtitle,
  children,
  back = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  back?: boolean;
}) => {
  const palette = usePalette();
  const router = useRouter();
  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={{ flex: 1, backgroundColor: '#FFF9ED' }}
    >
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {back && (
          <Pressable
            accessibilityRole="button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.back}
          >
            <Text style={{ color: palette.tint, fontSize: 17 }}>‹ Back</Text>
          </Pressable>
        )}
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: palette.subtleText }]}>{subtitle}</Text>
        )}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};
export const Card = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.borderMuted }, style]}>
      {children}
    </View>
  );
};
export const Body = ({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) => {
  const p = usePalette();
  return <Text style={[styles.body, { color: muted ? p.subtleText : p.text }]}>{children}</Text>;
};
export const Heading = ({ children }: { children: React.ReactNode }) => {
  const p = usePalette();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: p.text }]}>
      {children}
    </Text>
  );
};
export const Button = ({
  title,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) => {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? p.surfaceMuted : '#215E50',
          borderColor: secondary ? p.borderMuted : '#215E50',
          opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {busy && <ActivityIndicator color={secondary ? p.text : '#fff'} />}
      <Text
        style={{
          fontWeight: '600',
          fontSize: 17,
          color: secondary ? p.text : '#fff',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
};
export const Notice = ({ children }: { children: React.ReactNode }) => {
  const p = usePalette();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: p.surfaceMuted }]}
    >
      <Body>{children}</Body>
    </View>
  );
};
export const styles = StyleSheet.create({
  page: {
    padding: 24,
    paddingBottom: 48,
    gap: 18,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  back: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingRight: 24 },
  title: { fontSize: 32, lineHeight: 39, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { fontSize: 18, lineHeight: 27, marginTop: -8, marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: 22, padding: 24, gap: 16 },
  body: { fontSize: 17, lineHeight: 26 },
  heading: { fontSize: 22, lineHeight: 29, fontWeight: '600' },
  button: {
    minHeight: 52,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  notice: { padding: 16, borderRadius: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#899B94',
    borderRadius: 12,
    padding: 14,
    minHeight: 50,
    fontSize: 17,
  },
});
