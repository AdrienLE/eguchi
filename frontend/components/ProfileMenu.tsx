import { useState, useEffect } from 'react';
import { Pressable, View, StyleSheet, Platform } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Image } from 'expo-image';

import { useAuth } from '@/auth/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { api } from '@/lib/api';

export function ProfileMenu() {
  const { logout, token } = useAuth();
  const colorScheme = useColorScheme();
  const [open, setOpen] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState('');

  const loadProfileImage = async () => {
    if (!token) return;
    try {
      const response = await api.get('/api/settings', token);
      if (response.data) {
        setProfileImageUrl(response.data.imageUrl ?? '');
      }
    } catch (e) {
      console.warn('Failed to load profile image', e);
    }
  };

  useEffect(() => {
    loadProfileImage();
  }, [!!token]);

  // Refresh profile image when the screen comes into focus (after returning from settings)
  useFocusEffect(
    useCallback(() => {
      loadProfileImage();
    }, [token])
  );

  return (
    <>
      <Pressable onPress={() => setOpen(!open)} hitSlop={8}>
        {profileImageUrl ? (
          <Image source={{ uri: profileImageUrl }} style={styles.profileImage} />
        ) : (
          <IconSymbol
            name="person.crop.circle"
            size={28}
            color={Colors[colorScheme ?? 'light'].icon}
            style={{ marginRight: 16 }}
          />
        )}
      </Pressable>
      {open && (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.menu,
              {
                backgroundColor: Colors[colorScheme ?? 'light'].background,
                top: Platform.OS === 'web' ? 55 : Platform.OS === 'android' ? 52 : 48,
                right: Platform.OS === 'web' ? 8 : 16,
              },
            ]}
          >
            <Link href="/settings" asChild>
              <Pressable onPress={() => setOpen(false)} style={styles.menuItem}>
                <ThemedText>Settings</ThemedText>
              </Pressable>
            </Link>
            <Pressable onPress={() => logout()} style={styles.menuItem}>
              <ThemedText>Logout</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  profileImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 16,
  },
});
