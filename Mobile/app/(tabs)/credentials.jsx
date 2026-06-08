import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
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

  function renderHeader() {
    return (
      <View style={styles.header}>
        <Text style={styles.title}>Stored Credentials</Text>
        <Text style={styles.subtitle}>Credentials saved on this device.</Text>
      </View>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={credentials}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={renderHeader}
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
            body="Claim an issued credential using the Scan tab once it is ready."
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
  header: {
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900'
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 20
  }
});
