import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Screen from '@/components/ui/Screen';
import { colors, radius, spacing } from '@/constants/theme';

const GUIDE = [
  ['Home', 'View your account overview and quick actions.'],
  ['Credentials', 'View credentials stored on this device.'],
  ['Scan', 'Scan QR codes to claim credentials or approve verifier requests.'],
  ['Activity', 'View request, payment, verification, and credential updates.'],
  ['Settings', 'Manage account, security, help, and logout.'],
  ['Verification', 'Submit account details for registrar approval.'],
  ['Request status', 'Pending means submitted, paid means cashier payment was recorded, processing means registrar review is underway, signed means the credential is ready, and claimed means it is saved in your wallet.']
];

const FAQ = [
  [
    "Why can't I claim my credential?",
    'Your account must be verified, the claim QR must be valid, and the credential must match your student record.'
  ],
  [
    'Why is my payment still pending?',
    'Cashier updates may take time to sync. Check Activity for the latest payment and request status.'
  ],
  [
    'What does verified mean?',
    'Verified means the registrar approved your account and linked it to a student record.'
  ],
  [
    'Can I delete activity?',
    'Yes. Activity deleted on this device is removed locally. Remote updates may still exist on the server.'
  ],
  [
    'Does biometrics replace my password?',
    'No. Biometrics only unlock the saved session on this device and never store your password.'
  ],
  [
    'What happens when I log out?',
    'Your saved session is removed from this device, so you will need to sign in again.'
  ]
];

export default function HelpScreen() {
  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Help & FAQ</Text>
          <Text style={styles.subtitle}>Quick guide for CredPocket workflows.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>App Guide</Text>
        {GUIDE.map(([title, body]) => (
          <View key={title} style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardBody}>{body}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>FAQ</Text>
        {FAQ.map(([question, answer]) => (
          <View key={question} style={styles.card}>
            <Text style={styles.cardTitle}>{question}</Text>
            <Text style={styles.cardBody}>{answer}</Text>
          </View>
        ))}
      </ScrollView>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900'
  },
  subtitle: {
    color: colors.muted,
    marginTop: 2
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: spacing.sm
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '900',
    lineHeight: 20
  },
  cardBody: {
    color: colors.muted,
    lineHeight: 20
  }
});
