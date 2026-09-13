import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import 'react-native-reanimated';

import { FoundationProvider } from '@/lib/foundation/FoundationProvider';
import { AuthProvider, DebugAuthProvider } from '@/auth/AuthContext';
import { DebugModeProvider, useDebugMode } from '@/lib/foundation/DebugMode';
import DebugTools from '@/components/foundation/DebugTools';
import { AppearanceProvider, useAppearance } from '@/lib/foundation/Appearance';
import { getRootContentFrameStyle, getSettingsPresentation } from '@/lib/platform-layout';

export default function RootLayout() {
  return (
    <DebugModeProvider>
      <AccountLayout />
    </DebugModeProvider>
  );
}

function AccountLayout() {
  const debug = useDebugMode();
  const AccountProvider = debug ? DebugAuthProvider : AuthProvider;
  return (
    <AccountProvider key={debug ? 'debug' : 'normal'}>
      <AppearanceProvider>
        <FoundationProvider>
          <RootLayoutNav />
        </FoundationProvider>
      </AppearanceProvider>
    </AccountProvider>
  );
}

function RootLayoutNav() {
  const { background } = useAppearance();

  return (
    <ThemeProvider
      value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: background.color } }}
    >
      <Head>
        <title>Eguchi Ear Trainer</title>
        {/* Static favicon for production web */}
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          width: '100%',
          backgroundColor: background.color,
        }}
      >
        <View style={getRootContentFrameStyle()}>
          <DebugTools />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="prepare" />
            <Stack.Screen name="practice" options={{ gestureEnabled: false }} />
            <Stack.Screen name="guide" />
            <Stack.Screen name="records" />
            <Stack.Screen
              name="settings"
              options={{ presentation: getSettingsPresentation(), headerShown: false }}
            />
            <Stack.Screen name="+not-found" />
          </Stack>
        </View>
      </View>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
