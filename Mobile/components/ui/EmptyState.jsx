import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Illustration from '@/components/ui/Illustration';
import { colors, spacing } from '@/constants/theme';

export default function EmptyState({ icon = 'file-tray-outline', illustration, title, body }) {
  return (
    <View style={styles.wrap}>
      {illustration ? (
        <Illustration
          source={illustration}
          heightRatio={0.24}
          minHeight={130}
          maxHeight={210}
          accessibilityLabel={title}
          style={styles.illustration}
        />
      ) : (
        <Ionicons name={icon} size={42} color={colors.muted} />
      )}
      <Text style={styles.title}>{title}</Text>
      {!!body && <Text style={styles.body}>{body}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm
  },
  illustration: {
    marginBottom: spacing.sm
  },
  title: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 17,
    textAlign: 'center'
  },
  body: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20
  }
});

