import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import BiometricPromptModal from '@/components/security/BiometricPromptModal';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
import { colors, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import {
  getBiometricsEnabled,
  getBiometricsPrompted,
  loadSession,
  setBiometricsEnabled,
  setBiometricsPrompted
} from '@/utils/storage';

async function hasUsableBiometrics() {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync()
  ]);

  return Boolean(hasHardware && enrolled);
}

export default function LoginScreen() {
  const login = useAppStore((state) => state.login);
  const restoreSavedSession = useAppStore((state) => state.restoreSavedSession);
  const loading = useAppStore((state) => state.loading.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [promptVisible, setPromptVisible] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [canUseBiometricLogin, setCanUseBiometricLogin] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadBiometricOption() {
      try {
        const [enabled, available, session] = await Promise.all([
          getBiometricsEnabled(),
          hasUsableBiometrics(),
          loadSession()
        ]);

        if (!active) return;
        setCanUseBiometricLogin(Boolean(enabled && available && session?.token && session?.user));
      } catch {
        if (active) setCanUseBiometricLogin(false);
      }
    }

    loadBiometricOption();

    return () => {
      active = false;
    };
  }, []);

  async function shouldPromptForBiometrics() {
    const [available, prompted, enabled] = await Promise.all([
      hasUsableBiometrics(),
      getBiometricsPrompted(),
      getBiometricsEnabled()
    ]);

    return available && !prompted && !enabled;
  }

  function goHome() {
    setPromptVisible(false);
    router.replace('/(tabs)/home');
  }

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }

    try {
      await login({ email: email.trim().toLowerCase(), password });
      if (await shouldPromptForBiometrics()) {
        setPromptVisible(true);
        return;
      }

      goHome();
    } catch (error) {
      Alert.alert('Login failed', error.message);
    }
  }

  async function enableBiometricsFromPrompt() {
    try {
      setBiometricBusy(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login',
        cancelLabel: 'Not now',
        disableDeviceFallback: false
      });

      if (result.success) {
        await setBiometricsEnabled(true);
        await setBiometricsPrompted(true);
        goHome();
        return;
      }

      await setBiometricsPrompted(true);
      Alert.alert('Biometrics not enabled', 'No problem. You can enable it later in Settings.');
      goHome();
    } catch {
      await setBiometricsPrompted(true);
      Alert.alert('Biometrics not enabled', 'No problem. You can enable it later in Settings.');
      goHome();
    } finally {
      setBiometricBusy(false);
    }
  }

  async function dismissBiometricPrompt() {
    await setBiometricsPrompted(true);
    goHome();
  }

  async function useBiometrics() {
    try {
      setBiometricBusy(true);

      const { token, user } = await loadSession();
      if (!token || !user) {
        setCanUseBiometricLogin(false);
        Alert.alert('No saved session', 'Sign in with your password first.');
        return;
      }

      if (!(await hasUsableBiometrics())) {
        setCanUseBiometricLogin(false);
        Alert.alert('Biometrics unavailable', 'Biometrics are not available on this device.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock CredPocket',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false
      });

      if (!result.success) return;

      await restoreSavedSession();
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Biometric login failed', error.message || 'Please sign in with your password.');
    } finally {
      setBiometricBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.brand}>CredPocket</Text>
        <Text style={styles.subtitle}>Student credential vault</Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="student@example.com"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
          />
          <Button title="Login" loading={loading} onPress={submit} />

          {canUseBiometricLogin ? (
            <Pressable
              disabled={biometricBusy}
              onPress={useBiometrics}
              style={[styles.biometricButton, biometricBusy && styles.biometricButtonDisabled]}
            >
              <Ionicons name="finger-print-outline" size={20} color={colors.primary} />
              <Text style={styles.biometricText}>
                {biometricBusy ? 'Opening biometrics...' : 'Use biometrics'}
              </Text>
            </Pressable>
          ) : null}

          <Pressable onPress={() => router.push('/(auth)/reset-password')}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.link}>Create an account</Text>
          </Pressable>
        </View>
      </View>

      <BiometricPromptModal
        visible={promptVisible}
        loading={biometricBusy}
        onEnable={enableBiometricsFromPrompt}
        onNotNow={dismissBiometricPrompt}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm
  },
  brand: {
    color: colors.primary,
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center'
  },
  subtitle: {
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.xl
  },
  form: {
    gap: spacing.md
  },
  biometricButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  biometricButtonDisabled: {
    opacity: 0.6
  },
  biometricText: {
    color: colors.primary,
    fontWeight: '900'
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing.xs
  }
});

