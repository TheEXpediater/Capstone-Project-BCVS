import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';
import { formatDate, getCredentialTitle, getHolderName } from '@/utils/credentialUtils';

function getCredentialStatus(credential) {
  return credential?.status || credential?.meta?.status || 'stored';
}

export default function CredentialCard({ credential, onPress }) {
  const status = getCredentialStatus(credential);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      <View style={styles.shapeA} />
      <View style={styles.shapeB} />

      <View style={styles.topRow}>
        <View>
          <Text style={styles.kicker}>BCVS Wallet</Text>
          <Text style={styles.title} numberOfLines={2}>
            {getCredentialTitle(credential)}
          </Text>
        </View>
        <Text style={styles.badge}>{status}</Text>
      </View>

      <View style={styles.placeholder}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={26} color={colors.primary} />
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.identity}>
          <Text style={styles.label}>Student</Text>
          <Text style={styles.name} numberOfLines={1}>
            {getHolderName(credential)}
          </Text>
        </View>
        <View style={styles.dateBlock}>
          <Text style={styles.label}>Issued</Text>
          <Text style={styles.meta}>{formatDate(credential?.meta?.issuedAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 210,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line
  },
  shapeA: {
    position: 'absolute',
    right: -44,
    top: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primarySoft
  },
  shapeB: {
    position: 'absolute',
    left: -34,
    bottom: -42,
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    transform: [{ rotate: '18deg' }]
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.text,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line
  },
  placeholder: {
    minHeight: 76,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  identity: {
    flex: 1
  },
  dateBlock: {
    alignItems: 'flex-end'
  },
  title: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
    marginTop: 2,
    maxWidth: 210
  },
  name: {
    color: colors.text,
    marginTop: 2,
    fontWeight: '900'
  },
  label: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase'
  },
  meta: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 2
  }
});

