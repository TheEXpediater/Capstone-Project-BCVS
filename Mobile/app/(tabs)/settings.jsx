import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Screen from '@/components/ui/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

const ITEMS = [
  {
    title: 'Account Information',
    icon: 'person-circle-outline',
    route: '/settings/profile'
  },
  {
    title: 'General',
    icon: 'options-outline',
    route: '/settings/general'
  },
  {
    title: 'Security',
    icon: 'shield-checkmark-outline',
    route: '/settings/security'
  },
  {
    title: 'Privacy',
    icon: 'lock-closed-outline',
    route: '/settings/privacy'
  },
  {
    title: 'Notifications',
    icon: 'notifications-outline',
    route: '/settings/notifications'
  },
  {
    title: 'Appearance',
    icon: 'color-palette-outline',
    route: '/settings/appearance'
  },
  {
    title: 'Language',
    icon: 'language-outline',
    route: '/settings/language'
  },
  {
    title: 'Help & Support',
    icon: 'help-circle-outline',
    route: '/settings/support'
  },
  {
    title: 'About CredPocket',
    icon: 'information-circle-outline',
    route: '/settings/about'
  }
];

export default function SettingsScreen() {
  const logout = useAppStore((state) => state.logout);

  function confirmLogout() {
    Alert.alert(
      'Log out?',
      'You will need to sign in again to access this app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/(auth)/login');
            } catch (error) {
              Alert.alert('Logout failed', error.message);
            }
          }
        }
      ]
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.list}>
          {ITEMS.map((item) => (
            <Pressable
              key={item.title}
              style={styles.row}
              onPress={() => router.push(item.route)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <Pressable style={[styles.row, styles.logoutRow]} onPress={confirmLogout}>
          <View style={[styles.rowIcon, styles.logoutIcon]}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </View>
          <Text style={[styles.rowTitle, styles.logoutText]}>Logout</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginTop: spacing.md,
    marginBottom: spacing.lg
  },
  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden'
  },
  row: {
    minHeight: 62,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900'
  },
  logoutRow: {
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: radius.lg,
    marginTop: 'auto',
    marginBottom: spacing.sm
  },
  logoutIcon: {
    backgroundColor: '#FEE2E2'
  },
  logoutText: {
    color: colors.danger
  }
});
