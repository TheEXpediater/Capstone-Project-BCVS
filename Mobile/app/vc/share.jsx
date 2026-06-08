import { useEffect, useMemo, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { buildVerifierShareUrl } from '@/services/verificationService';
import { getCredentialTitle, getHolderName } from '@/utils/credentialUtils';
import { useAppStore } from '@/store/useAppStore';

export default function ShareCredentialScreen() {
  const { id } = useLocalSearchParams();
  const credentials = useAppStore((state) => state.credentials);
  const [shareValue, setShareValue] = useState('');
  const [creating, setCreating] = useState(false);
  const credential = useMemo(
    () => credentials.find((item) => String(item.id) === String(id)),
    [credentials, id]
  );

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!credential) return;
      setCreating(true);
      try {
        const url = buildVerifierShareUrl(credential);
        if (mounted) setShareValue(url);
      } catch (error) {
        if (mounted) {
          Alert.alert('Share link unavailable', error.message);
          setShareValue('');
        }
      } finally {
        if (mounted) setCreating(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [credential]);

  async function nativeShare() {
    if (!shareValue) return;
    await Share.share({ message: shareValue });
  }

  return (
    <Screen>
      <Text style={styles.title}>Share Credential</Text>
      <View style={styles.card}>
        <Text style={styles.label}>{getCredentialTitle(credential)}</Text>
        <Text style={styles.name}>{getHolderName(credential)}</Text>
      </View>

      <View style={styles.qrWrap}>
        {shareValue ? (
          <QRCode value={shareValue} size={230} />
        ) : (
          <Text>{creating ? 'Creating share session...' : 'No share link available'}</Text>
        )}
      </View>

      <Text style={styles.help}>
        Show this QR to a verifier only when you intend to share this credential.
      </Text>

      <Button title="Open Share Sheet" onPress={nativeShare} disabled={!shareValue} loading={creating} />
      <Button title="Back" variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginTop: spacing.lg
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginVertical: spacing.lg
  },
  label: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18
  },
  name: {
    color: colors.muted,
    marginTop: spacing.xs
  },
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line
  },
  help: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginVertical: spacing.lg
  }
});
