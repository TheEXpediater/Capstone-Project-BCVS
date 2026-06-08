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

export default function ConsentScreen() {
  const { sessionId, nonce } = useLocalSearchParams();
  const loadRequest = useAppStore((state) => state.loadVerificationRequest);
  const approve = useAppStore((state) => state.approveVerificationRequest);
  const deny = useAppStore((state) => state.denyVerificationRequest);
  const credentials = useAppStore((state) => state.credentials);
  const loadCredentials = useAppStore((state) => state.loadCredentials);
  const request = useAppStore((state) => state.activeRequest);
  const loading = useAppStore((state) => state.loading.verification);
  const [selectedId, setSelectedId] = useState('');
  const [allowPdfDownload, setAllowPdfDownload] = useState(false);
  const requestCredentialId = String(
    request?.credentialId || request?.credential_id || ''
  );
  const requestCredentialType = normalizeType(
    request?.credentialType || request?.request?.credentialType
  );
  const requestedPdf = Boolean(request?.requestedPdf || request?.request?.requestedPdf);

  useEffect(() => {
    loadCredentials().catch(() => {});
    setAllowPdfDownload(false);
    setSelectedId('');
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
      ? credentials.filter((item) => String(getCredentialRecordId(item)) === requestCredentialId)
      : credentials;

    if (!requestCredentialType) return rows;

    const filtered = rows.filter((item) => {
      const type = normalizeType(item?.credentialType || item?.meta?.credentialType || item?.vcPayload?.credentialType);
      return !type || type === requestCredentialType;
    });

    return filtered.length ? filtered : rows;
  }, [credentials, requestCredentialId, requestCredentialType]);

  const selectedCredential = useMemo(
    () =>
      credentialOptions.find((item) => String(getCredentialRecordId(item)) === String(selectedId)) ||
      credentialOptions.find((item) => String(getCredentialRecordId(item)) === requestCredentialId) ||
      credentialOptions[0],
    [credentialOptions, selectedId, requestCredentialId]
  );

  const org = request?.employer?.org || request?.organization || request?.orgName;
  const contact = request?.employer?.contact || request?.contact;
  const purpose = request?.request?.purpose || request?.purpose;

  async function approveRequest() {
    try {
      await approve({
        sessionId: String(sessionId),
        nonce: String(nonce || ''),
        credential: selectedCredential,
        allowPdfDownload
      });
      Alert.alert('Credential shared', 'Your credential was sent to the verifier.');
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
        <Text style={styles.title}>Verification Request</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Organization</Text>
          <Text style={styles.value}>{textOrFallback(org)}</Text>
          <Text style={styles.label}>Contact</Text>
          <Text style={styles.value}>{textOrFallback(contact)}</Text>
          <Text style={styles.label}>Purpose</Text>
          <Text style={styles.value}>{textOrFallback(purpose, 'Credential verification')}</Text>
          <Text style={styles.label}>Requested document</Text>
          <Text style={styles.value}>{typeLabel(requestCredentialType)}</Text>
          <Text style={styles.label}>PDF download</Text>
          <Text style={styles.value}>{requestedPdf ? 'Requested by verifier' : 'Not requested'}</Text>
        </View>

        <Pressable
          style={[styles.toggle, allowPdfDownload && styles.toggleActive]}
          onPress={() => setAllowPdfDownload((value) => !value)}
        >
          <View style={[styles.check, allowPdfDownload && styles.checkActive]}>
            {allowPdfDownload && <View style={styles.checkDot} />}
          </View>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Allow PDF download</Text>
            <Text style={styles.toggleHelp}>The verifier can download JSON proof either way.</Text>
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>Choose Credential</Text>
        {credentialOptions.map((credential) => {
          const recordId = getCredentialRecordId(credential) || credential.id;
          return (
          <View
            key={recordId}
            style={[
              styles.choice,
              String(getCredentialRecordId(selectedCredential)) === String(recordId) && styles.choiceActive
            ]}
          >
            <CredentialCard
              credential={credential}
              onPress={() => setSelectedId(String(recordId))}
            />
          </View>
          );
        })}

        {!credentialOptions.length && (
          <Text style={styles.empty}>No credentials are stored on this device.</Text>
        )}

        <View style={styles.actions}>
          <Button title="Deny" variant="outline" onPress={denyRequest} loading={loading} />
          <Button
            title="Approve Sharing"
            onPress={approveRequest}
            loading={loading}
            disabled={!selectedCredential}
          />
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
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginTop: spacing.lg
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs
  },
  label: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12
  },
  value: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
    marginTop: spacing.md
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
  empty: {
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.xl
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.md
  }
});

