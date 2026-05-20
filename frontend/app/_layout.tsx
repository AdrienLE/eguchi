import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider } from '@/auth/AuthContext';
import { getRootContentFrameStyle, getSettingsPresentation } from '@/lib/platform-layout';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
          backgroundColor: colorScheme === 'dark' ? '#0a0b0c' : '#f5f5f5',
        }}
      >
        <View style={getRootContentFrameStyle()}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="settings"
              options={{ presentation: getSettingsPresentation(), headerShown: true }}
            />
            <Stack.Screen name="+not-found" />
          </Stack>
        </View>
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
