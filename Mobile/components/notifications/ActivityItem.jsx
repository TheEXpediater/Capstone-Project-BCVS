import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';

function formatStamp(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function titleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function iconForType(type) {
  const normalized = String(type || '').toLowerCase();

  if (normalized.includes('payment')) return 'receipt-outline';
  if (normalized.includes('credential_request')) return 'document-text-outline';
  if (normalized.includes('anchor')) return 'link-outline';
  if (normalized.includes('credential_ready')) return 'qr-code-outline';
  if (normalized.includes('credential_claimed') || normalized.includes('credential_saved')) {
    return 'card-outline';
  }
  if (normalized.includes('verification')) return 'shield-checkmark-outline';
  if (normalized.includes('credential')) return 'ribbon-outline';

  return 'notifications-outline';
}

function statusForItem(item) {
  const data = item?.data || {};
  const request = data?.request || {};
  return (
    data?.paymentStatus ||
    data?.requestStatus ||
    request?.paymentStatus ||
    request?.status ||
    item?.status ||
    ''
  );
}

function statusStyle(status) {
  const normalized = String(status || '').toLowerCase();

  if (
    ['paid', 'verified', 'signed', 'claimed', 'approved', 'issued', 'shared', 'anchored'].includes(
      normalized
    )
  ) {
    return styles.badgeGood;
  }

  if (['claim_ready', 'queued_for_anchor'].includes(normalized)) {
    return styles.badgeWarning;
  }

  if (['rejected', 'failed', 'denied', 'cancelled', 'canceled'].includes(normalized)) {
    return styles.badgeDanger;
  }

  if (['pending', 'processing', 'unpaid', 'draft'].includes(normalized)) {
    return styles.badgeWarning;
  }

  return styles.badgeNeutral;
}

export default function ActivityItem({
  item,
  selected = false,
  selectionMode = false,
  isLast = false,
  onPress
}) {
  const status = statusForItem(item);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        pressed && styles.pressed,
        selected && styles.selectedItem
      ]}
    >
      <View style={styles.timeline}>
        <View style={[styles.rail, isLast && styles.railLast]} />
        <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
          <Ionicons
            name={selectionMode && selected ? 'checkmark' : iconForType(item?.type)}
            size={17}
            color={selected ? '#FFFFFF' : colors.primary}
          />
        </View>
      </View>

      <View style={[styles.card, selected && styles.cardSelected]}>
        <View style={styles.cardHeader}>
          <Text style={styles.title} numberOfLines={2}>
            {item?.title || 'Activity'}
          </Text>
          {status ? (
            <View style={[styles.badge, statusStyle(status)]}>
              <Text style={styles.badgeText}>{titleCase(status)}</Text>
            </View>
          ) : null}
        </View>

        {!!item?.body && (
          <Text style={styles.body} numberOfLines={3}>
            {item.body}
          </Text>
        )}

        <View style={styles.footer}>
          <Text style={styles.stamp}>{formatStamp(item?.createdAt || item?.ts)}</Text>
          {selectionMode ? (
            <View style={[styles.checkCircle, selected && styles.checkCircleOn]}>
              {selected ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg
  },
  pressed: {
    opacity: 0.86
  },
  selectedItem: {
    opacity: 1
  },
  timeline: {
    width: 34,
    alignItems: 'center'
  },
  rail: {
    position: 'absolute',
    top: 0,
    bottom: -spacing.md,
    width: 2,
    backgroundColor: colors.line
  },
  railLast: {
    bottom: 28
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconWrapSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0FDF4'
  },
  cardHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start'
  },
  title: {
    flex: 1,
    color: colors.text,
    fontWeight: '900',
    fontSize: 15
  },
  body: {
    color: colors.muted,
    lineHeight: 20
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  stamp: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  badgeGood: {
    backgroundColor: colors.primarySoft
  },
  badgeWarning: {
    backgroundColor: '#FEF3C7'
  },
  badgeDanger: {
    backgroundColor: '#FEE2E2'
  },
  badgeNeutral: {
    backgroundColor: colors.surfaceMuted
  },
  badgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900'
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  checkCircleOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  }
});
