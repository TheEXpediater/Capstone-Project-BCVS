import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Button from '@/components/ui/Button';
import Illustration from '@/components/ui/Illustration';
import { illustrations } from '@/constants/illustrations';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useNotifications } from '@/hooks/useNotifications';
import { useAppStore } from '@/store/useAppStore';
import { colors, spacing } from '@/constants/theme';

function isMaintenanceMessage(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('maintenance') || text.includes('service unavailable');
}

export default function RootLayout() {
  const { ready, retry } = useBootstrap();
  const startupError = useAppStore((state) => state.error);
  const [splashElapsed, setSplashElapsed] = useState(false);
  useNotifications();

  useEffect(() => {
    const timer = setTimeout(() => setSplashElapsed(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!ready && startupError && splashElapsed) {
    const maintenance = isMaintenanceMessage(startupError);

    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.splash}>
          <Illustration
            source={maintenance ? illustrations.maintenance : illustrations.networkError}
            heightRatio={0.32}
            minHeight={170}
            maxHeight={250}
            accessibilityLabel={maintenance ? 'Maintenance' : 'Network error'}
          />
          <Text style={styles.splashTitle}>
            {maintenance ? "We'll Be Back Soon" : 'No Internet Connection'}
          </Text>
          <Text style={styles.splashSubtitle}>
            {maintenance
              ? 'CredPocket is currently under maintenance.'
              : 'Please check your connection and try again.'}
          </Text>
          {!maintenance ? <Button title="Retry" onPress={retry} style={styles.retryButton} /> : null}
        </View>
      </SafeAreaProvider>
    );
  }

  if (!ready || !splashElapsed) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.splash}>
          <Illustration
            source={illustrations.loading}
            heightRatio={0.36}
            minHeight={180}
            maxHeight={280}
            accessibilityLabel="CredPocket loading illustration"
          />
          <Image
            source={require('../assets/splashscreen_logo.png')}
            resizeMode="contain"
            style={styles.logo}
            accessibilityLabel="CredPocket logo"
          />
          <Text style={styles.splashTitle}>CredPocket</Text>
          <Text style={styles.splashSubtitle}>Your Digital Credential Wallet</Text>
          <ActivityIndicator color={colors.primary} style={styles.progress} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="help" />
        <Stack.Screen name="vc/[id]" />
        <Stack.Screen name="vc/share" />
        <Stack.Screen name="settings/profile" />
        <Stack.Screen name="settings/general" />
        <Stack.Screen name="settings/security" />
        <Stack.Screen name="settings/privacy" />
        <Stack.Screen name="settings/notifications" />
        <Stack.Screen name="settings/appearance" />
        <Stack.Screen name="settings/language" />
        <Stack.Screen name="settings/support" />
        <Stack.Screen name="settings/about" />
        <Stack.Screen name="verification/account" />
        <Stack.Screen name="verification/consent" />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl
  },
  splashTitle: {
    color: colors.primary,
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center'
  },
  splashSubtitle: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.sm,
    textAlign: 'center'
  },
  logo: {
    width: 58,
    height: 58,
    marginBottom: spacing.sm
  },
  progress: {
    marginTop: spacing.lg
  },
  retryButton: {
    marginTop: spacing.lg,
    minWidth: 180
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '700',
    marginTop: spacing.sm
  }
});

