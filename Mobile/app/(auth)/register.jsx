import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
import { colors, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

export default function RegisterScreen() {
  const params = useLocalSearchParams();
  const requestEmailOtp = useAppStore((state) => state.requestEmailOtp);
  const loading = useAppStore((state) => state.loading.auth);
  const [email, setEmail] = useState(String(params.email || ''));
  const [password, setPassword] = useState(String(params.password || ''));
  const [confirmPassword, setConfirmPassword] = useState(String(params.password || ''));

  async function submit() {
    const cleanEmail = email.trim().toLowerCase();
    const username = cleanEmail.split('@')[0] || cleanEmail;

    if (!cleanEmail || !password) {
      Alert.alert('Missing fields', 'Email and password are required.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Password and confirm password must match.');
      return;
    }

    try {
      const otpResult = await requestEmailOtp(cleanEmail);
      router.push({
        pathname: '/(auth)/verify-email',
        params: {
          username,
          fullName: username,
          email: cleanEmail,
          password,
          otpDisabled: otpResult?.emailDisabled ? 'true' : ''
        }
      });
    } catch (error) {
      Alert.alert('Could not send OTP', error.message);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Use your email and password to create a holder account.</Text>
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <TextField
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        <Button title="Continue" loading={loading} onPress={submit} />
        <Pressable onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.link}>Already have an account?</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center'
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 20,
    marginBottom: spacing.md,
    textAlign: 'center'
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center'
  }
});
