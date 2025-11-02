/**
 * Notification Settings Screen
 */

import React, { useState } from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { APP_CONFIG } from '@/lib/app-config';

export const NotificationSettings: React.FC = () => {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Notification Settings
      </ThemedText>

      <View style={styles.settingRow}>
        <ThemedText>Push Notifications</ThemedText>
        <Switch value={pushEnabled} onValueChange={setPushEnabled} />
      </View>

      <View style={styles.settingRow}>
        <ThemedText>Email Notifications</ThemedText>
        <Switch value={emailEnabled} onValueChange={setEmailEnabled} />
      </View>

      {APP_CONFIG.services.notifications.enableSounds && (
        <View style={styles.settingRow}>
          <ThemedText>Sound</ThemedText>
          <Switch value={soundEnabled} onValueChange={setSoundEnabled} />
        </View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
});
