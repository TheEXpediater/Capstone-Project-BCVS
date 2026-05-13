import { useCallback } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import ActivityItem from '@/components/notifications/ActivityItem';
import EmptyState from '@/components/ui/EmptyState';
import Screen from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

export default function ActivityScreen() {
  const notifications = useAppStore((state) => state.notifications);
  const loadNotifications = useAppStore((state) => state.loadNotifications);

  useFocusEffect(
    useCallback(() => {
      loadNotifications().catch(() => {});
    }, [loadNotifications])
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={notifications}
        keyExtractor={(item, index) => String(item.id || index)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Text style={styles.title}>Activity</Text>}
        renderItem={({ item }) => <ActivityItem item={item} />}
        ListEmptyComponent={<EmptyState title="No activity yet" body="Verification and wallet events appear here." />}
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

