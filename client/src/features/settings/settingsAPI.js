import axios from 'axios';
import api from '../../services/api';

function cleanUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeApiBaseUrl(value) {
  const cleaned = cleanUrl(value);
  if (!cleaned) return '';
  return /\/api$/i.test(cleaned) ? cleaned : `${cleaned}/api`;
}

function healthUrlFor(apiBaseUrl) {
  return normalizeApiBaseUrl(apiBaseUrl).replace(/\/api\/?$/i, '/api/health');
}

export async function getSettingsDashboard() {
  const response = await api.get('/settings/dashboard');
  return response.data.data;
}

export async function fetchSystemSettings() {
  return getSettingsDashboard();
}

export async function updateBusinessSettings(payload) {
  const response = await api.put('/settings/business', payload);
  return response.data.data;
}

export async function fetchNetworkInfo() {
  const response = await api.get('/network-info');
  return response.data;
}

export async function fetchNetworkQrConfig() {
  const response = await api.get('/network-qr');
  return response.data.data;
}

export async function updateNetworkSettings(payload) {
  const response = await api.put('/settings/network', payload);
  return response.data.data;
}

export async function updateEmailSettings(payload) {
  const response = await api.put('/settings/email', payload);
  return response.data.data;
}

export async function saveNetworkSettings(payload) {
  return updateNetworkSettings(payload);
}

export async function saveManualMobileApiUrl(manualApiBaseUrl) {
  return updateNetworkSettings({ network: { manualApiBaseUrl } });
}

export async function saveManualWebUrl(manualWebBaseUrl) {
  return updateNetworkSettings({ network: { manualWebBaseUrl } });
}

export async function saveDomainApiUrl(domainApiBaseUrl) {
  return updateNetworkSettings({ network: { domainApiBaseUrl } });
}

export async function saveDomainWebUrl(domainWebBaseUrl) {
  return updateNetworkSettings({ network: { domainWebBaseUrl } });
}

export async function savePreferredDeploymentMode(preferredMode) {
  return updateNetworkSettings({ network: { preferredMode } });
}

export async function saveDiscoveryEnabled(discoveryEnabled) {
  return updateNetworkSettings({ network: { discoveryEnabled } });
}

export async function testSelectedApiUrl(apiBaseUrl) {
  const target = normalizeApiBaseUrl(apiBaseUrl);
  if (!target) {
    throw new Error('Select or enter an API URL first.');
  }

  const response = await axios.get(healthUrlFor(target), {
    timeout: 7000,
    headers: { 'Cache-Control': 'no-store' },
  });
  const payload = response.data || {};

  if (payload.system !== 'BCVS' || payload.service !== 'bcvs-api') {
    throw new Error('The server responded, but it is not a BCVS API health endpoint.');
  }

  return {
    apiBaseUrl: target,
    healthUrl: healthUrlFor(target),
    payload,
  };
}

export async function updateSystemLocks(payload) {
  const response = await api.put('/settings/locks', payload);
  return response.data.data;
}

export async function updateAdminPermissions(userId, permissions) {
  const response = await api.put(`/settings/admin-permissions/${userId}`, { permissions });
  return response.data.data;
}

export async function createIssuerKey(payload) {
  const response = await api.post('/settings/issuer-keys', payload);
  return response.data.data;
}

export async function rotateIssuerKey(payload) {
  const response = await api.post('/settings/issuer-keys/rotate', payload);
  return response.data.data;
}

export async function activateIssuerKey(keyId) {
  const response = await api.put(`/settings/issuer-keys/${keyId}/activate`);
  return response.data.data;
}

export async function updateIssuerKey(keyId, payload) {
  const response = await api.put(`/settings/issuer-keys/${keyId}`, payload);
  return response.data.data;
}

export async function deleteIssuerKey(keyId) {
  const response = await api.delete(`/settings/issuer-keys/${keyId}`);
  return response.data.data;
}

export async function updateActiveContract(payload) {
  const response = await api.put('/settings/blockchain/active-contract', payload);
  return response.data.data;
}

export async function getContractCapabilities(address) {
  const response = await api.get(`/contracts/capabilities/${encodeURIComponent(address)}`);
  return response.data.data;
}
