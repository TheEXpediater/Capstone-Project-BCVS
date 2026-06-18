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
  const otpDisabled = String(params.otpDisabled || '') === 'true';

  async function submit() {
    if (!otpDisabled && code.trim().length < 6) {
      Alert.alert('Missing code', 'Enter the 6-digit code from your email.');
      return;
    }

    try {
      if (!otpDisabled) {
        await verifyEmailOtp({ email, code: code.trim() });
      }
      await register({
        username: String(params.username || ''),
        fullName: String(params.fullName || ''),
        studentId: String(params.studentId || ''),
        email,
        password: String(params.password || ''),
        address: String(params.address || ''),
        addressLine: String(params.addressLine || ''),
        cityMunicipality: String(params.cityMunicipality || ''),
        province: String(params.province || ''),
        program: String(params.program || ''),
        yearGraduated: String(params.yearGraduated || ''),
        graduationStatus: String(params.graduationStatus || ''),
        contactNo: String(params.contactNo || '')
      });
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Verification failed', error.message);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Verify Email</Text>
      <Text style={styles.subtitle}>
        {otpDisabled
          ? 'Email OTP is currently disabled by MIS. Continue to create your account.'
          : `Enter the code sent to ${email}.`}
      </Text>
      {otpDisabled ? null : (
        <TextField
          label="Verification code"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
        />
      )}
      <Button
        title={otpDisabled ? 'Create Account' : 'Verify and Create'}
        onPress={submit}
        style={{ marginTop: spacing.md }}
      />
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

