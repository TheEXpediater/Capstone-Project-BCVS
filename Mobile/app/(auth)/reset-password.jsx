import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Button from '@/components/ui/Button';
import Illustration from '@/components/ui/Illustration';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
import { illustrations } from '@/constants/illustrations';
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
      const result = await requestOtp(email.trim().toLowerCase());
      if (result?.emailDisabled || result?.success === false) {
        Alert.alert(
          'Email OTP disabled',
          result?.message || 'Password reset by email is currently disabled. Please contact the registrar or MIS.'
        );
        return;
      }
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Illustration
          source={illustrations.recover}
          heightRatio={0.3}
          minHeight={145}
          maxHeight={230}
          accessibilityLabel="Password recovery illustration"
        />
        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.subtitle}>
          Enter your registered email and we'll send password reset instructions.
        </Text>
        <View style={styles.form}>
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.sm
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
  }
});

