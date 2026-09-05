import { useAuth } from '@/auth/AuthContext';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { CaregiverButton, PlayroomHeaderTitle } from '@/components/eguchi/PlayroomHeader';
import {
  DEFAULT_PLAYROOM_BACKGROUND_ID,
  getPlayroomBackground,
  type PlayroomBackgroundId,
} from '@/lib/eguchi/playroom-backgrounds';
import { loadEguchiSessionPreferences } from '@/lib/eguchi/session-preferences';

export default function TabLayout() {
  const { practiceStorage } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [playroomBackgroundId, setPlayroomBackgroundId] = useState<PlayroomBackgroundId>(
    DEFAULT_PLAYROOM_BACKGROUND_ID
  );
  const playroomTheme = getPlayroomBackground(playroomBackgroundId);

  useEffect(() => {
    let isActive = true;
    void loadEguchiSessionPreferences(practiceStorage)
      .then(preferences => {
        if (isActive) {
          setPlayroomBackgroundId(preferences.playroomBackgroundId);
        }
      })
      .catch(error => {
        console.warn('Failed to load the playroom header theme', error);
      });
    return () => {
      isActive = false;
    };
  }, [pathname, practiceStorage]);

  return (
    <>
      <StatusBar style="dark" backgroundColor={playroomTheme.headerColor} />
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarStyle: { display: 'none' },
          headerStyle: { backgroundColor: playroomTheme.headerColor },
          headerShadowVisible: false,
          headerTintColor: playroomTheme.textColor,
          headerTitleAlign: 'left',
          headerTitle: () => <PlayroomHeaderTitle theme={playroomTheme} />,
          headerRight: () => (
            <CaregiverButton theme={playroomTheme} onPress={() => router.push('/settings')} />
          ),
          headerRightContainerStyle: { paddingRight: 10 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Eguchi Ears' }} />
      </Tabs>
    </>
  );
}
