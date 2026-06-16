import { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import CredentialCard from '@/components/vc/CredentialCard';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Screen from '@/components/ui/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import {
  formatDate,
  getCredentialTitle,
  getHolderName
} from '@/utils/credentialUtils';
import { useAppStore } from '@/store/useAppStore';

function ActionModal({ credential, onClose }) {
  if (!credential) return null;

  const credentialId = String(credential.id || credential._id || '');

  function openDetails() {
    onClose();
    router.push(`/vc/${encodeURIComponent(credentialId)}`);
  }

  function shareCredential() {
    onClose();
    router.push({
      pathname: '/vc/share',
      params: { id: credentialId }
    });
  }

  return (
    <Modal
      transparent
      visible={Boolean(credential)}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.iconBadge}>
                <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.modalTitleBlock}>
                <Text style={styles.modalTitle}>{getCredentialTitle(credential)}</Text>
                <Text style={styles.modalSubtitle}>{getHolderName(credential)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                onPress={onClose}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.summaryBox}>
              <View>
                <Text style={styles.detailLabel}>Credential ID</Text>
                <Text selectable style={styles.detailValue} numberOfLines={3}>
                  {credentialId || 'Not available'}
                </Text>
              </View>
              <View>
                <Text style={styles.detailLabel}>Issued</Text>
                <Text style={styles.detailValue}>
                  {formatDate(credential?.meta?.issuedAt)}
                </Text>
              </View>
              <View>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>
                  {credential?.status || credential?.meta?.status || 'stored'}
                </Text>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Choose an action</Text>
              <Text style={styles.infoText}>
                Share Credential creates a verifier QR/link. View Credential opens the full local credential details.
              </Text>
            </View>

            <View style={styles.actionStack}>
              <Button title="Share Credential" onPress={shareCredential} />
              <Button title="View Credential" variant="outline" onPress={openDetails} />
              <Button title="Cancel" variant="outline" onPress={onClose} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function CredentialsScreen() {
  const credentials = useAppStore((state) => state.credentials);
  const loadCredentials = useAppStore((state) => state.loadCredentials);
  const [selectedCredential, setSelectedCredential] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadCredentials().catch(() => {});
    }, [loadCredentials])
  );

  function renderHeader() {
    return (
      <View style={styles.header}>
        <Text style={styles.title}>Stored Credentials</Text>
        <Text style={styles.subtitle}>Tap a credential to view or share it for verification.</Text>
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
            onPress={() => setSelectedCredential(item)}
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

      <ActionModal
        credential={selectedCredential}
        onClose={() => setSelectedCredential(null)}
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    maxHeight: '88%',
    overflow: 'hidden'
  },
  modalContent: {
    padding: spacing.lg,
    gap: spacing.lg
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalTitleBlock: {
    flex: 1
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900'
  },
  modalSubtitle: {
    color: colors.muted,
    marginTop: 4,
    lineHeight: 20
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  summaryBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  detailValue: {
    color: colors.text,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 2
  },
  infoBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    gap: spacing.xs
  },
  infoTitle: {
    color: colors.text,
    fontWeight: '900'
  },
  infoText: {
    color: colors.muted,
    lineHeight: 20
  },
  actionStack: {
    gap: spacing.sm
  }
});
