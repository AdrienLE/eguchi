/**
 * Feature-based Login Screen
 *
 * This is a modular login screen that can be used when the auth feature is enabled
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { APP_CONFIG } from '@/lib/app-config';

export const LoginScreen: React.FC = () => {
  const colors = APP_CONFIG.ui.theme.colors.light;

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Welcome to {APP_CONFIG.branding.appName}
      </ThemedText>
      <ThemedText style={styles.description}>{APP_CONFIG.branding.description}</ThemedText>
      {/* Add login form components here */}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    marginBottom: 32,
  },
});
