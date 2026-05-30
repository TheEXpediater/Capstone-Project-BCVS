import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Button from '@/components/ui/Button';
import { colors, radius, spacing } from '@/constants/theme';

export default function QRScanner({ onScan, onCancel }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  const handleScan = useCallback(
    async ({ data }) => {
      if (locked || !data) return;
      setLocked(true);
      try {
        await onScan?.(data);
      } finally {
        setTimeout(() => setLocked(false), 900);
      }
    },
    [locked, onScan]
  );

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Preparing camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera permission needed</Text>
        <Text style={styles.muted}>Allow camera access to scan QR codes.</Text>
        <Button title="Allow Camera" onPress={requestPermission} />
        {!!onCancel && <Button title="Cancel" variant="outline" onPress={onCancel} />}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={locked ? undefined : handleScan}
      />
      <View pointerEvents="none" style={styles.frame}>
        <View style={styles.scanBox} />
      </View>
      {!!onCancel && (
        <View style={styles.footer}>
          <Button title="Cancel" variant="outline" onPress={onCancel} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#000000'
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.bg
  },
  title: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 18
  },
  muted: {
    color: colors.muted,
    textAlign: 'center'
  },
  frame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scanBox: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: radius.lg,
    backgroundColor: 'transparent'
  },
  footer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl
  }
});

