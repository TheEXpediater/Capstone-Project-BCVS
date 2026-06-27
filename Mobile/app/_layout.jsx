import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Illustration from '@/components/ui/Illustration';
import { illustrations } from '@/constants/illustrations';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useNotifications } from '@/hooks/useNotifications';
import { colors, spacing } from '@/constants/theme';

export default function RootLayout() {
  const ready = useBootstrap();
  const [splashElapsed, setSplashElapsed] = useState(false);
  useNotifications();

  useEffect(() => {
    const timer = setTimeout(() => setSplashElapsed(true), 3000);
    return () => clearTimeout(timer);
  }, []);

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
  loadingText: {
    color: colors.muted,
    fontWeight: '700',
    marginTop: spacing.sm
  }
});

