import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? '#FFFFFF' : '#2B2F32';

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarStyle: { display: 'none' },
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={[
              styles.caregiverButton,
              {
                backgroundColor: isDark ? '#2F3438' : '#EFF3F6',
                borderColor: isDark ? '#4A5157' : '#D2D9DE',
              },
            ]}
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

const styles = StyleSheet.create({
  caregiverButton: {
    marginRight: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
