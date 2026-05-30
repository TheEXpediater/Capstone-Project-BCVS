import { useCallback } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import CredentialCard from '@/components/vc/CredentialCard';
import EmptyState from '@/components/ui/EmptyState';
import Screen from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

export default function CredentialsScreen() {
  const credentials = useAppStore((state) => state.credentials);
  const loadCredentials = useAppStore((state) => state.loadCredentials);

  useFocusEffect(
    useCallback(() => {
      loadCredentials().catch(() => {});
    }, [loadCredentials])
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={credentials}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Text style={styles.title}>Stored Credentials</Text>}
        renderItem={({ item }) => (
          <CredentialCard
            credential={item}
            onPress={() => router.push(`/vc/${encodeURIComponent(item.id)}`)}
          />
        )}
        ItemSeparatorComponent={() => null}
        ListEmptyComponent={
          <EmptyState
            title="No credentials yet"
            body="Scan a claim QR code to save your first verifiable credential."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: spacing.sm
  }
});

