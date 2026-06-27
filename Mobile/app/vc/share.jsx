import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import Button from '@/components/ui/Button';
import Illustration from '@/components/ui/Illustration';
import Screen from '@/components/ui/Screen';
import { illustrations } from '@/constants/illustrations';
import { colors, radius, spacing } from '@/constants/theme';
import { createShareSession } from '@/services/verificationService';
import { getCredentialRecordId, getCredentialTitle, getHolderName } from '@/utils/credentialUtils';
import { useAppStore } from '@/store/useAppStore';

export default function ShareCredentialScreen() {
  const { id } = useLocalSearchParams();
  const credentials = useAppStore((state) => state.credentials);
  const loadCredentials = useAppStore((state) => state.loadCredentials);
  const [shareValue, setShareValue] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadCredentials().catch(() => {});
  }, [loadCredentials]);

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
        const session = await createShareSession({ credential });
        if (mounted) {
          setShareValue(session.verifyUrl);
          setSessionInfo(session);
        }
      } catch (error) {
        if (mounted) {
          Alert.alert('Share link unavailable', error.message);
          setShareValue('');
          setSessionInfo(null);
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

  if (!credential && !creating) {
    return (
      <Screen>
        <Text style={styles.title}>Credential not found</Text>
        <Text style={styles.help}>This credential is not stored on this device.</Text>
        <Button title="Back to Credentials" onPress={() => router.replace('/(tabs)/credentials')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Illustration
          source={illustrations.credentialShare}
          heightRatio={0.24}
          minHeight={130}
          maxHeight={200}
          accessibilityLabel="Credential sharing"
        />
        <Text style={styles.kicker}>Verifier QR</Text>
        <Text style={styles.title}>Share Credential</Text>

      <View style={styles.card}>
        <Text style={styles.label}>{getCredentialTitle(credential)}</Text>
        <Text style={styles.name}>{getHolderName(credential)}</Text>
        <Text style={styles.metaLabel}>Credential ID</Text>
        <Text selectable style={styles.metaValue}>
          {getCredentialRecordId(credential) || credential?.id || 'Not available'}
        </Text>
      </View>

      <View style={styles.qrWrap}>
        {shareValue ? (
          <QRCode value={shareValue} size={230} />
        ) : (
          <Text style={styles.loadingText}>
            {creating ? 'Creating verification QR...' : 'No share link available'}
          </Text>
        )}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How this works</Text>
        <Text style={styles.infoText}>
          The QR opens the public verification portal with this credential already selected.
          The verifier still needs to request consent, and this phone must approve or deny before any result is shown.
        </Text>
      </View>

      {shareValue ? (
        <Text selectable style={styles.linkText}>{shareValue}</Text>
      ) : null}

      {sessionInfo?.sessionId ? (
        <Text style={styles.meta}>Verification session: {sessionInfo.sessionId}</Text>
      ) : null}

        <Button title="Open Share Sheet" onPress={nativeShare} disabled={!shareValue} loading={creating} />
        <Button title="Back" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    textTransform: 'uppercase'
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900'
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginVertical: spacing.lg,
    gap: spacing.xs
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
  metaLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    marginTop: spacing.md
  },
  metaValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700'
  },
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 286
  },
  loadingText: {
    color: colors.muted,
    textAlign: 'center'
  },
  infoCard: {
    backgroundColor: colors.primarySoft,
    borderColor: '#BBF7D0',
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
    gap: spacing.xs
  },
  infoTitle: {
    color: colors.text,
    fontWeight: '900'
  },
  infoText: {
    color: colors.muted,
    lineHeight: 20
  },
  help: {
    color: colors.muted,
    lineHeight: 20,
    marginVertical: spacing.lg
  },
  linkText: {
    color: colors.info,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md
  },
  meta: {
    color: colors.muted,
    textAlign: 'center',
    marginVertical: spacing.md,
    fontSize: 12
  }
});
