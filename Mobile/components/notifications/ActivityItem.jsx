import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';

function formatStamp(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export default function ActivityItem({ item }) {
  return (
    <View style={styles.item}>
      <View style={styles.iconWrap}>
        <Ionicons name="notifications-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{item?.title || 'Activity'}</Text>
        {!!item?.body && <Text style={styles.body}>{item.body}</Text>}
        <Text style={styles.stamp}>{formatStamp(item?.createdAt || item?.ts)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  iconWrap: {
    width: 36,
    height: 36,
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
    fontWeight: '800'
  },
  body: {
    color: colors.text,
    marginTop: 4
  },
  stamp: {
    color: colors.muted,
    marginTop: 8,
    fontSize: 12
  }
});

