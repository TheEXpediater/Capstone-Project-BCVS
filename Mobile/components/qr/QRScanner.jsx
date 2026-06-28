import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
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
          title="Camera Permission Required"
          body="Allow camera access to scan credential QR codes."
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
      <View pointerEvents="none" style={styles.frame}>
        <View style={styles.scanBox} />
      </View>
      {!!onCancel && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
          onPress={onCancel}
          hitSlop={10}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
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
  closeButton: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center'
  }
});

