import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import { colors, radius, spacing } from '@/constants/theme';

export default function BiometricPromptModal({
  visible,
  loading = false,
  onEnable,
  onNotNow
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="finger-print-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Enable biometric login?</Text>
          <Text style={styles.body}>
            Use your fingerprint or face unlock to open the app faster on this device.
          </Text>
          <Button title="Enable" loading={loading} onPress={onEnable} />
          <Button title="Not now" variant="outline" disabled={loading} onPress={onNotNow} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center'
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center'
  },
  body: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20
  }
});
