import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { formatDate, getCredentialTitle, getHolderName } from '@/utils/credentialUtils';
import { useAppStore } from '@/store/useAppStore';

export default function CredentialDetailScreen() {
  const { id } = useLocalSearchParams();
  const credentials = useAppStore((state) => state.credentials);
  const loadCredentials = useAppStore((state) => state.loadCredentials);
  const deleteCredential = useAppStore((state) => state.deleteCredential);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCredentials().finally(() => setLoading(false));
  }, [loadCredentials]);

  const credential = useMemo(
    () => credentials.find((item) => String(item.id) === String(id)),
    [credentials, id]
  );

  function confirmDelete() {
    Alert.alert('Delete credential?', 'This removes the credential from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCredential(String(id));
          router.replace('/(tabs)/wallet');
        }
      }
    ]);
  }

  if (!credential && !loading) {
    return (
      <Screen>
        <Text style={styles.title}>Credential not found</Text>
        <Button title="Back to Wallet" onPress={() => router.replace('/(tabs)/wallet')} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{getCredentialTitle(credential)}</Text>
        <Text style={styles.subtitle}>{getHolderName(credential)}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Credential ID</Text>
          <Text selectable style={styles.value}>{credential?.id}</Text>
          <Text style={styles.label}>Issued</Text>
          <Text style={styles.value}>{formatDate(credential?.meta?.issuedAt)}</Text>
          <Text style={styles.label}>Issuer</Text>
          <Text style={styles.value}>{credential?.issuer?.name || credential?.issuer || 'Not available'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Stored Credential</Text>
          <Text selectable style={styles.json}>{JSON.stringify(credential, null, 2)}</Text>
        </View>

        <Button
          title="Share Credential"
          onPress={() =>
            router.push({
              pathname: '/vc/share',
              params: { id: String(id) }
            })
          }
        />
        <Button title="Delete From Device" variant="outline" onPress={confirmDelete} />
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
  subtitle: {
    color: colors.muted,
    fontWeight: '700'
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '900',
    marginBottom: spacing.sm
  },
  label: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12
  },
  value: {
    color: colors.text,
    fontWeight: '700'
  },
  json: {
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 12
  }
});

