import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';
import { formatDate, getCredentialTitle, getHolderName } from '@/utils/credentialUtils';

export default function CredentialCard({ credential, onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {getCredentialTitle(credential)}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {getHolderName(credential)}
        </Text>
        <Text style={styles.meta}>Issued {formatDate(credential?.meta?.issuedAt)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16
  },
  name: {
    color: colors.text,
    marginTop: 2
  },
  meta: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 12
  }
});

