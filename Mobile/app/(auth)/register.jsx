import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  'BS Forestry',
  'Other / Type manually'
];

const YEAR_OPTIONS = ['Not graduated yet', '2026', '2025', '2024', '2023', '2022', '2021', '2020', 'Other / Type manually'];

function SelectField({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.selectWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.selectButton} onPress={() => setOpen(true)}>
        <Text style={styles.selectText}>{value || 'Select'}</Text>
      </Pressable>
      <Modal visible={open} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            {options.map((item) => (
              <Pressable
                key={item}
                style={styles.optionRow}
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                }}
              >
                <Text style={styles.optionText}>{item}</Text>
              </Pressable>
            ))}
            <Button title="Cancel" variant="outline" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
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
  const [addressLine, setAddressLine] = useState(String(params.addressLine || params.address || ''));
  const [cityMunicipality, setCityMunicipality] = useState(String(params.cityMunicipality || ''));
  const [province, setProvince] = useState(String(params.province || ''));
  const [program, setProgram] = useState(String(params.program || PROGRAM_OPTIONS[0]));
  const [programManual, setProgramManual] = useState('');
  const [yearGraduated, setYearGraduated] = useState(
    String(params.yearGraduated || '') || 'Not graduated yet'
  );
  const [yearManual, setYearManual] = useState('');
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
      const otpResult = await requestEmailOtp(cleanEmail);
      router.push({
        pathname: '/(auth)/verify-email',
        params: {
          username: derivedUsername,
          fullName,
          studentId,
          email: cleanEmail,
          password,
          address: [addressLine, cityMunicipality, province].filter(Boolean).join(', '),
          addressLine,
          cityMunicipality,
          province,
          program: program === 'Other / Type manually' ? programManual : program,
          yearGraduated:
            yearGraduated === 'Not graduated yet'
              ? ''
              : yearGraduated === 'Other / Type manually'
                ? yearManual
                : yearGraduated,
          graduationStatus:
            yearGraduated === 'Not graduated yet' ? 'not_graduated_yet' : 'graduated',
          contactNo,
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
        <TextField label="Street / Address line" value={addressLine} onChangeText={setAddressLine} autoCapitalize="words" />
        <TextField label="City / Municipality" value={cityMunicipality} onChangeText={setCityMunicipality} autoCapitalize="words" />
        <TextField label="Province" value={province} onChangeText={setProvince} autoCapitalize="words" />
        <SelectField label="Program" value={program} options={PROGRAM_OPTIONS} onChange={setProgram} />
        {program === 'Other / Type manually' ? (
          <TextField label="Program / Course" value={programManual} onChangeText={setProgramManual} autoCapitalize="words" />
        ) : null}
        <SelectField label="Year Graduated" value={yearGraduated} options={YEAR_OPTIONS} onChange={setYearGraduated} />
        {yearGraduated === 'Other / Type manually' ? (
          <TextField label="Year Graduated" value={yearManual} onChangeText={setYearManual} keyboardType="number-pad" />
        ) : null}
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
  selectWrap: {
    gap: spacing.xs
  },
  selectButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  selectText: {
    color: colors.text,
    fontWeight: '700'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.xs
  },
  optionRow: {
    minHeight: 44,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceMuted
  },
  optionText: {
    color: colors.text,
    fontWeight: '800'
  }
});
