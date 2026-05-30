import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';

const icons = {
  home: 'home-outline',
  credentials: 'card-outline',
  scan: 'qr-code-outline',
  activity: 'notifications-outline',
  settings: 'settings-outline'
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          borderTopColor: colors.line,
          backgroundColor: colors.surface
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />
        )
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="credentials" options={{ title: 'Credentials' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

