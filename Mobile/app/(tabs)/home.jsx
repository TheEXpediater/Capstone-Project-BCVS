import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import FaceVerifier from '@/components/verification/FaceVerifier';
import Illustration from '@/components/ui/Illustration';
import Screen from '@/components/ui/Screen';
import { illustrations } from '@/constants/illustrations';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

const CREDENTIAL_TYPES = [
  {
    label: 'Transcript of Records (TOR)',
    value: 'tor',
    payloadValue: 'TOR',
    icon: 'school-outline',
    body: 'Official academic transcript.'
  },
  {
    label: 'Diploma',
    value: 'diploma',
    payloadValue: 'DIPLOMA',
    icon: 'ribbon-outline',
    body: 'Official diploma certificate.'
  },
];

const BASE_CREDENTIAL_AMOUNT = 150;
const ANCHOR_NOW_FEE = 20;

function hasVerifiedStatus(user) {
  if (user?.verified === true) return true;

  return [user?.verified, user?.verificationStatus, user?.status].some(
    (value) => ['verified', 'true'].includes(String(value || '').trim().toLowerCase())
  );
}

function isVerifiedAndLinked(user) {
  return hasVerifiedStatus(user) && Boolean(String(user?.studentId || '').trim());
}

function formatPeso(value) {
  const amount = Number(value || 0);
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getRequestTotal(form) {
  return BASE_CREDENTIAL_AMOUNT + (form.anchorNow ? ANCHOR_NOW_FEE : 0);
}

function selectedCredentialOption(form) {
  return CREDENTIAL_TYPES.find((item) => item.value === form.credentialType) || CREDENTIAL_TYPES[0];
}

function StepIndicator({ step }) {
  return (
    <View style={styles.stepWrap}>
      {[1, 2].map((item) => {
        const active = step >= item;

        return (
          <View key={item} style={styles.stepItem}>
            <View style={[styles.stepDot, active && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{item}</Text>
            </View>
            {item === 1 ? <View style={[styles.stepLine, step === 2 && styles.stepLineActive]} /> : null}
          </View>
        );
      })}
      <Text style={styles.stepText}>Step {step} of 2</Text>
    </View>
  );
}

function CredentialOptionCard({ option, selected, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.optionCard, selected && styles.optionCardSelected]}
    >
      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
        <Ionicons name={option.icon} size={22} color={selected ? '#FFFFFF' : colors.primary} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{option.label}</Text>
        <Text style={styles.optionBody}>{option.body}</Text>
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? colors.primary : colors.muted}
      />
    </Pressable>
  );
}

function SummaryRow({ label, value }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function RequestModal({
  visible,
  form,
  step,
  onClose,
  onChange,
  onNext,
  onBack,
  onSubmit,
}) {
  const selectedOption = selectedCredentialOption(form);
  const remarks = String(form.remarks || '').trim();
  const total = getRequestTotal(form);
  const isTor = form.credentialType === 'tor';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {step === 1 ? 'Request Credential' : 'Request Summary'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {step === 1
                    ? 'Select the credential you would like to request.'
                    : 'Review your request before identity verification.'}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <StepIndicator step={step} />

            {step === 1 ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Credential Type</Text>
                  <View style={styles.optionStack}>
                    {CREDENTIAL_TYPES.map((item) => (
                      <CredentialOptionCard
                        key={item.value}
                        option={item}
                        selected={form.credentialType === item.value}
                        onPress={() => {
                          onChange('credentialType', item.value);
                          if (item.value === 'diploma') {
                            onChange('remarks', '');
                          }
                        }}
                      />
                    ))}
                  </View>
                </View>

                {isTor ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Remarks (Optional)</Text>
                    <TextInput
                      value={form.remarks}
                      onChangeText={(value) => onChange('remarks', value)}
                      placeholder={'Example:\nFor board examination\nEmployment requirements\nTransfer to another university'}
                      placeholderTextColor={colors.muted}
                      multiline
                      textAlignVertical="top"
                      style={styles.remarksInput}
                    />
                  </View>
                ) : null}

                <View style={styles.modalActions}>
                  <Button title="Cancel" variant="outline" onPress={onClose} />
                  <Button title="Next" onPress={onNext} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.summaryCard}>
                  <SummaryRow label="Credential" value={selectedOption.label.replace(' (TOR)', '')} />
                  <SummaryRow label="Remarks" value={remarks || 'None'} />
                  <SummaryRow label="Processing Fee" value={formatPeso(BASE_CREDENTIAL_AMOUNT)} />
                  <SummaryRow label="Blockchain Anchoring" value={form.anchorNow ? 'Enabled' : 'Disabled'} />
                </View>

                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: form.anchorNow }}
                  onPress={() => onChange('anchorNow', !form.anchorNow)}
                  style={[styles.anchorToggle, form.anchorNow && styles.anchorToggleOn]}
                >
                  <View style={[styles.switchTrack, form.anchorNow && styles.switchTrackOn]}>
                    <View style={[styles.switchThumb, form.anchorNow && styles.switchThumbOn]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.anchorToggleTitle}>Anchor Credential to Blockchain</Text>
                    <Text style={styles.anchorToggleText}>
                      Anchoring permanently records your credential on the blockchain for public verification.
                    </Text>
                    <Text style={styles.anchorToggleText}>
                      Additional fees may apply if enabled.
                    </Text>
                  </View>
                  <Text style={styles.switchLabel}>{form.anchorNow ? 'ON' : 'OFF'}</Text>
                </Pressable>

                <View style={styles.priceBox}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Processing Fee</Text>
                    <Text style={styles.priceValue}>{formatPeso(BASE_CREDENTIAL_AMOUNT)}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Anchor Now</Text>
                    <Text style={styles.priceValue}>
                      {form.anchorNow ? formatPeso(ANCHOR_NOW_FEE) : formatPeso(0)}
                    </Text>
                  </View>
                  <View style={[styles.priceRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Estimated Total</Text>
                    <Text style={styles.totalValue}>{formatPeso(total)}</Text>
                  </View>
                </View>

                <View style={styles.noteBox}>
                  <Text style={styles.noteText}>
                    Processing may take up to 3 working days after payment.
                  </Text>
                  <Text style={styles.noteText}>
                    Present the payment code to the cashier after submission.
                  </Text>
                </View>

                <View style={styles.modalActionsRow}>
                  <Button title="Back" variant="outline" onPress={onBack} style={styles.flex} />
                  <Button title="Continue" onPress={onSubmit} style={styles.flex} />
                </View>
              </>
            )}
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
      <Illustration
        source={illustrations.success}
        heightRatio={0.16}
        minHeight={96}
        maxHeight={140}
        accessibilityLabel="Request submitted"
        style={styles.successIllustration}
      />
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
  const credentialsLoading = useAppStore((state) => state.loading.credentials);
  const loadCredentials = useAppStore((state) => state.loadCredentials);
  const loadNotifications = useAppStore((state) => state.loadNotifications);
  const requestCredential = useAppStore((state) => state.requestCredential);
  const refreshAccount = useAppStore((state) => state.refreshAccount);

  const [requestVisible, setRequestVisible] = useState(false);
  const [requestStep, setRequestStep] = useState(1);
  const [verifierVisible, setVerifierVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastRequest, setLastRequest] = useState(null);
  const [form, setForm] = useState({
    credentialType: 'tor',
    anchorNow: false,
    remarks: '',
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
    setRequestStep(1);
  }

  function closeRequestModal() {
    setRequestVisible(false);
    setRequestStep(1);
  }

  function goToSummary() {
    if (!form.credentialType) {
      Alert.alert('Credential type required', 'Select a credential type before continuing.');
      return;
    }

    setRequestStep(2);
  }

  function beginLivenessCheck() {
    if (!form.credentialType) {
      Alert.alert('Credential type required', 'Select a credential type before continuing.');
      return;
    }

    setRequestVisible(false);
    setVerifierVisible(true);
  }

  async function submitRequest() {
    const option = selectedCredentialOption(form);
    const remarks = form.credentialType === 'tor' ? String(form.remarks || '').trim() : '';

    try {
      setSubmitting(true);
      const result = await requestCredential({
        credentialType: option.payloadValue,
        anchorPreference: form.anchorNow ? 'anchor_now' : 'after_signing',
        anchorMode: form.anchorNow ? 'anchor_now' : 'default',
        anchorNow: form.anchorNow,
        amount: getRequestTotal(form),
        totalAmount: getRequestTotal(form),
        presetRemark: '',
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
      setRequestStep(2);
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
          setRequestStep(2);
        }}
        onPassed={submitRequest}
      />
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>CredPocket</Text>
        <Text style={styles.title}>Hello, {user?.fullName || user?.username || 'Student'}</Text>
        <Text style={styles.subtitle}>
          Your credentials stay on this device until you approve sharing.
        </Text>

        {credentialsLoading ? (
          <View style={styles.heroCard}>
            <Illustration
              source={illustrations.loadingCredentials}
              heightRatio={0.22}
              minHeight={120}
              maxHeight={180}
              accessibilityLabel="Loading credentials"
            />
            <Text style={styles.heroTitle}>Loading credentials...</Text>
          </View>
        ) : credentials.length ? (
          <View style={styles.heroCard}>
            <Illustration
              source={illustrations.wallet}
              heightRatio={0.24}
              minHeight={130}
              maxHeight={190}
              accessibilityLabel="Digital wallet"
            />
            <Text style={styles.heroTitle}>Your wallet is ready</Text>
            <Text style={styles.noteText}>View, scan, and share academic credentials securely.</Text>
          </View>
        ) : (
          <View style={styles.heroCard}>
            <EmptyState
              illustration={illustrations.emptyCredentials}
              title="No Credentials Yet"
              body="Verified credentials will appear here once issued."
            />
          </View>
        )}

      {!verifiedAndLinked ? (
        <Pressable style={styles.verifyCard} onPress={() => router.push('/verification/account')}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.verifyTitle}>Account verification required</Text>
            <Text style={styles.verifyText}>
              Submit your ID and pass FaceVerifier for registrar review.
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
        step={requestStep}
        onClose={closeRequestModal}
        onChange={updateField}
        onNext={goToSummary}
        onBack={() => setRequestStep(1)}
        onSubmit={beginLivenessCheck}
      />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl
  },
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
  heroCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
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
  successIllustration: {
    marginBottom: spacing.xs,
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
  anchorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  helpButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  anchorToggle: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  anchorToggleOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  anchorToggleTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  anchorToggleText: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: 2,
  },
  priceBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.bg,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  priceLabel: {
    color: colors.muted,
    fontWeight: '700',
  },
  priceValue: {
    color: colors.text,
    fontWeight: '800',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  totalLabel: {
    color: colors.text,
    fontWeight: '900',
  },
  totalValue: {
    color: colors.primary,
    fontWeight: '900',
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
