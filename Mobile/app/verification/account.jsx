import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import Button from '@/components/ui/Button';
import Illustration from '@/components/ui/Illustration';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
import { illustrations } from '@/constants/illustrations';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import FaceVerifier from '@/components/verification/FaceVerifier';

const STEPS = ['Personal Info', 'Valid ID', 'Liveness Check', 'Review', 'Submit'];

const PROGRAM_OPTIONS = [
  'BS Agriculture',
  'BS Agricultural and Biosystems Engineering',
  'BS Information Technology',
  'BS Computer Science',
  'BS Agribusiness',
  'BS Forestry',
  'Other / Type manually'
];

const YEAR_OPTIONS = [
  'Not graduated yet',
  '2026',
  '2025',
  '2024',
  '2023',
  '2022',
  '2021',
  '2020',
  '2019',
  '2018',
  'Other / Type manually'
];

const VALID_ID_TYPES = [
  'National ID',
  'Passport',
  "Driver's License",
  'UMID',
  'Postal ID',
  'Student ID',
  'Other'
];

function statusOf(user, account) {
  return String(account?.status || user?.verified || 'unverified').toLowerCase();
}

function PhotoPreview({ asset, label, style }) {
  if (!asset?.uri) {
    return (
      <View style={[styles.emptyPreview, style]}>
        <Text style={styles.emptyText}>{label}</Text>
      </View>
    );
  }

  return <Image source={{ uri: asset.uri }} style={[styles.preview, style]} />;
}

function SelectField({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.selectWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.selectButton} onPress={() => setOpen(true)}>
        <Text style={styles.selectText}>{value || 'Select'}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade">
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

function PhotoPicker({ title, body, asset, previewLabel, onCamera, onGallery }) {
  return (
    <View style={styles.uploadBlock}>
      <Text style={styles.uploadLabel}>{title}</Text>
      {body ? <Text style={styles.muted}>{body}</Text> : null}
      <PhotoPreview asset={asset} label={previewLabel} />
      <View style={styles.row}>
        <Button title="Camera" onPress={onCamera} style={styles.flex} />
        <Button title="Gallery" variant="outline" onPress={onGallery} style={styles.flex} />
      </View>
    </View>
  );
}

function buildAddress(parts = {}) {
  return [parts.addressLine, parts.cityMunicipality, parts.province]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
}

function resolveProgram(form = {}) {
  return form.program === 'Other / Type manually'
    ? String(form.programManual || '').trim()
    : String(form.program || '').trim();
}

function resolveYearGraduated(form = {}) {
  if (form.yearGraduated === 'Not graduated yet') return '';
  if (form.yearGraduated === 'Other / Type manually') {
    return String(form.yearManual || '').trim();
  }
  return String(form.yearGraduated || '').trim();
}

function graduationStatusFor(yearGraduated) {
  return yearGraduated === 'Not graduated yet' ? 'not_graduated_yet' : 'graduated';
}

export default function AccountVerificationScreen() {
  const user = useAppStore((state) => state.user);
  const loadAccountVerification = useAppStore((state) => state.loadAccountVerification);
  const submitAccountVerification = useAppStore((state) => state.submitAccountVerification);
  const refreshAccount = useAppStore((state) => state.refreshAccount);

  const [account, setAccount] = useState(null);
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);

  const [answers, setAnswers] = useState({
    studentNo: user?.studentId || '',
    fullName: user?.fullName || '',
    addressLine: '',
    cityMunicipality: '',
    province: '',
    program: PROGRAM_OPTIONS[0],
    programManual: '',
    yearGraduated: YEAR_OPTIONS[0],
    yearManual: '',
    graduationStatus: 'not_graduated_yet',
    contactNo: '',
    validIdType: VALID_ID_TYPES[0],
    confirmed: false
  });

  const [showLiveness, setShowLiveness] = useState(false);
  const [livenessPassedAt, setLivenessPassedAt] = useState('');

  const status = statusOf(user, account);
  const approved = status === 'verified' || status === 'true';
  const pending = status === 'pending';
  const rejected = status === 'rejected';
  const currentTitle = useMemo(() => STEPS[step] || STEPS[0], [step]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await loadAccountVerification();
        if (active) setAccount(data);
      } catch (error) {
        Alert.alert('Status unavailable', error.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [loadAccountVerification]);

  function updateAnswer(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function updateGraduation(value) {
    updateAnswer('yearGraduated', value);
    updateAnswer('graduationStatus', graduationStatusFor(value));
  }

  function startVerification() {
    setStep(0);
    setStarted(true);
  }

  async function chooseImage(setter) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8
    });

    if (!result.canceled) {
      setter(result.assets[0]);
    }
  }

  async function takePhoto(setter) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8
    });

    if (!result.canceled) {
      setter(result.assets[0]);
    }
  }

  function validateStep(stepIndex) {
    if (stepIndex === 0) {
      if (!answers.fullName.trim() || !answers.contactNo.trim()) {
        Alert.alert('Personal information required', 'Full name and contact number are required.');
        return false;
      }

      if (!buildAddress(answers) || !resolveProgram(answers)) {
        Alert.alert('Personal information required', 'Address and program are required.');
        return false;
      }

      if (answers.graduationStatus !== 'not_graduated_yet' && !resolveYearGraduated(answers)) {
        Alert.alert('Year graduated required', 'Choose your graduation year.');
        return false;
      }
    }

    if (stepIndex === 1 && (!answers.validIdType || !idFront || !idBack)) {
      Alert.alert('Valid ID required', 'Choose an ID type and provide front and back photos.');
      return false;
    }

    if (stepIndex === 2 && !livenessPassedAt) {
      Alert.alert('Liveness required', 'Pass FaceVerifier before continuing.');
      return false;
    }

    return true;
  }

  function validateCurrentStep() {
    return validateStep(step);
  }

  function validateBeforeSubmit() {
    for (let index = 0; index < 3; index += 1) {
      if (!validateStep(index)) {
        setStep(index);
        return false;
      }
    }

    if (!answers.confirmed) {
      Alert.alert('Confirmation required', 'Please confirm that the information is true.');
      return false;
    }

    return true;
  }

  function next() {
    if (!validateCurrentStep()) return;
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function back() {
    if (step === 0) {
      setStarted(false);
      return;
    }

    setStep((prev) => Math.max(prev - 1, 0));
  }

  function submit() {
    if (submitting) return;
    if (!validateBeforeSubmit()) return;
    submitAfterLiveness(livenessPassedAt);
  }

  async function submitAfterLiveness(passedAt) {
    try {
      setSubmitting(true);
      const resolvedAnswers = {
        ...answers,
        address: buildAddress(answers),
        program: resolveProgram(answers),
        yearGraduated: resolveYearGraduated(answers),
        graduationStatus: graduationStatusFor(answers.yearGraduated),
        confirmed: true,
        livenessPassed: true,
        livenessPassedAt: passedAt,
        livenessMethod: 'faceVerifierLocal'
      };

      await submitAccountVerification({
        idFront,
        idBack,
        answers: resolvedAnswers,
        livenessPassed: true,
        livenessPassedAt: passedAt,
        livenessMethod: 'faceVerifierLocal'
      });

      await refreshAccount();

      const data = await loadAccountVerification();
      setAccount(data);
      setStarted(false);
      setStep(0);
      setShowLiveness(false);
      setLivenessPassedAt('');

      Alert.alert('Submitted', 'Verification submitted. The registrar will review your account.');
    } catch (error) {
      Alert.alert('Submit failed', error.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleLivenessPassed() {
    const passedAt = new Date().toISOString();
    setLivenessPassedAt(passedAt);
    setShowLiveness(false);
    Alert.alert('Liveness passed', 'FaceVerifier passed. Continue to review your details.');
  }

  function renderStatusCard() {
    if (approved) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account verified</Text>
          <Text style={styles.muted}>
            Your account is linked to {user?.studentId || account?.user?.studentId || 'your student record'}.
          </Text>
          <Button
            title="Back to Wallet"
            onPress={() => router.replace('/(tabs)/home')}
            style={styles.buttonGap}
          />
        </View>
      );
    }

    if (pending && !started) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification submitted</Text>
          <Text style={styles.muted}>The registrar will review your account.</Text>
          <Button title="Back" variant="outline" onPress={() => router.back()} style={styles.buttonGap} />
        </View>
      );
    }

    if (rejected && !started) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification rejected</Text>
          <Text style={styles.muted}>
            {account?.submission?.rejectionReason || 'Please submit updated proof for review.'}
          </Text>
          <Button title="Continue" onPress={startVerification} style={styles.buttonGap} />
        </View>
      );
    }

    return null;
  }

  function renderProgress() {
    if (!started) return null;

    return (
      <View style={styles.progressWrap}>
        <Text style={styles.progressLabel}>Step {step + 1} of {STEPS.length}</Text>
        <View style={styles.progressLine}>
        {STEPS.map((label, index) => {
          const complete = index < step;
          const active = index === step;

          return (
            <View
              key={label}
              style={styles.progressSegment}
            >
              <View style={[styles.progressDot, (active || complete) && styles.progressDotOn]} />
              {index < STEPS.length - 1 ? (
                <View style={[styles.progressConnector, complete && styles.progressConnectorOn]} />
              ) : null}
            </View>
          );
        })}
        </View>
      </View>
    );
  }

  function renderStep() {
    if (!started) {
      return (
        <View style={styles.introCard}>
          <Illustration
            source={illustrations.studentVerification}
            heightRatio={0.26}
            minHeight={150}
            maxHeight={220}
            accessibilityLabel="Student verification illustration"
          />
          <Text style={styles.introTitle}>{"Let's Verify Your Account"}</Text>
          <Text style={styles.introText}>
            We will guide you through a few simple steps to verify your identity and secure your account.
          </Text>
          <Button title="Continue" onPress={startVerification} style={styles.buttonGap} />
        </View>
      );
    }

    if (step === 0) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Info</Text>
          <TextField
            label="Full Name"
            value={answers.fullName}
            onChangeText={(value) => updateAnswer('fullName', value)}
            autoCapitalize="words"
          />
          <TextField
            label="Contact Number"
            value={answers.contactNo}
            onChangeText={(value) => updateAnswer('contactNo', value)}
            keyboardType="phone-pad"
          />
          <TextField
            label="Student Number (optional)"
            value={answers.studentNo}
            onChangeText={(value) => updateAnswer('studentNo', value)}
          />
          <TextField
            label="Street / Address line"
            value={answers.addressLine}
            onChangeText={(value) => updateAnswer('addressLine', value)}
            autoCapitalize="words"
          />
          <TextField
            label="City / Municipality"
            value={answers.cityMunicipality}
            onChangeText={(value) => updateAnswer('cityMunicipality', value)}
            autoCapitalize="words"
          />
          <TextField
            label="Province"
            value={answers.province}
            onChangeText={(value) => updateAnswer('province', value)}
            autoCapitalize="words"
          />
          <SelectField
            label="Program"
            value={answers.program}
            options={PROGRAM_OPTIONS}
            onChange={(value) => updateAnswer('program', value)}
          />
          {answers.program === 'Other / Type manually' ? (
            <TextField
              label="Program / Course"
              value={answers.programManual}
              onChangeText={(value) => updateAnswer('programManual', value)}
              autoCapitalize="words"
            />
          ) : null}
          <SelectField
            label="Year Graduated"
            value={answers.yearGraduated}
            options={YEAR_OPTIONS}
            onChange={updateGraduation}
          />
          {answers.yearGraduated === 'Other / Type manually' ? (
            <TextField
              label="Year Graduated"
              value={answers.yearManual}
              onChangeText={(value) => updateAnswer('yearManual', value)}
              keyboardType="number-pad"
            />
          ) : null}
        </View>
      );
    }

    if (step === 1) {
      return (
        <View style={styles.card}>
          <Illustration
            source={illustrations.validId}
            heightRatio={0.2}
            minHeight={110}
            maxHeight={160}
            accessibilityLabel="Valid ID upload illustration"
          />
          <Text style={styles.cardTitle}>Use a Valid Government ID</Text>
          <Text style={styles.muted}>Accepted IDs</Text>
          <View style={styles.acceptedIdGrid}>
            {['Passport', "Driver's License", 'PhilSys', 'National ID', 'UMID', 'SSS'].map((item) => (
              <View key={item} style={styles.acceptedIdPill}>
                <Text style={styles.acceptedIdText}>{item}</Text>
              </View>
            ))}
          </View>
          <SelectField
            label="Valid ID type"
            value={answers.validIdType}
            options={VALID_ID_TYPES}
            onChange={(value) => updateAnswer('validIdType', value)}
          />
          <PhotoPicker
            title="Front"
            asset={idFront}
            previewLabel="Valid ID front preview"
            onCamera={() => takePhoto(setIdFront)}
            onGallery={() => chooseImage(setIdFront)}
          />
          <PhotoPicker
            title="Back"
            asset={idBack}
            previewLabel="Valid ID back preview"
            onCamera={() => takePhoto(setIdBack)}
            onGallery={() => chooseImage(setIdBack)}
          />
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Liveness Check</Text>
          <Text style={styles.muted}>
            Pass FaceVerifier before review. No separate liveness photo is uploaded.
          </Text>
          {livenessPassedAt ? (
            <Text style={styles.successText}>
              Liveness: Passed ({new Date(livenessPassedAt).toLocaleString()})
            </Text>
          ) : null}
          <Button
            title={livenessPassedAt ? 'Run FaceVerifier Again' : 'Start FaceVerifier'}
            onPress={() => setShowLiveness(true)}
            style={styles.buttonGap}
          />
        </View>
      );
    }

    if (step === 3) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Review</Text>
          <Text style={styles.reviewLine}>Full Name: {answers.fullName}</Text>
          <Text style={styles.reviewLine}>Contact Number: {answers.contactNo}</Text>
          <Text style={styles.reviewLine}>Address: {buildAddress(answers)}</Text>
          <Text style={styles.reviewLine}>Program: {resolveProgram(answers)}</Text>
          <Text style={styles.reviewLine}>
            Year Graduated:{' '}
            {answers.graduationStatus === 'not_graduated_yet'
              ? 'Not graduated yet'
              : resolveYearGraduated(answers)}
          </Text>
          <Text style={styles.reviewLine}>Valid ID: {answers.validIdType}</Text>
          <View style={styles.row}>
            <PhotoPreview asset={idFront} label="Front" style={styles.reviewPreview} />
            <PhotoPreview asset={idBack} label="Back" style={styles.reviewPreview} />
          </View>
          <Text style={styles.reviewLine}>Liveness: {livenessPassedAt ? 'Passed' : 'Not passed'}</Text>
          <Text style={styles.muted}>
            No credential sharing happens here; this only submits your account verification request.
          </Text>
        </View>
      );
    }

    if (step === 4) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Submit</Text>
          <Text style={styles.muted}>Review complete. Confirm the details and submit for registrar review.</Text>
          <Pressable
            style={styles.checkRow}
            onPress={() => updateAnswer('confirmed', !answers.confirmed)}
          >
            <View style={[styles.checkbox, answers.confirmed && styles.checkboxOn]} />
            <Text style={styles.checkText}>I confirm this information is true.</Text>
          </Pressable>
          <Button
            title={submitting ? 'Submitting...' : 'Submit for Verification'}
            loading={submitting}
            onPress={submit}
            disabled={submitting}
            style={styles.buttonGap}
          />
        </View>
      );
    }

    return null;
  }

  if (showLiveness) {
    return (
      <FaceVerifier onClose={() => setShowLiveness(false)} onPassed={handleLivenessPassed} />
    );
  }

  if (loading) {
    return (
      <Screen>
        <Text style={styles.title}>Verification</Text>
        <Text style={styles.muted}>Loading status...</Text>
      </Screen>
    );
  }

  const statusCard = renderStatusCard();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Account Verification</Text>
        <Text style={styles.subtitle}>
          {started ? currentTitle : 'Student wallet onboarding'}
        </Text>

        {renderProgress()}

        {statusCard || renderStep()}

        {started ? (
          <View style={styles.footer}>
            <Button
              title="Back"
              variant="outline"
              onPress={back}
              disabled={submitting}
              style={styles.flex}
            />
            {step < STEPS.length - 1 ? (
              <Button
                title={step === 2 ? 'Review Details' : step === 3 ? 'Continue to Submit' : 'Continue'}
                onPress={next}
                disabled={submitting}
                style={styles.flex}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginTop: spacing.md
  },
  subtitle: {
    color: colors.muted,
    fontWeight: '700'
  },
  progressWrap: {
    gap: spacing.sm
  },
  progressLabel: {
    color: colors.text,
    fontWeight: '900'
  },
  progressLine: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  progressSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  progressDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  progressDotOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  progressConnector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.line
  },
  progressConnectorOn: {
    backgroundColor: colors.primary
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  introCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md
  },
  introTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center'
  },
  introText: {
    color: colors.muted,
    lineHeight: 20,
    textAlign: 'center'
  },
  acceptedIdGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  acceptedIdPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  acceptedIdText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800'
  },
  muted: {
    color: colors.muted,
    lineHeight: 20
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
    borderRadius: radius.md,
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
    borderRadius: radius.md,
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
    borderRadius: radius.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceMuted
  },
  optionText: {
    color: colors.text,
    fontWeight: '800'
  },
  successText: {
    color: colors.primary,
    fontWeight: '800',
    lineHeight: 20
  },
  emptyPreview: {
    minHeight: 180,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg
  },
  emptyText: {
    color: colors.muted,
    fontWeight: '700'
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.bg
  },
  reviewPreview: {
    flex: 1,
    minHeight: 150,
    height: 150
  },
  uploadBlock: {
    gap: spacing.sm
  },
  uploadLabel: {
    color: colors.text,
    fontWeight: '900'
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md
  },
  flex: {
    flex: 1
  },
  buttonGap: {
    marginTop: spacing.sm
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  checkText: {
    color: colors.text,
    fontWeight: '700',
    flex: 1
  },
  reviewLine: {
    color: colors.text,
    fontWeight: '700'
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md
  }
});
