import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Illustration from '@/components/ui/Illustration';
import { illustrations } from '@/constants/illustrations';
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
        <Illustration
          source={illustrations.scanQr}
          heightRatio={0.22}
          minHeight={120}
          maxHeight={180}
          accessibilityLabel="QR scanner"
        />
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Preparing camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <EmptyState
          illustration={illustrations.cameraPermission}
          title="Camera permission needed"
          body="Allow camera access to scan QR codes."
        />
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
      <View pointerEvents="none" style={styles.scanHeader}>
        <Illustration
          source={illustrations.scanQr}
          heightRatio={0.13}
          minHeight={82}
          maxHeight={118}
          accessibilityLabel="Scan QR"
          style={styles.scanIllustration}
        />
        <Text style={styles.scanTitle}>Scan QR Code</Text>
      </View>
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
  muted: {
    color: colors.muted,
    textAlign: 'center'
  },
  scanHeader: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center'
  },
  scanIllustration: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.md,
    marginBottom: spacing.xs
  },
  scanTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
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

