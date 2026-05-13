import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
import { colors, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

export default function RegisterScreen() {
  const requestEmailOtp = useAppStore((state) => state.requestEmailOtp);
  const loading = useAppStore((state) => state.loading.auth);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit() {
    if (!username.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Username, email, and password are required.');
      return;
    }

    try {
      await requestEmailOtp(email.trim().toLowerCase());
      router.push({
        pathname: '/(auth)/verify-email',
        params: {
          username,
          fullName,
          studentId,
          email: email.trim().toLowerCase(),
          password
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
        <Text style={styles.subtitle}>Use your student email to create a holder account.</Text>
        <TextField label="Username" value={username} onChangeText={setUsername} />
        <TextField label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <TextField label="Student ID" value={studentId} onChangeText={setStudentId} />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
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
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900'
  },
  subtitle: {
    color: colors.muted,
    marginBottom: spacing.md
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center'
  }
});
