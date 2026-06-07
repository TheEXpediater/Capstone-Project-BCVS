import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import CredentialCard from '@/components/vc/CredentialCard';
import EmptyState from '@/components/ui/EmptyState';
import Screen from '@/components/ui/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

function formatDate(value) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

function RequestStatusCard({ request }) {
  const paid = String(request?.paymentStatus || 'unpaid').toLowerCase() === 'paid';
  const signed = ['signed', 'claim_ready', 'claimed', 'anchored'].includes(String(request?.status || ''));

  return (
    <View style={styles.requestStatus}>
      <View style={styles.statusHeader}>
        <Text style={styles.statusTitle}>{request?.credentialType || 'Student Record Credential'}</Text>
        <Text style={[styles.badge, paid ? styles.badgePaid : styles.badgeUnpaid]}>
          {paid ? 'Payment received' : 'Waiting for payment'}
        </Text>
      </View>
      <Text style={styles.statusLine}>Request status: {request?.status || 'draft'}</Text>
      <Text style={styles.statusLine}>Payment code: {request?.paymentCode || 'Not generated'}</Text>
      {request?.receiptNo ? <Text style={styles.statusLine}>Receipt No: {request.receiptNo}</Text> : null}
      <Text style={styles.statusLine}>Paid at: {formatDate(request?.paidAt)}</Text>
      <Text style={styles.statusLine}>Credential status: {signed ? request.status : 'Processing'}</Text>
      {signed ? <Text style={styles.note}>Use the Scan tab to claim the VC when the claim QR is ready.</Text> : null}
      <Text style={styles.note}>Processing may take up to 3 working days after payment.</Text>
    </View>
  );
}

export default function CredentialsScreen() {
  const credentials = useAppStore((state) => state.credentials);
  const credentialRequests = useAppStore((state) => state.credentialRequests);
  const loadingRequests = useAppStore((state) => state.loading.requests);
  const loadCredentials = useAppStore((state) => state.loadCredentials);
  const loadCredentialRequests = useAppStore((state) => state.loadCredentialRequests);

  useFocusEffect(
    useCallback(() => {
      loadCredentials().catch(() => {});
      loadCredentialRequests().catch(() => {});
    }, [loadCredentials, loadCredentialRequests])
  );

  function renderHeader() {
    return (
      <View style={styles.header}>
        <Text style={styles.title}>Stored Credentials</Text>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Request Status</Text>
          {loadingRequests ? (
            <Text style={styles.note}>Loading requests...</Text>
          ) : credentialRequests.length ? (
            credentialRequests.slice(0, 3).map((request) => (
              <RequestStatusCard key={request._id || request.id} request={request} />
            ))
          ) : (
            <Text style={styles.note}>No credential requests yet.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Wallet</Text>
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
  header: {
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: spacing.sm
  },
  sectionBlock: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 17
  },
  requestStatus: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'flex-start'
  },
  statusTitle: {
    color: colors.text,
    fontWeight: '900',
    flex: 1
  },
  statusLine: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13
  },
  badge: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 11,
    fontWeight: '900'
  },
  badgePaid: {
    color: colors.primary,
    backgroundColor: colors.primarySoft
  },
  badgeUnpaid: {
    color: colors.warning,
    backgroundColor: '#FEF3C7'
  },
  note: {
    color: colors.muted,
    lineHeight: 20
  }
});

