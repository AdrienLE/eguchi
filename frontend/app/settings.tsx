import { Stack, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { View, Button, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { api } from '@/lib/api';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/auth/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function SettingsScreen() {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pendingImage, setPendingImage] = useState<{
    uri: string;
    fileName?: string;
    mimeType?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const { token } = useAuth();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const hasLoaded = useRef(false);

  // Compress image to reduce file size
  const compressImage = async (uri: string, fileName: string, mimeType: string) => {
    if (Platform.OS === 'web') {
      // Web compression using Canvas
      const img = new window.Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      return new Promise<{ uri: string; fileName: string; mimeType: string }>(resolve => {
        img.onload = () => {
          // Target size: 300px (suitable for profile pics)
          const maxSize = 300;
          let { width, height } = img;

          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            blob => {
              if (blob) {
                const compressedUri = URL.createObjectURL(blob);
                resolve({
                  uri: compressedUri,
                  fileName,
                  mimeType: 'image/jpeg', // Always convert to JPEG for better compression
                });
              }
            },
            'image/jpeg',
            0.8
          ); // 80% quality
        };
        img.src = uri;
      });
    } else {
      // Mobile: Use expo-image-manipulator for compression
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      const result = await manipulateAsync(
        uri,
        [{ resize: { width: 300 } }], // Resize to 300px width, maintain aspect ratio
        {
          compress: 0.8,
          format: SaveFormat.JPEG,
        }
      );

      return {
        uri: result.uri,
        fileName: fileName.replace(/\.[^/.]+$/, '.jpg'), // Change extension to .jpg
        mimeType: 'image/jpeg',
      };
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) {
      const asset = result.assets[0];

      // Compress the image before storing
      const compressed = await compressImage(
        asset.uri,
        asset.fileName ?? 'profile.jpg',
        asset.mimeType ?? 'image/jpeg'
      );

      setPendingImage(compressed);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!token || hasLoaded.current) return;
      hasLoaded.current = true;
      try {
        const response = await api.get('/api/settings', token);
        if (response.data) {
          setName(response.data.name ?? '');
          setNickname(response.data.nickname ?? '');
          setEmail(response.data.email ?? '');
          setImageUrl(response.data.imageUrl ?? '');
        }
      } catch (e) {
        console.warn('Failed to load settings', e);
        hasLoaded.current = false; // Reset on error to allow retry
      }
    };
    load();
  }, [!!token]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;

      // Upload pending image first if there is one
      if (pendingImage) {
        console.log('Uploading pending image:', pendingImage);
        const formData = new FormData();

        // On web, we need to create a proper File object from the URI
        if (pendingImage.uri.startsWith('blob:') || pendingImage.uri.startsWith('data:')) {
          // Web: Convert blob/data URI to File
          const response = await fetch(pendingImage.uri);
          const blob = await response.blob();
          const file = new File([blob], pendingImage.fileName || 'profile.jpg', {
            type: pendingImage.mimeType || 'image/jpeg',
          });
          formData.append('file', file);
        } else {
          // Mobile: Use the existing format
          formData.append('file', {
            uri: pendingImage.uri,
            name: pendingImage.fileName,
            type: pendingImage.mimeType,
          } as any);
        }

        const uploadResponse = await api.upload('/api/upload-profile-picture', formData, token);

        if (uploadResponse.data) {
          finalImageUrl = uploadResponse.data.url;
        } else {
          console.warn('Failed to upload image:', uploadResponse.error);
          setSaving(false);
          return; // Don't save if upload failed
        }
      }

      // Save settings with the final image URL
      await api.post('/api/settings', { name, nickname, email, imageUrl: finalImageUrl }, token);

      router.back();
    } catch (e) {
      console.warn('Failed to save settings', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <Pressable style={styles.overlay} onPress={router.back}>
        <Pressable
          onPress={e => e.stopPropagation()}
          style={[styles.modal, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
        >
          <Pressable onPress={router.back} style={styles.closeButton} hitSlop={8}>
            <IconSymbol name="xmark" size={24} color={Colors[colorScheme ?? 'light'].icon} />
          </Pressable>
          <View style={styles.content}>
            <View style={styles.pictureRow}>
              {pendingImage || imageUrl ? (
                <Image source={{ uri: pendingImage?.uri || imageUrl }} style={styles.avatar} />
              ) : (
                <IconSymbol
                  name="person.crop.circle"
                  size={120}
                  color={Colors[colorScheme ?? 'light'].icon}
                  style={styles.avatar}
                />
              )}
              <Pressable
                onPress={pickImage}
                style={[
                  styles.changeButton,
                  { backgroundColor: Colors[colorScheme ?? 'light'].tint },
                ]}
              >
                <ThemedText
                  style={{
                    color: colorScheme === 'light' ? '#fff' : Colors.dark.background,
                  }}
                >
                  Change Picture
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.label}>Name</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
              />
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.label}>Nickname</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="Your nickname"
              />
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.buttonRow}>
              <Button
                title="Cancel"
                onPress={router.back}
                color={Colors[colorScheme ?? 'light'].icon}
                disabled={saving}
              />
              <Button title={saving ? 'Saving...' : 'Save'} onPress={save} disabled={saving} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 8,
    padding: 24,
  },
  content: { width: '100%', gap: 16 },
  pictureRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { width: 90 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 4,
  },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
});
