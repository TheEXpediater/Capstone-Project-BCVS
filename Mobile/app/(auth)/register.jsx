import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
import { colors, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

const PROGRAM_OPTIONS = [
  'BS Agriculture',
  'BS Agricultural and Biosystems Engineering',
  'BS Information Technology',
  'BS Computer Science',
  'BS Agribusiness',
  'BS Forestry'
];

const YEAR_OPTIONS = ['Not graduated yet', '2026', '2025', '2024', '2023', '2022', '2021', '2020'];

function SelectChip({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : null]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

export default function RegisterScreen() {
  const params = useLocalSearchParams();
  const requestEmailOtp = useAppStore((state) => state.requestEmailOtp);
  const loading = useAppStore((state) => state.loading.auth);
  const [username, setUsername] = useState(String(params.username || ''));
  const [fullName, setFullName] = useState(String(params.fullName || ''));
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState(String(params.email || ''));
  const [password, setPassword] = useState(String(params.password || ''));
  const [confirmPassword, setConfirmPassword] = useState(String(params.password || ''));
  const [address, setAddress] = useState(String(params.address || ''));
  const [program, setProgram] = useState(String(params.program || PROGRAM_OPTIONS[0]));
  const [yearGraduated, setYearGraduated] = useState(
    String(params.yearGraduated || '') || 'Not graduated yet'
  );
  const [contactNo, setContactNo] = useState(String(params.contactNo || ''));

  async function submit() {
    const cleanEmail = email.trim().toLowerCase();
    const derivedUsername = username.trim() || cleanEmail.split('@')[0] || fullName.trim();

    if (!cleanEmail || !password || !fullName.trim()) {
      Alert.alert('Missing fields', 'Email, password, and full name are required.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Password and confirm password must match.');
      return;
    }

    try {
      await requestEmailOtp(cleanEmail);
      router.push({
        pathname: '/(auth)/verify-email',
        params: {
          username: derivedUsername,
          fullName,
          studentId,
          email: cleanEmail,
          password,
          address,
          program,
          yearGraduated: yearGraduated === 'Not graduated yet' ? '' : yearGraduated,
          graduationStatus: yearGraduated === 'Not graduated yet' ? 'not_graduated_yet' : 'graduated',
          contactNo
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
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <TextField
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        <TextField label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <TextField label="Address" value={address} onChangeText={setAddress} autoCapitalize="words" />
        <Text style={styles.fieldLabel}>Program</Text>
        <View style={styles.chipRow}>
          {PROGRAM_OPTIONS.map((item) => (
            <SelectChip key={item} label={item} selected={program === item} onPress={() => setProgram(item)} />
          ))}
        </View>
        <Text style={styles.fieldLabel}>Year Graduated</Text>
        <View style={styles.chipRow}>
          {YEAR_OPTIONS.map((item) => (
            <SelectChip
              key={item}
              label={item}
              selected={yearGraduated === item}
              onPress={() => setYearGraduated(item)}
            />
          ))}
        </View>
        <TextField label="Contact number" value={contactNo} onChangeText={setContactNo} keyboardType="phone-pad" />
        <TextField label="Username (optional)" value={username} onChangeText={setUsername} />
        <TextField label="Student ID" value={studentId} onChangeText={setStudentId} />
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
  },
  fieldLabel: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.text,
    fontWeight: '700'
  },
  chipTextSelected: {
    color: colors.primary
  }
});
