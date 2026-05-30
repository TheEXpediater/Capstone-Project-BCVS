import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { checkUploadBackendHealth, uploadTestImage } from '@/services/uploadService';
import { useAppStore } from '@/store/useAppStore';

export default function SettingsScreen() {
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const [uploading, setUploading] = useState(false);

  async function signOut() {
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch (error) {
      Alert.alert('Logout failed', error.message);
    }
  }

  async function testSendImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow photo access to test image uploads.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled) return;

      console.log('[upload:test] selected image URI:', result.assets[0]?.uri);
      setUploading(true);
      await checkUploadBackendHealth();
      const response = await uploadTestImage(result.assets[0]);
      console.log('[upload:test] upload response:', response);
      Alert.alert('Upload successful', response?.image?.filename || 'Image saved.');
    } catch (error) {
      console.log('[upload:test] upload failed:', error);
      Alert.alert('Upload failed', error.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.fullName || user?.username || 'Student'}</Text>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email || 'Not available'}</Text>
        <Text style={styles.label}>Account status</Text>
        <Text style={styles.value}>{String(user?.verified || 'unverified').toUpperCase()}</Text>
      </View>
      <Button
        title="Test Send Image"
        variant="outline"
        loading={uploading}
        onPress={testSendImage}
        style={styles.testButton}
      />
      <Button title="Log Out" variant="danger" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginTop: spacing.lg,
    marginBottom: spacing.lg
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg
  },
  label: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12
  },
  value: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: spacing.md
  },
  testButton: {
    marginBottom: spacing.md
  }
});

