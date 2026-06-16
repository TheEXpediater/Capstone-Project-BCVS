import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Button from '@/components/ui/Button';
import CredentialCard from '@/components/vc/CredentialCard';
import Screen from '@/components/ui/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { getCredentialRecordId } from '@/utils/credentialUtils';
import { useAppStore } from '@/store/useAppStore';

function textOrFallback(value, fallback = 'Not provided') {
  return value ? String(value) : fallback;
}

function normalizeType(value) {
  const normalized = String(value || '').toLowerCase().replace(/[\s-]+/g, '_');

  if (['tor', 'transcript', 'transcript_of_records', 'student_record'].includes(normalized)) {
    return 'tor';
  }

  if (normalized.includes('diploma')) return 'diploma';

  return normalized;
}

function typeLabel(value) {
  return normalizeType(value) === 'diploma' ? 'Diploma' : 'Transcript of Records';
}

function titleCase(value) {
  const text = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Pending';
}

function getRecordId(credential) {
  return String(getCredentialRecordId(credential) || credential?.id || credential?._id || '');
}

function getCredentialType(credential) {
  return normalizeType(
    credential?.credentialType ||
      credential?.meta?.credentialType ||
      credential?.vcPayload?.credentialType ||
      credential?.signedCredential?.credentialType ||
      credential?.type
  );
}

function isTerminalStatus(status) {
  return ['presented', 'denied', 'cancelled', 'expired', 'failed'].includes(
    String(status || '').toLowerCase()
  );
}

function statusMessage(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'presented') return 'This request was already approved and shared.';
  if (normalized === 'denied') return 'This request was already denied.';
  if (normalized === 'cancelled') return 'The verifier cancelled this request.';
  if (normalized === 'expired') return 'This verification request expired.';
  if (normalized === 'failed') return 'This verification request failed.';
  if (normalized === 'draft') return 'The verifier has opened the QR link but has not requested consent yet.';

  return 'Review the request and choose whether to share the selected credential.';
}

export default function ConsentScreen() {
  const { sessionId, nonce } = useLocalSearchParams();
  const loadRequest = useAppStore((state) => state.loadVerificationRequest);
  const approve = useAppStore((state) => state.approveVerificationRequest);
  const deny = useAppStore((state) => state.denyVerificationRequest);
  const credentials = useAppStore((state) => state.credentials);
  const loadCredentials = useAppStore((state) => state.loadCredentials);
  const request = useAppStore((state) => state.activeRequest);
  const loading = useAppStore((state) => state.loading.verification);
  const credentialLoading = useAppStore((state) => state.loading.credentials);

  const [selectedId, setSelectedId] = useState('');
  const [allowPdfDownload, setAllowPdfDownload] = useState(false);

  const requestCredentialId = String(
    request?.credentialId ||
      request?.credential_id ||
      request?.request?.credentialId ||
      request?.request?.credential_id ||
      ''
  );

  const requestCredentialType = normalizeType(
    request?.credentialType ||
      request?.credential_type ||
      request?.request?.credentialType ||
      request?.request?.credential_type
  );

  const requestedPdf = Boolean(
    request?.requestedPdf ||
      request?.request?.requestedPdf ||
      request?.request?.requiresPdf
  );

  const requestStatus = String(request?.status || '').toLowerCase();
  const canRespond = Boolean(sessionId) && !isTerminalStatus(requestStatus) && requestStatus !== 'draft';

  useEffect(() => {
    setAllowPdfDownload(false);
    setSelectedId('');

    loadCredentials({ sync: true }).catch(() => {
      loadCredentials().catch(() => {});
    });

    if (sessionId) {
      loadRequest(String(sessionId), String(nonce || '')).catch((error) => {
        Alert.alert('Request unavailable', error.message);
      });
    }
  }, [sessionId, nonce, loadCredentials, loadRequest]);

  useEffect(() => {
    if (!selectedId && requestCredentialId) {
      setSelectedId(requestCredentialId);
    }
  }, [requestCredentialId, selectedId]);

  const credentialOptions = useMemo(() => {
    const rows = requestCredentialId
      ? credentials.filter((item) => getRecordId(item) === requestCredentialId)
      : credentials;

    if (!requestCredentialType) return rows;

    const filtered = rows.filter((item) => {
      const type = getCredentialType(item);
      return !type || type === requestCredentialType;
    });

    return filtered.length ? filtered : rows;
  }, [credentials, requestCredentialId, requestCredentialType]);

  const selectedCredential = useMemo(
    () =>
      credentialOptions.find((item) => getRecordId(item) === String(selectedId)) ||
      credentialOptions.find((item) => getRecordId(item) === requestCredentialId) ||
      credentialOptions[0] ||
      null,
    [credentialOptions, selectedId, requestCredentialId]
  );

  const org = request?.employer?.org || request?.organization || request?.orgName || request?.request?.organization;
  const contact = request?.employer?.contact || request?.contact || request?.request?.contact;
  const purpose = request?.request?.purpose || request?.purpose;
  const verifierName = textOrFallback(org, 'Verifier');
  const proofNote =
    'Approval sends the signed VC payload to the server. The server then verifies the VC hash, issuer signature, Merkle proof, and blockchain anchor before showing the result to the verifier.';

  async function approveRequest() {
    if (!selectedCredential) {
      Alert.alert(
        'Credential not available',
        'This request matches a credential that is not stored on this device yet. Claim or sync the credential first.'
      );
      return;
    }

    try {
      await approve({
        sessionId: String(sessionId),
        nonce: String(nonce || ''),
        credential: selectedCredential,
        allowPdfDownload
      });

      Alert.alert('Credential shared', 'The verifier can now see the verification result.');
      router.replace('/(tabs)/activity');
    } catch (error) {
      Alert.alert('Share failed', error.message);
    }
  }

  async function denyRequest() {
    try {
      await deny(String(sessionId), String(nonce || ''));
      Alert.alert('Request denied', 'No credential was shared.');
      router.replace('/(tabs)/activity');
    } catch (error) {
      Alert.alert('Deny failed', error.message);
    }
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Holder Consent</Text>
        <Text style={styles.title}>Verification Request</Text>

        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{titleCase(requestStatus || 'loading')}</Text>
            </View>
            <View style={[styles.statusPill, isTerminalStatus(requestStatus) && styles.statusPillMuted]}>
              <Text style={styles.statusPillText}>{canRespond ? 'Action needed' : titleCase(requestStatus)}</Text>
            </View>
          </View>

          <Text style={styles.helper}>{statusMessage(requestStatus)}</Text>

          <Text style={styles.label}>Organization</Text>
          <Text style={styles.value}>{verifierName}</Text>

          <Text style={styles.label}>Contact</Text>
          <Text style={styles.value}>{textOrFallback(contact)}</Text>

          <Text style={styles.label}>Purpose</Text>
          <Text style={styles.value}>{textOrFallback(purpose, 'Credential verification')}</Text>

          <Text style={styles.label}>Requested document</Text>
          <Text style={styles.value}>{typeLabel(requestCredentialType)}</Text>

          <Text style={styles.label}>Credential ID</Text>
          <Text selectable style={styles.value}>{textOrFallback(requestCredentialId)}</Text>

          <Text style={styles.label}>PDF download</Text>
          <Text style={styles.value}>{requestedPdf ? 'Requested by verifier' : 'Not requested'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Two-layer verification</Text>
          <Text style={styles.helper}>{proofNote}</Text>
          <View style={styles.proofRow}>
            <Text style={styles.proofLabel}>Layer 1</Text>
            <Text style={styles.proofValue}>Holder consent and credential ownership</Text>
          </View>
          <View style={styles.proofRow}>
            <Text style={styles.proofLabel}>Layer 2</Text>
            <Text style={styles.proofValue}>VC signature, Merkle proof, and blockchain anchor</Text>
          </View>
        </View>

        {requestedPdf ? (
          <Pressable
            style={[styles.toggle, allowPdfDownload && styles.toggleActive]}
            onPress={() => setAllowPdfDownload((value) => !value)}
            disabled={!canRespond}
          >
            <View style={[styles.check, allowPdfDownload && styles.checkActive]}>
              {allowPdfDownload && <View style={styles.checkDot} />}
            </View>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Allow PDF download</Text>
              <Text style={styles.toggleHelp}>The verifier can download JSON proof either way.</Text>
            </View>
          </Pressable>
        ) : null}

        <Text style={styles.sectionTitle}>Credential to share</Text>

        {credentialLoading ? (
          <Text style={styles.empty}>Syncing stored credentials...</Text>
        ) : null}

        {credentialOptions.map((credential) => {
          const recordId = getRecordId(credential);

          return (
            <View
              key={recordId || credential.id}
              style={[
                styles.choice,
                selectedCredential && getRecordId(selectedCredential) === recordId && styles.choiceActive
              ]}
            >
              <CredentialCard
                credential={credential}
                onPress={() => setSelectedId(String(recordId))}
              />
            </View>
          );
        })}

        {!credentialOptions.length && !credentialLoading ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>No matching credential found</Text>
            <Text style={styles.empty}>
              This request is for a credential that is not currently stored on this device.
              Claim or sync the credential first, then reopen this request.
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {canRespond ? (
            <>
              <Button title="Deny" variant="outline" onPress={denyRequest} loading={loading} />
              <Button
                title="Approve Sharing"
                onPress={approveRequest}
                loading={loading}
                disabled={!selectedCredential}
              />
            </>
          ) : (
            <Button title="Back to Activity" variant="outline" onPress={() => router.replace('/(tabs)/activity')} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    textTransform: 'uppercase'
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900'
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs
  },
  statusRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm
  },
  statusPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  statusPillMuted: {
    backgroundColor: colors.surfaceMuted
  },
  statusPillText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900'
  },
  label: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12,
    marginTop: spacing.sm
  },
  value: {
    color: colors.text,
    fontWeight: '700',
    lineHeight: 20
  },
  helper: {
    color: colors.muted,
    lineHeight: 20,
    marginBottom: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
    marginTop: spacing.md
  },
  proofRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs
  },
  proofLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  proofValue: {
    color: colors.text,
    fontWeight: '800',
    lineHeight: 20
  },
  choice: {
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  choiceActive: {
    borderColor: colors.primary
  },
  toggle: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md
  },
  toggleActive: {
    borderColor: colors.primary
  },
  check: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 6,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24
  },
  checkActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  checkDot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    height: 10,
    width: 10
  },
  toggleCopy: {
    flex: 1
  },
  toggleTitle: {
    color: colors.text,
    fontWeight: '900'
  },
  toggleHelp: {
    color: colors.muted,
    marginTop: 2
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 16
  },
  empty: {
    color: colors.muted,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: spacing.md
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.md
  }
});
