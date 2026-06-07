import { Alert } from 'react-native';
import { router } from 'expo-router';
import QRScanner from '@/components/qr/QRScanner';
import { parseQrPayload } from '@/utils/qrParser';
import { useAppStore } from '@/store/useAppStore';

export default function ScanScreen() {
  const claimCredential = useAppStore((state) => state.claimCredential);

  async function handleScan(raw) {
    const parsed = parseQrPayload(raw);

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
      'This QR code is not a credential claim or verification request.'
    );
  }

  return <QRScanner onScan={handleScan} />;
}

