import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import ActivityItem from '@/components/notifications/ActivityItem';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Screen from '@/components/ui/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

const NOT_AVAILABLE = 'Not available';

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value) !== '');
}

function titleCase(value) {
  const text = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : NOT_AVAILABLE;
}

function formatDate(value) {
  if (!value) return NOT_AVAILABLE;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return NOT_AVAILABLE;
  return parsed.toLocaleString();
}

function formatAmount(value) {
  if (value === undefined || value === null || value === '') return NOT_AVAILABLE;
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function detailRows(item) {
  const data = item?.data || {};
  const request = data?.request || {};
  const createdAt = firstValue(
    data?.createdAt,
    data?.created_at,
    request?.createdAt,
    request?.created_at,
    item?.createdAt,
    item?.ts
  );

  return [
    {
      label: 'Credential type',
      value: titleCase(
        firstValue(data?.credentialType, request?.credentialType, request?.credential_type, request?.type)
      )
    },
    {
      label: 'Request status',
      value: titleCase(firstValue(data?.requestStatus, request?.requestStatus, request?.status))
    },
    {
      label: 'Payment status',
      value: titleCase(
        firstValue(
          data?.paymentStatus,
          request?.paymentStatus,
          request?.payment_status,
          request?.payment?.status
        )
      )
    },
    {
      label: 'Payment code',
      value: firstValue(data?.paymentCode, request?.paymentCode, request?.payment_code) || NOT_AVAILABLE
    },
    {
      label: 'Receipt number',
      value:
        firstValue(
          data?.receiptNo,
          data?.receiptNumber,
          request?.receiptNo,
          request?.receiptNumber,
          request?.receipt_no
        ) || NOT_AVAILABLE
    },
    {
      label: 'Paid at',
      value: formatDate(firstValue(data?.paidAt, request?.paidAt, request?.paid_at, request?.payment?.paidAt))
    },
    {
      label: 'Amount',
      value: formatAmount(firstValue(data?.amount, request?.amount, request?.payment?.amount))
    },
    {
      label: 'Created date',
      value: formatDate(createdAt)
    },
    {
      label: 'Processing note',
      value:
        firstValue(data?.processingNote, request?.processingNote, request?.processing_note, item?.body) ||
        NOT_AVAILABLE
    },
    {
      label: 'Credential status',
      value: titleCase(
        firstValue(
          data?.credentialStatus,
          request?.credentialStatus,
          request?.credential_status,
          request?.credential?.status
        )
      )
    }
  ];
}

function groupByYear(items) {
  const groups = new Map();

  items.forEach((item) => {
    const date = new Date(item?.createdAt || item?.ts || Date.now());
    const year = Number.isNaN(date.getTime()) ? 'Recent' : String(date.getFullYear());

    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(item);
  });

  return Array.from(groups.entries())
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([title, data]) => ({
      title,
      data: [...data].sort(
        (a, b) => new Date(b.createdAt || b.ts || 0) - new Date(a.createdAt || a.ts || 0)
      )
    }));
}

function ActivityDetailsModal({ item, visible, onClose }) {
  if (!item) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{item?.title || 'Activity details'}</Text>
              {!!item?.body && <Text style={styles.modalSubtitle}>{item.body}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.iconButton}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.detailList}>
            {detailRows(item).map((row) => (
              <View key={row.label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{row.label}</Text>
                <Text style={styles.detailValue}>{row.value || NOT_AVAILABLE}</Text>
              </View>
            ))}
          </ScrollView>

          <Button title="Close" variant="outline" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

export default function ActivityScreen() {
  const notifications = useAppStore((state) => state.notifications);
  const loading = useAppStore((state) => state.loading.notifications);
  const loadNotifications = useAppStore((state) => state.loadNotifications);
  const deleteNotifications = useAppStore((state) => state.deleteNotifications);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailItem, setDetailItem] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadNotifications().catch(() => {});
    }, [loadNotifications])
  );

  const sections = useMemo(() => groupByYear(notifications), [notifications]);
  const selectedCount = selectedIds.length;

  function toggleSelection(id) {
    const value = String(id);
    setSelectedIds((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function cancelSelection() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelectedIds([]);
  }

  function handleItemPress(item) {
    if (selectionMode) {
      toggleSelection(item.id);
      return;
    }

    setDetailItem(item);
  }

  function confirmDelete() {
    if (!selectedCount) return;

    Alert.alert(
      'Delete selected activity?',
      'This will remove the selected items from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteNotifications(selectedIds);
            cancelSelection();
          }
        }
      ]
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{selectionMode ? 'Select activity' : 'Activity'}</Text>
          {!selectionMode ? (
            <Text style={styles.subtitle}>
              Requests, payments, verification, and credential updates.
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              {selectedCount ? `${selectedCount} selected` : 'Tap activity cards to select them.'}
            </Text>
          )}
        </View>

        {selectionMode ? (
          <View style={styles.headerActions}>
            <Pressable onPress={cancelSelection} style={styles.textAction}>
              <Text style={styles.textActionLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={confirmDelete}
              disabled={!selectedCount}
              style={[styles.deleteAction, !selectedCount && styles.actionDisabled]}
            >
              <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
              <Text style={styles.deleteActionLabel}>Delete</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select activity to delete"
            onPress={enterSelectionMode}
            style={styles.iconButton}
          >
            <Ionicons name="trash-outline" size={21} color={colors.primary} />
          </Pressable>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => String(item.id || index)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            tintColor={colors.primary}
            onRefresh={() => loadNotifications().catch(() => {})}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <ActivityItem
            item={item}
            selected={selectedIds.includes(String(item.id))}
            selectionMode={selectionMode}
            isLast={index === section.data.length - 1}
            onPress={() => handleItemPress(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="No activity yet"
            body="Updates about requests, payments, verification, and credentials will appear here."
          />
        }
      />

      <ActivityDetailsModal
        item={detailItem}
        visible={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900'
  },
  subtitle: {
    color: colors.muted,
    marginTop: 2,
    lineHeight: 19
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textAction: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center'
  },
  textActionLabel: {
    color: colors.primary,
    fontWeight: '900'
  },
  deleteAction: {
    minHeight: 38,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  deleteActionLabel: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  actionDisabled: {
    opacity: 0.5
  },
  content: {
    flexGrow: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl
  },
  sectionHeader: {
    alignSelf: 'flex-start',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  sectionHeaderText: {
    color: colors.primary,
    fontWeight: '900'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '88%',
    gap: spacing.md
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900'
  },
  modalSubtitle: {
    color: colors.muted,
    marginTop: spacing.xs,
    lineHeight: 20
  },
  detailList: {
    gap: spacing.sm
  },
  detailRow: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.xs
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900'
  },
  detailValue: {
    color: colors.text,
    fontWeight: '800',
    lineHeight: 20
  }
});
