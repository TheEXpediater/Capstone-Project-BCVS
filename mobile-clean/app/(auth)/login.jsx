import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
import { colors, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

export default function LoginScreen() {
  const login = useAppStore((state) => state.login);
  const loading = useAppStore((state) => state.loading.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }

    try {
      await login({ email: email.trim().toLowerCase(), password });
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Login failed', error.message);
    }
  }

  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.brand}>CredPocket</Text>
        <Text style={styles.subtitle}>Verifiable credential wallet</Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="student@example.com"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
          />
          <Button title="Login" loading={loading} onPress={submit} />

          <Pressable onPress={() => router.push('/(auth)/reset-password')}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.link}>Create an account</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm
  },
  brand: {
    color: colors.primary,
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center'
  },
  subtitle: {
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.xl
  },
  form: {
    gap: spacing.md
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing.xs
  }
});

