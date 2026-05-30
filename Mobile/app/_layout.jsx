import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useNotifications } from '@/hooks/useNotifications';
import { colors } from '@/constants/theme';

export default function RootLayout() {
  const ready = useBootstrap();
  useNotifications();

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
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
        <Stack.Screen name="vc/[id]" />
        <Stack.Screen name="vc/share" />
        <Stack.Screen name="verification/consent" />
      </Stack>
    </SafeAreaProvider>
  );
}

