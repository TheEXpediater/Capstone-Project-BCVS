import { useFocusEffect, router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '@/components/ui/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

export default function HomeScreen() {
  const user = useAppStore((state) => state.user);
  const credentials = useAppStore((state) => state.credentials);
  const notifications = useAppStore((state) => state.notifications);
  const loadCredentials = useAppStore((state) => state.loadCredentials);
  const loadNotifications = useAppStore((state) => state.loadNotifications);
  const isVerified = String(user?.verified || 'unverified').toLowerCase() === 'verified' && !!user?.studentId;

  useFocusEffect(
    useCallback(() => {
      loadCredentials().catch(() => {});
      loadNotifications().catch(() => {});
    }, [loadCredentials, loadNotifications])
  );

  return (
    <Screen>
      <Text style={styles.eyebrow}>CredPocket</Text>
      <Text style={styles.title}>Hello, {user?.fullName || user?.username || 'Student'}</Text>
      <Text style={styles.subtitle}>Your credentials stay on this device until you approve sharing.</Text>

      {!isVerified ? (
        <Pressable style={styles.verifyCard} onPress={() => router.push('/verification/account')}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.verifyTitle}>Account verification required</Text>
            <Text style={styles.verifyText}>Submit your ID and selfie proof for registrar review.</Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.grid}>
        <Pressable style={styles.card} onPress={() => router.push('/(tabs)/credentials')}>
          <Ionicons name="card-outline" size={24} color={colors.primary} />
          <Text style={styles.cardValue}>{credentials.length}</Text>
          <Text style={styles.cardLabel}>Stored credentials</Text>
        </Pressable>
        <Pressable style={styles.card} onPress={() => router.push('/(tabs)/activity')}>
          <Ionicons name="time-outline" size={24} color={colors.info} />
          <Text style={styles.cardValue}>{notifications.length}</Text>
          <Text style={styles.cardLabel}>Activity items</Text>
        </Pressable>
      </View>

      <Pressable style={styles.scanAction} onPress={() => router.push('/(tabs)/scan')}>
        <Ionicons name="scan-outline" size={22} color="#FFFFFF" />
        <Text style={styles.scanText}>Scan QR Code</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.primary,
    fontWeight: '900',
    marginTop: spacing.lg
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.xs
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: spacing.sm
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm
  },
  cardValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900'
  },
  cardLabel: {
    color: colors.muted,
    fontWeight: '700'
  },
  scanAction: {
    marginTop: spacing.xl,
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm
  },
  scanText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  verifyCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center'
  },
  verifyTitle: {
    color: colors.text,
    fontWeight: '900'
  },
  verifyText: {
    color: colors.muted,
    marginTop: 2
  }
});

