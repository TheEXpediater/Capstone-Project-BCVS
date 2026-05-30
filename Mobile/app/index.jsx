import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { colors } from '@/constants/theme';

export default function Index() {
  const user = useAppStore((state) => state.user);

  useEffect(() => {
    router.replace(user ? '/(tabs)/home' : '/(auth)/login');
  }, [user]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

