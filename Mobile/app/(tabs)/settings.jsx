import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Screen from '@/components/ui/Screen';
import { colors, shadows, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

const SECTIONS = [
  {
    title: 'Account',
    items: [
      {
        title: 'Account Information',
        icon: 'person-outline',
        route: '/settings/profile'
      }
    ]
  },
  {
    title: 'Security',
    items: [
      {
        title: 'Security',
        icon: 'shield-checkmark-outline',
        route: '/settings/security'
      }
    ]
  },
  {
    title: 'Privacy',
    items: [
      {
        title: 'Privacy',
        icon: 'lock-closed-outline',
        route: '/settings/privacy'
      }
    ]
  },
  {
    title: 'Support',
    items: [
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
    ]
  }
];

function SettingsRow({ item, last = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.rowPressed]}
      onPress={() => router.push(item.route)}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={item.icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.rowTitle}>{item.title}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

function SettingsSection({ section }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.card}>
        {section.items.map((item, index) => (
          <SettingsRow
            key={item.title}
            item={item}
            last={index === section.items.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const logout = useAppStore((state) => state.logout);

  function confirmLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
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
    <Screen padded={false} style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {SECTIONS.map((section) => (
            <SettingsSection key={section.title} section={section} />
          ))}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.logoutRow, pressed && styles.rowPressed]}
          onPress={confirmLogout}
        >
          <View style={[styles.rowIcon, styles.logoutIcon]}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </View>
          <Text style={[styles.rowTitle, styles.logoutText]}>Log Out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FFFFFF'
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: spacing.md
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.lg
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    paddingHorizontal: spacing.xs
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.card
  },
  row: {
    minHeight: 58,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  rowLast: {
    borderBottomWidth: 0
  },
  rowPressed: {
    opacity: 0.75
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
    minHeight: 58,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 16,
    ...shadows.card
  },
  logoutIcon: {
    backgroundColor: '#FEE2E2'
  },
  logoutText: {
    color: colors.danger
  }
});
