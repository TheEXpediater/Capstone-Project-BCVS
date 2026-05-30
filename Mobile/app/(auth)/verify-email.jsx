import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
import { colors, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams();
  const verifyEmailOtp = useAppStore((state) => state.verifyEmailOtp);
  const register = useAppStore((state) => state.register);
  const [code, setCode] = useState('');
  const email = useMemo(() => String(params.email || ''), [params.email]);

  async function submit() {
    if (code.trim().length < 6) {
      Alert.alert('Missing code', 'Enter the 6-digit code from your email.');
      return;
    }

    try {
      await verifyEmailOtp({ email, code: code.trim() });
      await register({
        username: String(params.username || ''),
        fullName: String(params.fullName || ''),
        studentId: String(params.studentId || ''),
        email,
        password: String(params.password || '')
      });
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Verification failed', error.message);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Verify Email</Text>
      <Text style={styles.subtitle}>Enter the code sent to {email}.</Text>
      <TextField
        label="Verification code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
      />
      <Button title="Verify and Create" onPress={submit} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.xl
  },
  subtitle: {
    color: colors.muted,
    marginVertical: spacing.md
  }
});

