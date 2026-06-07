import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

const STEPS = ['Intro', 'ID Front', 'ID Back', 'Selfie', 'Questions', 'Review'];

function statusOf(user, account) {
  return String(account?.status || user?.verified || 'unverified').toLowerCase();
}

function PhotoPreview({ asset, label }) {
  if (!asset?.uri) {
    return <View style={styles.emptyPreview}><Text style={styles.emptyText}>{label}</Text></View>;
  }

  return <Image source={{ uri: asset.uri }} style={styles.preview} />;
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
  const [selfie, setSelfie] = useState(null);
  const [answers, setAnswers] = useState({
    studentNo: user?.studentId || '',
    fullName: user?.fullName || '',
    program: '',
    yearLevel: '',
    dateOfBirth: '',
    confirmed: false,
  });

  const status = statusOf(user, account);
  const approved = status === 'verified';
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

  async function chooseImage(setter) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
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
      quality: 0.8,
    });

    if (!result.canceled) {
      setter(result.assets[0]);
    }
  }

  function next() {
    if (step === 1 && !idFront) {
      Alert.alert('ID front required', 'Upload or take a photo of the front of your valid ID.');
      return;
    }

    if (step === 2 && !idBack) {
      Alert.alert('ID back required', 'Upload or take a photo of the back of your valid ID.');
      return;
    }

    if (step === 3 && !selfie) {
      Alert.alert('Selfie required', 'Take a clear selfie proof for manual review.');
      return;
    }

    if (step === 4) {
      if (!answers.fullName.trim() || !answers.program.trim() || !answers.yearLevel.trim()) {
        Alert.alert('Missing answers', 'Full name, program/course, and year level are required.');
        return;
      }

      if (!answers.confirmed) {
        Alert.alert('Confirmation required', 'Please confirm that the information is true.');
        return;
      }
    }

    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  async function submit() {
    try {
      setSubmitting(true);
      await submitAccountVerification({ idFront, idBack, selfie, answers });
      await refreshAccount();
      const data = await loadAccountVerification();
      setAccount(data);
      setStarted(false);
      setStep(0);
      Alert.alert('Submitted', 'Your request is pending registrar review.');
    } catch (error) {
      Alert.alert('Submit failed', error.message);
    } finally {
      setSubmitting(false);
    }
  }

  function renderStatusCard() {
    if (approved) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account verified</Text>
          <Text style={styles.muted}>Your account is linked to {user?.studentId || account?.user?.studentId || 'your student record'}.</Text>
          <Button title="Back to Wallet" onPress={() => router.replace('/(tabs)/home')} style={styles.buttonGap} />
        </View>
      );
    }

    if (pending && !started) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pending registrar review</Text>
          <Text style={styles.muted}>Your submitted ID and selfie proof are waiting for manual review.</Text>
          <Button title="Back" variant="outline" onPress={() => router.back()} style={styles.buttonGap} />
        </View>
      );
    }

    if (rejected && !started) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification rejected</Text>
          <Text style={styles.muted}>{account?.submission?.rejectionReason || 'Please submit updated proof for review.'}</Text>
          <Button title="Start Verification" onPress={() => setStarted(true)} style={styles.buttonGap} />
        </View>
      );
    }

    return null;
  }

  function renderStep() {
    if (!started) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Before you can claim your VC, your account must be verified by the registrar.</Text>
          <Text style={styles.muted}>You will submit a valid ID, a selfie proof for manual review, and a few basic details.</Text>
          <Button title="Start Verification" onPress={() => setStarted(true)} style={styles.buttonGap} />
        </View>
      );
    }

    if (step === 1) {
      return (
        <View style={styles.card}>
          <PhotoPreview asset={idFront} label="Valid ID front preview" />
          <View style={styles.row}>
            <Button title="Take Photo" onPress={() => takePhoto(setIdFront)} style={styles.flex} />
            <Button title="Choose Photo" variant="outline" onPress={() => chooseImage(setIdFront)} style={styles.flex} />
          </View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.card}>
          <PhotoPreview asset={idBack} label="Valid ID back preview" />
          <View style={styles.row}>
            <Button title="Take Photo" onPress={() => takePhoto(setIdBack)} style={styles.flex} />
            <Button title="Choose Photo" variant="outline" onPress={() => chooseImage(setIdBack)} style={styles.flex} />
          </View>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View style={styles.card}>
          <Text style={styles.muted}>Take a clear selfie while holding your ID. This is only for manual registrar review.</Text>
          <PhotoPreview asset={selfie} label="Selfie proof preview" />
          <Button title="Open Camera" onPress={() => takePhoto(setSelfie)} style={styles.buttonGap} />
        </View>
      );
    }

    if (step === 4) {
      return (
        <View style={styles.card}>
          <TextField label="Student Number (optional)" value={answers.studentNo} onChangeText={(value) => updateAnswer('studentNo', value)} />
          <TextField label="Full Name" value={answers.fullName} onChangeText={(value) => updateAnswer('fullName', value)} autoCapitalize="words" />
          <TextField label="Program / Course" value={answers.program} onChangeText={(value) => updateAnswer('program', value)} autoCapitalize="characters" />
          <TextField label="Year Level" value={answers.yearLevel} onChangeText={(value) => updateAnswer('yearLevel', value)} />
          <TextField label="Date of Birth (optional)" value={answers.dateOfBirth} onChangeText={(value) => updateAnswer('dateOfBirth', value)} placeholder="YYYY-MM-DD" />
          <Pressable style={styles.checkRow} onPress={() => updateAnswer('confirmed', !answers.confirmed)}>
            <View style={[styles.checkbox, answers.confirmed && styles.checkboxOn]} />
            <Text style={styles.checkText}>I confirm this information is true.</Text>
          </Pressable>
        </View>
      );
    }

    if (step === 5) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Review and submit</Text>
          <Text style={styles.reviewLine}>Student No: {answers.studentNo || 'Not provided'}</Text>
          <Text style={styles.reviewLine}>Full Name: {answers.fullName}</Text>
          <Text style={styles.reviewLine}>Program: {answers.program}</Text>
          <Text style={styles.reviewLine}>Year Level: {answers.yearLevel}</Text>
          <View style={styles.row}>
            <PhotoPreview asset={idFront} label="Front" />
            <PhotoPreview asset={idBack} label="Back" />
          </View>
          <PhotoPreview asset={selfie} label="Selfie" />
          <Button title="Submit for Review" loading={submitting} onPress={submit} style={styles.buttonGap} />
        </View>
      );
    }

    return null;
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
        <Text style={styles.subtitle}>{started ? `Step ${step + 1} of ${STEPS.length}: ${currentTitle}` : 'Registrar review required'}</Text>

        {statusCard || renderStep()}

        {started ? (
          <View style={styles.footer}>
            <Button title="Back" variant="outline" onPress={() => (step === 0 ? setStarted(false) : setStep((prev) => prev - 1))} disabled={submitting} style={styles.flex} />
            {step < STEPS.length - 1 ? (
              <Button title="Next" onPress={next} style={styles.flex} />
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
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  subtitle: {
    color: colors.muted,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  muted: {
    color: colors.muted,
    lineHeight: 20,
  },
  emptyPreview: {
    minHeight: 180,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  emptyText: {
    color: colors.muted,
    fontWeight: '700',
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  buttonGap: {
    marginTop: spacing.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkText: {
    color: colors.text,
    fontWeight: '700',
    flex: 1,
  },
  reviewLine: {
    color: colors.text,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
