import { Button, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getEguchiTheme } from '@/lib/eguchi/theme';

export default function LoginScreen() {
  const { login, token, loading } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = getEguchiTheme(colorScheme);

  useEffect(() => {
    if (!loading && token) {
      router.replace('/(tabs)');
    }
  }, [token, loading]);
  return (
    <ThemedView style={styles.container}>
      {loading ? (
        <ActivityIndicator color={theme.tint} />
      ) : (
        <Button title="Sign In" color={theme.tint} onPress={login} />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
