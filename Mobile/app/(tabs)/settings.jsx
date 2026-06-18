import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import QRScanner from '@/components/qr/QRScanner';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import TextField from '@/components/ui/TextField';
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

const TABS = ['Account', 'Student Info', 'Security', 'Server', 'Help'];
const showConnectionTools =
  __DEV__ || process.env.EXPO_PUBLIC_SHOW_CONNECTION_TOOLS === 'true';
const showDiscoveryTools =
  __DEV__ || process.env.EXPO_PUBLIC_SHOW_DISCOVERY_TOOLS === 'true';

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

function PillTabs({ active, onChange }) {
  return (
    <View style={styles.tabs}>
      {TABS.map((tab) => (
        <Pressable
          key={tab}
          onPress={() => onChange(tab)}
          style={[styles.tab, active === tab && styles.tabActive]}
        >
          <Text style={[styles.tabText, active === tab && styles.tabTextActive]}>{tab}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function getStudentFields(user) {
  const record =
    user?.studentRecord ||
    user?.student ||
    user?.linkedStudent ||
    user?.studentInfo ||
    user?.studentProfile ||
    null;

  // TODO: Replace these user-field fallbacks when the backend exposes a linked student record endpoint.
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

export default function SettingsScreen() {
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const [activeTab, setActiveTab] = useState('Account');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabledState, setBiometricsEnabledState] = useState(false);
  const [biometricsLoading, setBiometricsLoading] = useState(true);
  const [biometricsBusy, setBiometricsBusy] = useState(false);
  const [serverConfig, setServerConfig] = useState(null);
  const [activeServerUrl, setActiveServerUrl] = useState(getApiBaseUrl());
  const [manualServerUrl, setManualServerUrl] = useState('');
  const [serverStatus, setServerStatus] = useState({ state: 'idle', message: 'Not tested' });
  const [serverBusy, setServerBusy] = useState(false);
  const [serverScanVisible, setServerScanVisible] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState([]);

  const status = accountStatus(user);
  const verified = status === 'verified';
  const studentFields = useMemo(() => getStudentFields(user), [user]);
  const hasStudentData = studentFields.some((field) => Boolean(field.value));

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
        message: config?.apiBaseUrl ? 'Saved server loaded.' : 'Using development fallback.',
      });
    }

    loadServer().catch(() => {});

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
        message: error.message || 'Could not reach the BCVS server.',
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
      const config = await saveServerConfig({
        manualApiBaseUrl: health.apiBaseUrl,
        apiBaseUrl: health.apiBaseUrl,
        mode: 'manual',
        preferred: 'manual',
      }, 'manual');
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
      const config = await saveServerConfig({
        ...server,
        apiBaseUrl: health.apiBaseUrl,
        lanApiBaseUrl: health.apiBaseUrl,
        mode: 'lan',
        preferred: 'lan',
      }, 'manual');
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
          message: 'No BCVS server was discovered. Use QR pairing or manual setup.',
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
        message: `${uniqueServers.length} BCVS servers found. Select one below.`,
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

  function confirmLogout() {
    Alert.alert(
      'Log out?',
      'You will need to sign in again to access this app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/(auth)/login');
            } catch (error) {
              Alert.alert('Logout failed', error.message);
            }
          }
        }
      ]
    );
  }

  function renderAccount() {
    return (
      <View style={styles.sectionCard}>
        <SectionTitle
          icon="person-circle-outline"
          title="Account"
          body="Basic profile and registrar verification status."
        />
        <InfoRow label="Name" value={displayName(user)} />
        <InfoRow label="Email" value={user?.email} />
        <InfoRow label="Account Status" value={statusLabel(status)} />
        <InfoRow label="Student ID" value={user?.studentId} />
        <View style={styles.inlineRow}>
          <Text style={styles.infoLabel}>Verification status</Text>
          <StatusBadge status={status} />
        </View>

        {status === 'verified' ? (
          <Button title="Verified account" variant="outline" disabled />
        ) : status === 'pending' ? (
          <Button title="Verification pending" variant="outline" disabled />
        ) : (
          <Button title="Start verification" onPress={() => router.push('/verification/account')} />
        )}
      </View>
    );
  }

  function renderStudentInfo() {
    return (
      <View style={styles.sectionCard}>
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
      </View>
    );
  }

  function renderSecurity() {
    return (
      <View style={styles.sectionCard}>
        <SectionTitle
          icon="finger-print-outline"
          title="Security"
          body="Biometrics unlock the existing saved session on this device only."
        />

        {biometricsLoading ? (
          <Text style={styles.sectionBody}>Checking biometrics...</Text>
        ) : !biometricsAvailable ? (
          <EmptyBlock
            icon="alert-circle-outline"
            title="Biometrics are not available on this device."
          />
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
      </View>
    );
  }

  function renderServer() {
    const statusColor =
      serverStatus.state === 'connected'
        ? colors.primary
        : serverStatus.state === 'error'
          ? colors.danger
          : colors.muted;

    return (
      <View style={styles.sectionCard}>
        <SectionTitle
          icon="server-outline"
          title="Server Connection"
          body="CredPocket connects through the PSAU credentials domain automatically."
        />

        <View style={styles.statusPanel}>
          <Ionicons name="pulse-outline" size={18} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>{serverStatus.message}</Text>
        </View>

        <View style={styles.serverActions}>
          <Button
            title={serverBusy ? 'Testing...' : 'Test Connection'}
            onPress={() => testServer(activeServerUrl)}
            loading={serverBusy && serverStatus.state === 'testing'}
            variant="outline"
            style={styles.serverActionButton}
          />
        </View>

        {showConnectionTools && (
          <View style={styles.advancedPanel}>
            <Text style={styles.advancedTitle}>Developer connection tools</Text>
            <InfoRow label="Debug API URL" value={activeServerUrl} />
            <InfoRow label="Debug source" value={serverConfig?.source || serverConfig?.preferred || 'development'} />
            <View style={styles.serverActions}>
              <Button
                title="Scan Server QR"
                onPress={() => setServerScanVisible(true)}
                variant="outline"
                style={styles.serverActionButton}
              />
            </View>
            <TextField
              label="Manual server URL"
              value={manualServerUrl}
              onChangeText={setManualServerUrl}
              placeholder="192.168.1.50:5000 or https://api.psau-credentials.cfd/api"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.serverActions}>
              <Button
                title="Save Manual Server"
                onPress={saveManualServer}
                loading={serverBusy}
                style={styles.serverActionButton}
              />
              <Button
                title="Clear Saved Server"
                onPress={clearSavedServer}
                variant="danger"
                disabled={serverBusy}
                style={styles.serverActionButton}
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

            {discoveredServers.length ? (
              <View style={styles.discoveredList}>
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
              </View>
            ) : null}

            <Text style={styles.sectionBody}>
              Zeroconf discovery is for MIS testing only. It may fail when campus Wi-Fi blocks multicast.
            </Text>
          </View>
        )}
      </View>
    );
  }

  function renderHelp() {
    return (
      <View style={styles.sectionCard}>
        <SectionTitle
          icon="help-circle-outline"
          title="Help"
          body="Open the quick app guide and FAQ."
        />
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
      </View>
    );
  }

  function renderActiveSection() {
    if (activeTab === 'Student Info') return renderStudentInfo();
    if (activeTab === 'Security') return renderSecurity();
    if (activeTab === 'Server') return renderServer();
    if (activeTab === 'Help') return renderHelp();
    return renderAccount();
  }

  if (serverScanVisible) {
    return (
      <QRScanner
        onScan={scanServerQr}
        onCancel={() => setServerScanVisible(false)}
      />
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.profileCard}>
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

        <PillTabs active={activeTab} onChange={setActiveTab} />

        {renderActiveSection()}

        <View style={styles.logoutCard}>
          <SectionTitle
            icon="log-out-outline"
            title="Logout"
            body="End access to this account on the app."
          />
          <Button title="Log Out" variant="danger" onPress={confirmLogout} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginTop: spacing.md
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
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
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  tab: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  tabActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  tabText: {
    color: colors.muted,
    fontWeight: '900'
  },
  tabTextActive: {
    color: colors.primary
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md
  },
  logoutCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.sm
  },
  sectionHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center'
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
  infoRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
    gap: spacing.xs
  },
  inlineRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
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
  }
});
