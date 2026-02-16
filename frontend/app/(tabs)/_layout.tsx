import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const iconColor = Colors[colorScheme ?? 'light'].icon;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarStyle: { display: 'none' },
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            style={{ paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <IconSymbol size={20} name="gearshape.fill" color={iconColor} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Eguchi Training',
        }}
      />
    </Tabs>
  );
}
