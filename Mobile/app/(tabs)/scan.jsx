import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Button from '@/components/ui/Button';
import Illustration from '@/components/ui/Illustration';
import QRScanner from '@/components/qr/QRScanner';
import { illustrations } from '@/constants/illustrations';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { refreshApiBaseUrl, setApiBaseUrl } from '@/services/apiClient';
import { saveConfigFromQr } from '@/services/serverConfigService';
import { parseQrPayload } from '@/utils/qrParser';
import { useAppStore } from '@/store/useAppStore';

const SCAN_TIPS = [
  'Hold your phone steady.',
  'Position the QR code inside the frame.',
  'Ensure the code is well lit.',
  'Scanning will begin automatically.'
];

function ScanIntroModal({ visible, onCancel, onStart }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Illustration
              source={illustrations.scanQr}
              heightRatio={0.24}
              minHeight={150}
              maxHeight={220}
              accessibilityLabel="Scan QR code"
            />

            <View style={styles.introCopy}>
              <Text style={styles.modalTitle}>Scan Credential QR Code</Text>
              <Text style={styles.modalBody}>
                Scan the QR code provided by your university or credential issuer to securely receive your digital credential.
              </Text>
            </View>

            <View style={styles.infoCard}>
              {SCAN_TIPS.map((tip) => (
                <View key={tip} style={styles.tipRow}>
                  <View style={styles.tipDot} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <Button title="Cancel" variant="outline" onPress={onCancel} style={styles.flex} />
              <Button title="Start Scanning" onPress={onStart} style={styles.flex} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ScanScreen() {
  const claimCredential = useAppStore((state) => state.claimCredential);
  const [showIntro, setShowIntro] = useState(true);

  async function handleScan(raw) {
    const parsed = parseQrPayload(raw);

    if (parsed.kind === 'server_config') {
      try {
        const config = await saveConfigFromQr(parsed.raw);
        setApiBaseUrl(config.apiBaseUrl);
        await refreshApiBaseUrl();
        Alert.alert('Server connected', `Mobile requests will use ${config.apiBaseUrl}`);
      } catch (error) {
        Alert.alert(
          'Server setup failed',
          error.message || 'This BCVS server setup QR could not be validated.'
        );
      }
      return;
    }

    if (parsed.kind === 'verification_request') {
      router.push({
        pathname: '/verification/consent',
        params: { sessionId: parsed.sessionId, nonce: parsed.nonce || '' }
      });
      return;
    }

    if (parsed.kind === 'claim_request') {
      try {
        const credential = await claimCredential(parsed);
        router.push(`/vc/${encodeURIComponent(credential.id)}`);
      } catch (error) {
        if (String(error.message || '').toLowerCase().includes('verified')) {
          Alert.alert(
            'Verification required',
            'Your account must be verified by the registrar before claiming credentials.',
            [{ text: 'Start Verification', onPress: () => router.push('/verification/account') }]
          );
          return;
        }

        Alert.alert('Claim failed', error.message);
      }
      return;
    }

    Alert.alert(
      'Unsupported QR',
      'This QR code is not a credential claim, verification request, or server setup code.'
    );
  }

  return (
    <View style={styles.screen}>
      <ScanIntroModal
        visible={showIntro}
        onCancel={() => router.back()}
        onStart={() => setShowIntro(false)}
      />
      {!showIntro ? <QRScanner onScan={handleScan} onCancel={() => router.back()} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: spacing.lg
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.card
  },
  modalContent: {
    padding: spacing.xl,
    gap: spacing.lg
  },
  introCopy: {
    gap: spacing.sm
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center'
  },
  modalBody: {
    color: colors.muted,
    lineHeight: 21,
    textAlign: 'center'
  },
  infoCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
    gap: spacing.md
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  tipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 7
  },
  tipText: {
    flex: 1,
    color: colors.text,
    fontWeight: '700',
    lineHeight: 20
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md
  },
  flex: {
    flex: 1
  }
});

