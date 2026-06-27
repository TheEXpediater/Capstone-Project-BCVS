import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { spacing } from '@/constants/theme';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function Illustration({
  source,
  heightRatio = 0.32,
  minHeight = 132,
  maxHeight = 240,
  width = '100%',
  style,
  imageStyle,
  accessibilityLabel
}) {
  const { height } = useWindowDimensions();
  const resolvedHeight = clamp(Math.round(height * heightRatio), minHeight, maxHeight);

  return (
    <View style={[styles.wrap, { height: resolvedHeight, width }, style]}>
      <Image
        source={source}
        accessibilityIgnoresInvertColors
        accessibilityLabel={accessibilityLabel}
        fadeDuration={180}
        resizeMode="contain"
        style={[styles.image, imageStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  image: {
    width: '100%',
    height: '100%'
  }
});
