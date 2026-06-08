import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import Button from '@/components/ui/Button';
import FaceVerifier from '@/components/verification/FaceVerifier';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

const CREDENTIAL_TYPES = [
  { label: 'Transcript of Records', value: 'tor' },
  { label: 'Diploma', value: 'diploma' },
];

const REMARK_PRESETS = [
  { label: 'For employment', value: 'employment' },
  { label: 'For scholarship', value: 'scholarship' },
  { label: 'For board exam', value: 'board_exam' },
  { label: 'For transfer', value: 'transfer' },
  { label: 'For personal records', value: 'personal_records' },
  { label: 'Others', value: 'other' },
];

const REMARK_LABELS = {
  employment: 'For employment',
  scholarship: 'For scholarship',
  board_exam: 'For board exam',
  transfer: 'For transfer',
  personal_records: 'For personal records',
};

const ANCHOR_OPTIONS = [
  { label: 'No anchor', value: 'none' },
  { label: 'Anchor request', value: 'request' },
  { label: 'Anchor after signing', value: 'after_signing' },
];

function hasVerifiedStatus(user) {
  if (user?.verified === true) return true;

  return [user?.verified, user?.verificationStatus, user?.status].some(
    (value) => ['verified', 'true'].includes(String(value || '').trim().toLowerCase())
  );
}

function isVerifiedAndLinked(user) {
  return hasVerifiedStatus(user) && Boolean(String(user?.studentId || '').trim());
}

function getRemarkText(form) {
  if (form.presetRemark === 'other') {
    return String(form.customRemark || '').trim();
  }

  return REMARK_LABELS[form.presetRemark] || '';
}

function SelectChip({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : null]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function RequestModal({
  visible,
  form,
  submitting,
  onClose,
  onChange,
  onSubmit,
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Request Credential</Text>
                <Text style={styles.modalSubtitle}>
                  Run the FaceVerifier liveness gate before the request is submitted.
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Credential Type</Text>
              <View style={styles.chipRow}>
                {CREDENTIAL_TYPES.map((item) => (
                  <SelectChip
                    key={item.value}
                    label={item.label}
                    selected={form.credentialType === item.value}
                    onPress={() => onChange('credentialType', item.value)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Anchor Option</Text>
              <View style={styles.chipRow}>
                {ANCHOR_OPTIONS.map((item) => (
                  <SelectChip
                    key={item.value}
                    label={item.label}
                    selected={form.anchorPreference === item.value}
                    onPress={() => onChange('anchorPreference', item.value)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Remarks</Text>
              <View style={styles.chipRow}>
                {REMARK_PRESETS.map((item) => (
                  <SelectChip
                    key={item.value}
                    label={item.label}
                    selected={form.presetRemark === item.value}
                    onPress={() => onChange('presetRemark', item.value)}
                  />
                ))}
              </View>

              {form.presetRemark === 'other' ? (
                <TextField
                  label="Custom remark"
                  value={form.customRemark}
                  onChangeText={(value) => onChange('customRemark', value)}
                  placeholder="Enter your reason"
                />
              ) : null}
            </View>

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                Processing may take up to 3 working days after payment.
              </Text>
              <Text style={styles.noteText}>
                Present the payment code to the cashier after submission.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} />
              <Button
                title="Verify and Submit"
                loading={submitting}
                onPress={onSubmit}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RequestSuccessCard({ request }) {
  if (!request) return null;

  return (
    <View style={styles.successCard}>
      <Text style={styles.requestTitle}>Request Submitted</Text>
      <Text style={styles.noteText}>
        Processing may take up to 3 working days after payment.
      </Text>
      <Text style={styles.statusLine}>
        Payment code: {request?.paymentCode || request?.request?.paymentCode || 'Not generated'}
      </Text>
      <Text style={styles.statusLine}>
        Payment status: {request?.paymentStatus || request?.request?.paymentStatus || 'unpaid'}
      </Text>
      <Text style={styles.noteText}>Present this code to the cashier.</Text>
    </View>
  );
}

export default function HomeScreen() {
  const user = useAppStore((state) => state.user);
  const credentials = useAppStore((state) => state.credentials);
  const notifications = useAppStore((state) => state.notifications);
  const loadCredentials = useAppStore((state) => state.loadCredentials);
  const loadNotifications = useAppStore((state) => state.loadNotifications);
  const requestCredential = useAppStore((state) => state.requestCredential);
  const refreshAccount = useAppStore((state) => state.refreshAccount);

  const [requestVisible, setRequestVisible] = useState(false);
  const [verifierVisible, setVerifierVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastRequest, setLastRequest] = useState(null);
  const [form, setForm] = useState({
    credentialType: 'tor',
    anchorPreference: 'after_signing',
    presetRemark: 'employment',
    customRemark: '',
  });

  const verifiedAndLinked = useMemo(() => isVerifiedAndLinked(user), [user]);

  useFocusEffect(
    useCallback(() => {
      loadCredentials().catch(() => {});
      loadNotifications().catch(() => {});
    }, [loadCredentials, loadNotifications])
  );

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function openRequestModal() {
    let account = user;

    if (!isVerifiedAndLinked(account)) {
      account = await refreshAccount().catch(() => account);
    }

    if (!isVerifiedAndLinked(account)) {
      router.push('/verification/account');
      return;
    }

    setRequestVisible(true);
  }

  function beginLivenessCheck() {
    const remarks = getRemarkText(form);

    if (!remarks) {
      Alert.alert('Missing remark', 'Choose a preset remark or enter a custom one.');
      return;
    }

    setRequestVisible(false);
    setVerifierVisible(true);
  }

  async function submitRequest() {
    const remarks = getRemarkText(form);

    if (!remarks) {
      Alert.alert('Missing remark', 'Choose a preset remark or enter a custom one.');
      return;
    }

    try {
      setSubmitting(true);
      const result = await requestCredential({
        credentialType: form.credentialType,
        anchorPreference: form.anchorPreference,
        presetRemark: form.presetRemark,
        remarks,
        livenessPassed: true,
        livenessMethod: 'faceVerifierLocal',
        livenessPassedAt: new Date().toISOString(),
      });

      setLastRequest(result);
      setVerifierVisible(false);

      const paymentCode =
        result?.paymentCode || result?.request?.paymentCode || 'your payment code';
      Alert.alert(
        'Request submitted',
        `Your request was submitted. Processing may take up to 3 working days after payment.\n\nPayment code: ${paymentCode}\nPresent this code to the cashier.`
      );
    } catch (error) {
      Alert.alert('Request failed', error.message || 'Failed to submit credential request');
      setRequestVisible(true);
      setVerifierVisible(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (verifierVisible) {
    return (
      <FaceVerifier
        onClose={() => {
          setVerifierVisible(false);
          setRequestVisible(true);
        }}
        onPassed={submitRequest}
      />
    );
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>CredPocket</Text>
      <Text style={styles.title}>Hello, {user?.fullName || user?.username || 'Student'}</Text>
      <Text style={styles.subtitle}>
        Your credentials stay on this device until you approve sharing.
      </Text>

      {!verifiedAndLinked ? (
        <Pressable style={styles.verifyCard} onPress={() => router.push('/verification/account')}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.verifyTitle}>Account verification required</Text>
            <Text style={styles.verifyText}>
              Submit your ID and selfie proof for registrar review.
            </Text>
          </View>
        </Pressable>
      ) : null}

      <Pressable style={styles.requestCard} onPress={openRequestModal}>
        <View style={styles.requestIcon}>
          <Ionicons name="document-text-outline" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.requestTitle}>Request Credential</Text>
          <Text style={styles.noteText}>
            Open the request form, pass FaceVerifier, and present the payment code to the cashier.
          </Text>
        </View>
      </Pressable>

      {lastRequest ? <RequestSuccessCard request={lastRequest} /> : null}

      <View style={styles.grid}>
        <Pressable style={styles.card} onPress={() => router.push('/(tabs)/credentials')}>
          <Ionicons name="card-outline" size={24} color={colors.primary} />
          <Text style={styles.cardValue}>{credentials.length}</Text>
          <Text style={styles.cardLabel}>Stored credentials</Text>
        </Pressable>
        <Pressable style={styles.card} onPress={() => router.push('/(tabs)/activity')}>
          <Ionicons name="time-outline" size={24} color={colors.info} />
          <Text style={styles.cardValue}>{notifications.length}</Text>
          <Text style={styles.cardLabel}>Activity items</Text>
        </Pressable>
      </View>

      <Pressable style={styles.scanAction} onPress={() => router.push('/(tabs)/scan')}>
        <Ionicons name="scan-outline" size={22} color="#FFFFFF" />
        <Text style={styles.scanText}>Scan QR Code</Text>
      </Pressable>

      <RequestModal
        visible={requestVisible}
        form={form}
        submitting={submitting}
        onClose={() => setRequestVisible(false)}
        onChange={updateField}
        onSubmit={beginLivenessCheck}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.primary,
    fontWeight: '900',
    marginTop: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  verifyCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  verifyTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  verifyText: {
    color: colors.muted,
    marginTop: 2,
  },
  requestCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  requestIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 16,
  },
  successCard: {
    marginTop: spacing.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  noteText: {
    color: colors.muted,
    lineHeight: 20,
  },
  statusLine: {
    color: colors.text,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  cardLabel: {
    color: colors.muted,
    fontWeight: '700',
  },
  scanAction: {
    marginTop: spacing.xl,
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  scanText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  modalContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: colors.muted,
    marginTop: 4,
    lineHeight: 20,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.text,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: colors.primary,
  },
  noteBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  modalActions: {
    gap: spacing.sm,
  },
});
