import { useEffect, useState } from 'react';
import { Button, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function HomeScreen() {
  const [nugget, setNugget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { token, loading: authLoading } = useAuth();
  const color = useThemeColor({}, 'text');

  async function load() {
    setLoading(true);
    try {
      console.log(`=== Loading nugget ===`);
      console.log(`Token present: ${!!token}`);

      const response = await api.get('/api/nugget', token);

      console.log(`Response status: ${response.status}`);

      if (response.data) {
        console.log(`Response data:`, response.data);
        setNugget(response.data.text);
      } else {
        console.error(`API Error: ${response.status} - ${response.error}`);
        setNugget(response.error || `Error: ${response.status}`);
      }
    } catch (error) {
      console.error(`Network error:`, error);
      setNugget(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    setLoading(true);
    try {
      console.log(`=== Regenerating nugget ===`);
      console.log(`Token present: ${!!token}`);

      const response = await api.post('/api/nugget/regenerate', undefined, token);

      console.log(`Response status: ${response.status}`);

      if (response.data) {
        console.log(`Response data:`, response.data);
        setNugget(response.data.text);
      } else {
        console.error(`API Error: ${response.status} - ${response.error}`);
        setNugget(response.error || `Error: ${response.status}`);
      }
    } catch (error) {
      console.error(`Network error:`, error);
      setNugget(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && token) {
      load();
    }
  }, [token, authLoading]);

  return (
    <ThemedView style={styles.container}>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={color} />
      ) : (
        <ThemedText style={styles.text}>{nugget ?? '...'}</ThemedText>
      )}
      <Button title="Regenerate" onPress={regenerate} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 24, lineHeight: 32, marginBottom: 16, textAlign: 'center' },
  loader: { marginBottom: 16 },
});
