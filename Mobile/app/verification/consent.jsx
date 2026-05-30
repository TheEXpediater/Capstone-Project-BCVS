import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Button from '@/components/ui/Button';
import CredentialCard from '@/components/vc/CredentialCard';
import Screen from '@/components/ui/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

function textOrFallback(value, fallback = 'Not provided') {
  return value ? String(value) : fallback;
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
  const requestCredentialId = String(
    request?.credentialId || request?.credential_id || ''
  );

  useEffect(() => {
    loadCredentials().catch(() => {});
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

  const selectedCredential = useMemo(
    () =>
      credentials.find((item) => String(item.id) === String(selectedId)) ||
      credentials.find((item) => String(item.id) === requestCredentialId) ||
      credentials[0],
    [credentials, selectedId, requestCredentialId]
  );

  const org = request?.employer?.org || request?.organization || request?.orgName;
  const contact = request?.employer?.contact || request?.contact;
  const purpose = request?.request?.purpose || request?.purpose;

  async function approveRequest() {
    try {
      await approve({
        sessionId: String(sessionId),
        nonce: String(nonce || ''),
        credential: selectedCredential
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
        </View>

        <Text style={styles.sectionTitle}>Choose Credential</Text>
        {credentials.map((credential) => (
          <View
            key={credential.id}
            style={[
              styles.choice,
              String(selectedCredential?.id) === String(credential.id) && styles.choiceActive
            ]}
          >
            <CredentialCard
              credential={credential}
              onPress={() => setSelectedId(String(credential.id))}
            />
          </View>
        ))}

        {!credentials.length && (
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

