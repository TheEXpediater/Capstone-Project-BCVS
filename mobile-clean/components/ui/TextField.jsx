import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';

export default function TextField({ label, error, style, ...props }) {
  return (
    <View style={[styles.wrap, style]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor="#94A3B8"
        style={[styles.input, !!error && styles.inputError]}
        autoCapitalize="none"
        {...props}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs
  },
  label: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13
  },
  input: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15
  },
  inputError: {
    borderColor: colors.danger
  },
  error: {
    color: colors.danger,
    fontSize: 12
  }
});

