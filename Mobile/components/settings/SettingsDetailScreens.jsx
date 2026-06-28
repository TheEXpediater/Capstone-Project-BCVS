import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import QRScanner from '@/components/qr/QRScanner';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Illustration from '@/components/ui/Illustration';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
import { illustrations } from '@/constants/illustrations';
import { colors, radius, spacing } from '@/constants/theme';
import { getApiBaseUrl, setApiBaseUrl } from '@/services/apiClient';
import {
  clearServerConfig,
  discoverServers,
  getSavedServerConfig,
  saveConfigFromQr,
  saveServerConfig,
  validateHealth
} from '@/services/serverConfigService';
import { useAppStore } from '@/store/useAppStore';
import {
  getBiometricsEnabled,
  loadSession,
  setBiometricsEnabled,
  setBiometricsPrompted
} from '@/utils/storage';

const showConnectionTools = process.env.EXPO_PUBLIC_SHOW_CONNECTION_TOOLS === 'true';
const showDiscoveryTools = process.env.EXPO_PUBLIC_SHOW_DISCOVERY_TOOLS === 'true';

function displayName(user) {
  return user?.fullName || user?.name || user?.username || 'Student';
}

function initialsFor(user) {
  const source = displayName(user) || user?.email || 'S';
  const words = String(source).trim().split(/\s+/).filter(Boolean);
  const initials = words.length > 1 ? `${words[0][0]}${words[1][0]}` : source.slice(0, 2);
  return initials.toUpperCase();
}

function accountStatus(user) {
  if (user?.verified === true) return 'verified';

  const raw = String(user?.verificationStatus || user?.verified || user?.status || 'unverified')
    .trim()
    .toLowerCase();

  if (raw === 'true') return 'verified';
  if (['verified', 'pending', 'rejected'].includes(raw)) return raw;
  return 'unverified';
}

function statusLabel(status) {
  return {
    verified: 'Verified',
    pending: 'Pending',
    rejected: 'Rejected',
    unverified: 'Unverified'
  }[status] || 'Unverified';
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value) !== '');
}

function getStudentFields(user) {
  const record =
    user?.studentRecord ||
    user?.student ||
    user?.linkedStudent ||
    user?.studentInfo ||
    user?.studentProfile ||
    null;

  return [
    {
      label: 'Student Number',
      value: firstValue(record?.studentNumber, record?.studentNo, record?.studentId, user?.studentId)
    },
    {
      label: 'Full Name',
      value: firstValue(record?.fullName, record?.name, user?.fullName, user?.name)
    },
    {
      label: 'Program / Course',
      value: firstValue(record?.program, record?.course, record?.degreeProgram, user?.program, user?.course)
    },
    {
      label: 'Year Level',
      value: firstValue(record?.yearLevel, record?.year, user?.yearLevel)
    },
    {
      label: 'Section',
      value: firstValue(record?.section, user?.section)
    },
    {
      label: 'Curriculum Year',
      value: firstValue(record?.curriculumYear, record?.curriculum_year)
    },
    {
      label: 'Graduation status',
      value: firstValue(record?.graduationStatus, record?.graduation_status)
    }
  ];
}

function Header({ title, subtitle }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function DetailShell({ title, subtitle, children }) {
  return (
    <Screen padded={false}>
      <Header title={title} subtitle={subtitle} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </Screen>
  );
}

function StatusBadge({ status }) {
  return (
    <View style={[styles.badge, styles[`badge_${status}`] || styles.badge_unverified]}>
      <Text style={styles.badgeText}>{statusLabel(status)}</Text>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'Not available'}</Text>
    </View>
  );
}

function EmptyBlock({ icon, title, body }) {
  return (
    <View style={styles.emptyBlock}>
      <Ionicons name={icon} size={22} color={colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.emptyTitle}>{title}</Text>
        {!!body && <Text style={styles.emptyText}>{body}</Text>}
      </View>
    </View>
  );
}

function SectionCard({ children }) {
  return <View style={styles.sectionCard}>{children}</View>;
}

function SectionTitle({ icon, title, body }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!body && <Text style={styles.sectionBody}>{body}</Text>}
      </View>
    </View>
  );
}

function BiometricChoice({ enabled, disabled, loading, onChange }) {
  const choices = [
    { label: 'Enable biometrics', value: true },
    { label: 'Disable biometrics', value: false }
  ];

  return (
    <View style={styles.choiceGroup}>
      {choices.map((choice) => {
        const selected = enabled === choice.value;

        return (
          <Pressable
            key={choice.label}
            disabled={disabled || loading}
            onPress={() => onChange(choice.value)}
            style={[
              styles.choice,
              selected && styles.choiceSelected,
              (disabled || loading) && styles.choiceDisabled
            ]}
          >
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={selected ? colors.primary : colors.muted}
            />
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
              {choice.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProfileSettingsScreen() {
  const user = useAppStore((state) => state.user);
  const status = accountStatus(user);
  const verified = status === 'verified';
  const studentFields = useMemo(() => getStudentFields(user), [user]);
  const hasStudentData = studentFields.some((field) => Boolean(field.value));

  return (
    <DetailShell title="Account Information" subtitle="Account and registrar verification details.">
      <SectionCard>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsFor(user)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{displayName(user)}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'Not available'}</Text>
            <View style={styles.badgeWrap}>
              <StatusBadge status={status} />
            </View>
          </View>
        </View>
        <InfoRow label="Name" value={displayName(user)} />
        <InfoRow label="Email" value={user?.email} />
        <InfoRow label="Account Status" value={statusLabel(status)} />
        <InfoRow label="Student ID" value={user?.studentId} />
        {status === 'verified' ? (
          <Button title="Verified account" variant="outline" disabled />
        ) : status === 'pending' ? (
          <Button title="Verification pending" variant="outline" disabled />
        ) : (
          <Button title="Start verification" onPress={() => router.push('/verification/account')} />
        )}
        <View style={styles.divider} />
        <SectionTitle
          icon="school-outline"
          title="Student Info"
          body="Linked registrar data appears here when available."
        />
        {!verified ? (
          <EmptyBlock
            icon="lock-closed-outline"
            title="Student information will appear after your account is verified by the registrar."
          />
        ) : hasStudentData ? (
          studentFields.map((field) => (
            <InfoRow key={field.label} label={field.label} value={field.value} />
          ))
        ) : (
          <EmptyBlock icon="folder-open-outline" title="Student record is not available yet." />
        )}
      </SectionCard>
    </DetailShell>
  );
}

export function GeneralSettingsScreen() {
  const [serverConfig, setServerConfig] = useState(null);
  const [activeServerUrl, setActiveServerUrl] = useState(getApiBaseUrl());
  const [manualServerUrl, setManualServerUrl] = useState('');
  const [serverStatus, setServerStatus] = useState({ state: 'idle', message: 'Not tested' });
  const [serverBusy, setServerBusy] = useState(false);
  const [serverScanVisible, setServerScanVisible] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadServer() {
      const [config] = await Promise.all([getSavedServerConfig()]);
      const currentUrl = getApiBaseUrl();

      if (!active) return;
      setServerConfig(config);
      setActiveServerUrl(currentUrl);
      setManualServerUrl(config?.manualApiBaseUrl || config?.apiBaseUrl || currentUrl || '');
      setServerStatus({
        state: config?.apiBaseUrl ? 'saved' : 'fallback',
        message: config?.apiBaseUrl ? 'Saved server loaded.' : 'Using development fallback.'
      });
    }

    loadServer().catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  async function refreshServerState(config) {
    const current = config?.apiBaseUrl || getApiBaseUrl();
    if (config?.apiBaseUrl) {
      setApiBaseUrl(config.apiBaseUrl);
    }
    setServerConfig(config || (await getSavedServerConfig()));
    setActiveServerUrl(current);
    setManualServerUrl(config?.manualApiBaseUrl || config?.apiBaseUrl || current || '');
  }

  async function testServer(url = activeServerUrl) {
    const target = String(url || '').trim();

    if (!target) {
      Alert.alert('Server required', 'Enter or select a BCVS server URL first.');
      return;
    }

    try {
      setServerBusy(true);
      setServerStatus({ state: 'testing', message: 'Testing server health...' });
      const result = await validateHealth(target);
      setApiBaseUrl(result.apiBaseUrl);
      setActiveServerUrl(result.apiBaseUrl);
      setServerStatus({ state: 'connected', message: `Connected to ${result.apiBaseUrl}` });
    } catch (error) {
      setServerStatus({
        state: 'error',
        message: error.message || 'Could not reach the BCVS server.'
      });
      Alert.alert('Connection failed', error.message || 'Could not reach the BCVS server.');
    } finally {
      setServerBusy(false);
    }
  }

  async function saveManualServer() {
    try {
      setServerBusy(true);
      setServerStatus({ state: 'testing', message: 'Validating manual server...' });
      const health = await validateHealth(manualServerUrl);
      const config = await saveServerConfig(
        {
          manualApiBaseUrl: health.apiBaseUrl,
          apiBaseUrl: health.apiBaseUrl,
          mode: 'manual',
          preferred: 'manual'
        },
        'manual'
      );
      await refreshServerState(config);
      setServerStatus({ state: 'connected', message: `Saved ${health.apiBaseUrl}` });
      Alert.alert('Server saved', 'Mobile requests will now use this BCVS server.');
    } catch (error) {
      setServerStatus({ state: 'error', message: error.message || 'Manual server setup failed.' });
      Alert.alert('Server not saved', error.message || 'Manual server setup failed.');
    } finally {
      setServerBusy(false);
    }
  }

  async function scanServerQr(raw) {
    try {
      setServerBusy(true);
      const config = await saveConfigFromQr(raw);
      await refreshServerState(config);
      setServerScanVisible(false);
      setServerStatus({ state: 'connected', message: `Configured from QR: ${config.apiBaseUrl}` });
      Alert.alert('Server configured', 'BCVS mobile server pairing is complete.');
    } catch (error) {
      Alert.alert('QR setup failed', error.message || 'This QR code is not a valid BCVS server setup code.');
    } finally {
      setServerBusy(false);
    }
  }

  async function chooseDiscoveredServer(server) {
    try {
      setServerBusy(true);
      const health = await validateHealth(server.apiBaseUrl);
      const config = await saveServerConfig(
        {
          ...server,
          apiBaseUrl: health.apiBaseUrl,
          lanApiBaseUrl: health.apiBaseUrl,
          mode: 'lan',
          preferred: 'lan'
        },
        'manual'
      );
      await refreshServerState(config);
      setDiscoveredServers([]);
      setServerStatus({ state: 'connected', message: `Discovered ${health.apiBaseUrl}` });
      Alert.alert('Server selected', 'The discovered BCVS server is now active.');
    } catch (error) {
      Alert.alert('Discovery result failed', error.message || 'This discovered server did not pass health validation.');
    } finally {
      setServerBusy(false);
    }
  }

  async function autoDiscoverServer() {
    try {
      setServerBusy(true);
      setDiscoveredServers([]);
      setServerStatus({ state: 'testing', message: 'Searching for BCVS servers on the LAN...' });
      const servers = await discoverServers();
      const uniqueServers = servers.filter((server) => server?.apiBaseUrl);

      if (!uniqueServers.length) {
        setServerStatus({
          state: 'error',
          message: 'No BCVS server was discovered. Use QR pairing or manual setup.'
        });
        Alert.alert('No server found', 'Use QR pairing or manual server setup if multicast is blocked.');
        return;
      }

      if (uniqueServers.length === 1) {
        await chooseDiscoveredServer(uniqueServers[0]);
        return;
      }

      setDiscoveredServers(uniqueServers);
      setServerStatus({
        state: 'found',
        message: `${uniqueServers.length} BCVS servers found. Select one below.`
      });
    } catch (error) {
      setServerStatus({ state: 'error', message: error.message || 'Auto-discovery failed.' });
      Alert.alert('Auto-discovery failed', error.message || 'Use QR pairing or manual setup.');
    } finally {
      setServerBusy(false);
    }
  }

  async function clearSavedServer() {
    try {
      await clearServerConfig();
      const fallbackUrl = setApiBaseUrl('');
      setServerConfig(null);
      setDiscoveredServers([]);
      setActiveServerUrl(fallbackUrl);
      setManualServerUrl('');
      setServerStatus({ state: 'fallback', message: 'Saved server configuration was cleared.' });
      Alert.alert('Server cleared', 'The app will use the development fallback until a server is configured.');
    } catch (error) {
      Alert.alert('Clear failed', error.message || 'Could not clear saved server configuration.');
    }
  }

  if (serverScanVisible) {
    return <QRScanner onScan={scanServerQr} onCancel={() => setServerScanVisible(false)} />;
  }

  const statusColor =
    serverStatus.state === 'connected'
      ? colors.primary
      : serverStatus.state === 'error'
        ? colors.danger
        : colors.muted;

  return (
    <DetailShell title="General" subtitle="App connection and device setup.">
      <SectionCard>
        <SectionTitle
          icon="server-outline"
          title="Server Connection"
          body="CredPocket connects through the PSAU credentials domain automatically."
        />
        <View style={styles.statusPanel}>
          <Ionicons name="pulse-outline" size={18} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>{serverStatus.message}</Text>
        </View>
        <Button
          title={serverBusy ? 'Testing...' : 'Test Connection'}
          onPress={() => testServer(activeServerUrl)}
          loading={serverBusy && serverStatus.state === 'testing'}
          variant="outline"
        />

        {showConnectionTools && (
          <View style={styles.advancedPanel}>
            <Text style={styles.advancedTitle}>Developer connection tools</Text>
            <InfoRow label="Debug API URL" value={activeServerUrl} />
            <InfoRow label="Debug source" value={serverConfig?.source || serverConfig?.preferred || 'development'} />
            <Button title="Scan Server QR" onPress={() => setServerScanVisible(true)} variant="outline" />
            <TextField
              label="Manual server URL"
              value={manualServerUrl}
              onChangeText={setManualServerUrl}
              placeholder="192.168.1.50:5000 or https://api.psau-credentials.cfd/api"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.buttonRow}>
              <Button title="Save Manual Server" onPress={saveManualServer} loading={serverBusy} style={styles.flex} />
              <Button
                title="Clear Saved Server"
                onPress={clearSavedServer}
                variant="danger"
                disabled={serverBusy}
                style={styles.flex}
              />
            </View>
          </View>
        )}

        {showDiscoveryTools && (
          <View style={styles.advancedPanel}>
            <Text style={styles.advancedTitle}>Developer discovery tools</Text>
            <Button
              title="Auto-discover"
              onPress={autoDiscoverServer}
              loading={serverBusy && serverStatus.state === 'testing'}
              variant="outline"
            />
            {discoveredServers.map((server) => (
              <Pressable
                key={server.apiBaseUrl}
                style={styles.discoveredItem}
                disabled={serverBusy}
                onPress={() => chooseDiscoveredServer(server)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.discoveredTitle}>{server.name || 'BCVS Registrar Server'}</Text>
                  <Text style={styles.discoveredText}>{server.apiBaseUrl}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
            <Text style={styles.sectionBody}>
              Zeroconf discovery is for MIS testing only. It may fail when campus Wi-Fi blocks multicast.
            </Text>
          </View>
        )}
      </SectionCard>
    </DetailShell>
  );
}

export function SecuritySettingsScreen() {
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabledState, setBiometricsEnabledState] = useState(false);
  const [biometricsLoading, setBiometricsLoading] = useState(true);
  const [biometricsBusy, setBiometricsBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadBiometrics() {
      try {
        const [enabled, hasHardware, enrolled] = await Promise.all([
          getBiometricsEnabled(),
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync()
        ]);

        if (!active) return;
        setBiometricsEnabledState(Boolean(enabled));
        setBiometricsAvailable(Boolean(hasHardware && enrolled));
      } catch {
        if (active) setBiometricsAvailable(false);
      } finally {
        if (active) setBiometricsLoading(false);
      }
    }

    loadBiometrics();

    return () => {
      active = false;
    };
  }, []);

  async function updateBiometrics(value) {
    if (value === biometricsEnabledState) return;

    if (!value) {
      await setBiometricsEnabled(false);
      await setBiometricsPrompted(true);
      setBiometricsEnabledState(false);
      return;
    }

    try {
      setBiometricsBusy(true);

      const { token, user: savedUser } = await loadSession();
      if (!token || !savedUser) {
        Alert.alert(
          'No saved session',
          'Sign in with your password first before enabling biometrics on this device.'
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false
      });

      if (!result.success) {
        Alert.alert('Biometrics not enabled', 'You can continue using your password and try again later.');
        return;
      }

      await setBiometricsEnabled(true);
      await setBiometricsPrompted(true);
      setBiometricsEnabledState(true);
    } catch (error) {
      Alert.alert('Biometrics unavailable', error.message || 'Could not update biometric login.');
    } finally {
      setBiometricsBusy(false);
    }
  }

  return (
    <DetailShell title="Security" subtitle="Biometric login and account protection.">
      <SectionCard>
        <Illustration
          source={illustrations.security}
          heightRatio={0.22}
          minHeight={120}
          maxHeight={180}
          accessibilityLabel="Security settings"
        />
        <SectionTitle
          icon="finger-print-outline"
          title="Biometrics"
          body="Biometrics unlock the existing saved session on this device only."
        />
        <Illustration
          source={illustrations.biometric}
          heightRatio={0.16}
          minHeight={92}
          maxHeight={130}
          accessibilityLabel="Biometric login"
        />
        {biometricsLoading ? (
          <Text style={styles.sectionBody}>Checking biometrics...</Text>
        ) : !biometricsAvailable ? (
          <EmptyBlock icon="alert-circle-outline" title="Biometrics are not available on this device." />
        ) : (
          <>
            <BiometricChoice
              enabled={biometricsEnabledState}
              loading={biometricsBusy}
              onChange={updateBiometrics}
            />
            <Text style={styles.sectionBody}>
              {biometricsEnabledState
                ? 'Biometric login is enabled for this saved session.'
                : 'Biometric login is disabled.'}
            </Text>
          </>
        )}
      </SectionCard>
    </DetailShell>
  );
}

export function NotificationsSettingsScreen() {
  const notifications = useAppStore((state) => state.notifications);
  const loadNotifications = useAppStore((state) => state.loadNotifications);
  const markNotificationsSeen = useAppStore((state) => state.markNotificationsSeen);
  const loading = useAppStore((state) => state.loading.notifications);
  const [permission, setPermission] = useState({ granted: true });

  useEffect(() => {
    let active = true;

    Notifications.getPermissionsAsync()
      .then((result) => {
        if (active) setPermission(result);
      })
      .catch(() => {
        if (active) setPermission({ granted: true });
      });

    return () => {
      active = false;
    };
  }, []);

  async function openNotificationSettings() {
    const result = await Notifications.requestPermissionsAsync();
    setPermission(result);

    if (!result.granted) {
      await Linking.openSettings();
    }
  }

  async function refresh() {
    try {
      await loadNotifications();
      await markNotificationsSeen();
    } catch (error) {
      Alert.alert('Notifications unavailable', error.message || 'Could not refresh notifications.');
    }
  }

  const permissionGranted = Boolean(permission.granted);

  return (
    <DetailShell title="Notifications" subtitle="Credential, payment, and verification updates.">
      <SectionCard>
        {!permissionGranted ? (
          <>
            <EmptyState
              illustration={illustrations.notificationPermission}
              title="Enable Notifications"
              body="Enable notifications so you never miss credential updates."
            />
            <Button title="Open Settings" onPress={openNotificationSettings} />
          </>
        ) : notifications.length ? null : (
          <EmptyState
            illustration={illustrations.emptyNotifications}
            title="No Notifications Yet"
          />
        )}
        <InfoRow label="Saved notifications" value={String(notifications.length)} />
        <Button title="Open Activity" onPress={() => router.push('/(tabs)/activity')} />
        <Button title={loading ? 'Refreshing...' : 'Refresh Notifications'} variant="outline" loading={loading} onPress={refresh} />
      </SectionCard>
    </DetailShell>
  );
}

export function AboutSettingsScreen() {
  const version = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ||
    Constants.expoConfig?.android?.versionCode ||
    Constants.manifest?.ios?.buildNumber ||
    Constants.manifest?.android?.versionCode ||
    '1';

  return (
    <DetailShell title="About" subtitle="CredPocket app information and help.">
      <SectionCard>
        <Illustration
          source={illustrations.about}
          heightRatio={0.22}
          minHeight={120}
          maxHeight={180}
          accessibilityLabel="About CredPocket"
        />
        <SectionTitle
          icon="information-circle-outline"
          title="CredPocket"
          body="Your digital credential wallet for academic records."
        />
        <InfoRow label="App Version" value={String(version)} />
        <InfoRow label="Build Number" value={String(buildNumber)} />
        <InfoRow label="Privacy Policy" value="CredPocket keeps credentials on this device until you approve sharing." />
        <InfoRow label="Terms" value="Use CredPocket to store and present verified academic credentials." />
        <InfoRow label="Open Source Licenses" value="Expo, React Native, Zustand, Axios, and supporting libraries." />
        <Pressable style={styles.navRow} onPress={() => router.push('/help')}>
          <View style={styles.navIcon}>
            <Ionicons name="reader-outline" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>Help & FAQ</Text>
            <Text style={styles.navText}>App guide, request status, biometrics, and logout notes.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </SectionCard>
    </DetailShell>
  );
}

export function PrivacySettingsScreen() {
  return (
    <DetailShell title="Privacy" subtitle="Credential sharing and local data controls.">
      <SectionCard>
        <Illustration
          source={illustrations.privacy}
          heightRatio={0.22}
          minHeight={120}
          maxHeight={180}
          accessibilityLabel="Privacy settings"
        />
        <SectionTitle
          icon="lock-closed-outline"
          title="Privacy Settings"
          body="CredPocket only shares credential data after you approve a verifier request."
        />
        <InfoRow label="Credential storage" value="Verified credentials are stored locally on this device." />
        <InfoRow label="Sharing consent" value="Verifier requests require holder approval before results are shown." />
        <InfoRow label="Account data" value="Registrar verification details stay linked to your signed-in account." />
      </SectionCard>
    </DetailShell>
  );
}

export function SupportSettingsScreen() {
  const cards = [
    {
      title: 'FAQ',
      body: 'Review common credential, verification, payment, and biometrics questions.',
      icon: 'help-circle-outline',
      onPress: () => router.push('/help')
    },
    {
      title: 'Contact Support',
      body: 'Reach your registrar or MIS support channel for account assistance.',
      icon: 'mail-outline'
    },
    {
      title: 'Report Issue',
      body: 'Prepare the screen, action, and error message before reporting a problem.',
      icon: 'bug-outline'
    }
  ];

  return (
    <DetailShell title="Help & Support" subtitle="Guidance for CredPocket workflows.">
      <SectionCard>
        <Illustration
          source={illustrations.support}
          heightRatio={0.22}
          minHeight={120}
          maxHeight={180}
          accessibilityLabel="Help and support"
        />
        {cards.map((card) => (
          <Pressable
            key={card.title}
            disabled={!card.onPress}
            onPress={card.onPress}
            style={styles.navRow}
          >
            <View style={styles.navIcon}>
              <Ionicons name={card.icon} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>{card.title}</Text>
              <Text style={styles.navText}>{card.body}</Text>
            </View>
            {card.onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
          </Pressable>
        ))}
      </SectionCard>
    </DetailShell>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900'
  },
  subtitle: {
    color: colors.muted,
    marginTop: 2
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md
  },
  sectionHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center'
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: spacing.xs
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900'
  },
  sectionBody: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: 2
  },
  profileHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center'
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900'
  },
  profileName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  profileEmail: {
    color: colors.muted,
    marginTop: 2
  },
  badgeWrap: {
    flexDirection: 'row',
    marginTop: spacing.sm
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  badge_verified: {
    backgroundColor: colors.primarySoft
  },
  badge_pending: {
    backgroundColor: '#FEF3C7'
  },
  badge_rejected: {
    backgroundColor: '#FEE2E2'
  },
  badge_unverified: {
    backgroundColor: colors.surfaceMuted
  },
  badgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900'
  },
  infoRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
    gap: spacing.xs
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900'
  },
  infoValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800'
  },
  emptyBlock: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '900',
    lineHeight: 20
  },
  emptyText: {
    color: colors.muted,
    marginTop: 2,
    lineHeight: 20
  },
  choiceGroup: {
    gap: spacing.sm
  },
  choice: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0FDF4'
  },
  choiceDisabled: {
    opacity: 0.6
  },
  choiceText: {
    color: colors.text,
    fontWeight: '800'
  },
  choiceTextSelected: {
    color: colors.primary
  },
  statusPanel: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  statusText: {
    flex: 1,
    fontWeight: '800',
    lineHeight: 20
  },
  advancedPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
    gap: spacing.md
  },
  advancedTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900'
  },
  buttonRow: {
    gap: spacing.md
  },
  flex: {
    flex: 1
  },
  discoveredItem: {
    minHeight: 66,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  discoveredTitle: {
    color: colors.text,
    fontWeight: '900'
  },
  discoveredText: {
    color: colors.muted,
    marginTop: 2
  },
  navRow: {
    minHeight: 66,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  navTitle: {
    color: colors.text,
    fontWeight: '900'
  },
  navText: {
    color: colors.muted,
    marginTop: 2,
    lineHeight: 19
  }
});
