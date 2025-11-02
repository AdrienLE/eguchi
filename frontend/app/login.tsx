import { Button, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { login, token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && token) {
      router.replace('/(tabs)');
    }
  }, [token, loading]);
  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator /> : <Button title="Sign In" onPress={login} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
