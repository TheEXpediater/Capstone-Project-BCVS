import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
import { colors, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

export default function ResetPasswordScreen() {
  const requestOtp = useAppStore((state) => state.requestPasswordResetOtp);
  const verifyOtp = useAppStore((state) => state.verifyPasswordResetOtp);
  const resetPassword = useAppStore((state) => state.resetPassword);
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetSession, setResetSession] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function sendCode() {
    try {
      await requestOtp(email.trim().toLowerCase());
      setStep('code');
    } catch (error) {
      Alert.alert('Could not send code', error.message);
    }
  }

  async function verifyCode() {
    try {
      const result = await verifyOtp({ email: email.trim().toLowerCase(), code: code.trim() });
      setResetSession(result?.resetSession || result?.reset_session || '');
      setStep('password');
    } catch (error) {
      Alert.alert('Invalid code', error.message);
    }
  }

  async function savePassword() {
    try {
      await resetPassword({
        email: email.trim().toLowerCase(),
        resetSession,
        newPassword
      });
      Alert.alert('Password updated', 'You can now log in.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') }
      ]);
    } catch (error) {
      Alert.alert('Reset failed', error.message);
    }
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>Reset Password</Text>
        {step === 'email' && (
          <>
            <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <Button title="Send Code" onPress={sendCode} />
          </>
        )}
        {step === 'code' && (
          <>
            <Text style={styles.subtitle}>Enter the code sent to {email}.</Text>
            <TextField label="Reset code" value={code} onChangeText={setCode} keyboardType="number-pad" />
            <Button title="Verify Code" onPress={verifyCode} />
          </>
        )}
        {step === 'password' && (
          <>
            <TextField
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <Button title="Save Password" onPress={savePassword} />
          </>
        )}
        <Button title="Back to Login" variant="outline" onPress={() => router.replace('/(auth)/login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900'
  },
  subtitle: {
    color: colors.muted
  }
});

