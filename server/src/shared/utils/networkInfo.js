import os from 'node:os';
import { env } from '../../config/env.js';

const API_BASE_PATH = '/api';

function cleanString(value, fallback = '') {
  const cleaned = String(value || '').trim();
  return cleaned || fallback;
}

function cleanUrl(value) {
  return cleanString(value).replace(/\/+$/, '');
}

function normalizeApiBaseUrl(value) {
  const cleaned = cleanUrl(value);
  if (!cleaned) return '';
  return /\/api$/i.test(cleaned) ? cleaned : `${cleaned}${API_BASE_PATH}`;
}

function normalizeWebBaseUrl(value) {
  return cleanUrl(value)
    .replace(/\/verification-portal\/verify\/?$/i, '')
    .replace(/\/verification-portal\/?$/i, '')
    .replace(/\/verify\/?$/i, '');
}

function isPrivateIpv4(ip) {
  const parts = String(ip || '')
    .split('.')
    .map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;

  const [a, b] = parts;
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function ipSortKey(ip) {
  return `${isPrivateIpv4(ip) ? '0' : '1'}-${ip
    .split('.')
    .map((part) => part.padStart(3, '0'))
    .join('.')}`;
}

export function getLanIpv4Addresses() {
  const addresses = [];
  const seen = new Set();

  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const item of interfaces || []) {
      const family = String(item.family || '').toLowerCase();
      if (
        !(family === 'ipv4' || item.family === 4) ||
        item.internal ||
        item.address === '127.0.0.1'
      ) {
        continue;
      }

      if (!seen.has(item.address)) {
        seen.add(item.address);
        addresses.push(item.address);
      }
    }
  }

  return addresses.sort((a, b) => ipSortKey(a).localeCompare(ipSortKey(b)));
}

export function getHostname() {
  return os.hostname();
}

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildDeploymentInfo(settingsNetwork = {}) {
  const apiPort = numberOrDefault(settingsNetwork.apiPort, env.port || 5000);
  const webPort = numberOrDefault(settingsNetwork.webPort, env.webPort || 5173);
  const hostname = getHostname();
  const ipv4 = getLanIpv4Addresses();
  const lanApiBaseUrls = ipv4.map((ip) => `http://${ip}:${apiPort}${API_BASE_PATH}`);
  const lanWebBaseUrls = ipv4.map((ip) => `http://${ip}:${webPort}`);
  const manualApiBaseUrl = normalizeApiBaseUrl(settingsNetwork.manualApiBaseUrl);
  const manualWebBaseUrl = normalizeWebBaseUrl(settingsNetwork.manualWebBaseUrl);
  const domainApiBaseUrl = normalizeApiBaseUrl(
    settingsNetwork.domainApiBaseUrl ||
      env.domainApiBaseUrl ||
      (env.publicDomain ? `https://${env.publicDomain}${API_BASE_PATH}` : '')
  );
  const domainWebBaseUrl = normalizeWebBaseUrl(
    settingsNetwork.domainWebBaseUrl ||
      env.domainWebBaseUrl ||
      (env.publicDomain ? `https://${env.publicDomain}` : '')
  );
  const preferredMode = ['lan', 'domain'].includes(
    cleanString(settingsNetwork.preferredMode || env.preferredDeploymentMode, 'lan').toLowerCase()
  )
    ? cleanString(settingsNetwork.preferredMode || env.preferredDeploymentMode, 'lan').toLowerCase()
    : 'lan';
  const discoveryEnabled =
    typeof settingsNetwork.discoveryEnabled === 'boolean'
      ? settingsNetwork.discoveryEnabled
      : env.discovery.enabled;
  const preferredServerIp = cleanString(settingsNetwork.preferredServerIp);
  const preferredLanApi =
    (preferredServerIp ? lanApiBaseUrls.find((url) => url.includes(`//${preferredServerIp}:`)) : '') ||
    manualApiBaseUrl ||
    lanApiBaseUrls[0] ||
    '';
  const preferredLanWeb =
    (preferredServerIp ? lanWebBaseUrls.find((url) => url.includes(`//${preferredServerIp}:`)) : '') ||
    manualWebBaseUrl ||
    lanWebBaseUrls[0] ||
    '';
  const preferredBaseUrl =
    preferredMode === 'domain' && domainApiBaseUrl
      ? domainApiBaseUrl
      : preferredLanApi || domainApiBaseUrl || `http://localhost:${apiPort}${API_BASE_PATH}`;
  const preferredWebBaseUrl =
    preferredMode === 'domain' && domainWebBaseUrl
      ? domainWebBaseUrl
      : preferredLanWeb || domainWebBaseUrl || `http://localhost:${webPort}`;
  const qrPayload = {
    type: 'BCVS_SERVER_CONFIG',
    system: 'BCVS',
    preferred: preferredMode,
    lanApiBaseUrl: preferredLanApi,
    lanWebBaseUrl: preferredLanWeb,
    domainApiBaseUrl,
    domainWebBaseUrl,
    healthUrl: preferredBaseUrl.replace(/\/api\/?$/i, `${API_BASE_PATH}/health`),
  };

  return {
    hostname,
    port: apiPort,
    webPort,
    ipv4,
    lanApiBaseUrls,
    lanWebBaseUrls,
    apiUrls: lanApiBaseUrls,
    webUrls: lanWebBaseUrls,
    manualApiBaseUrl,
    manualWebBaseUrl,
    domainApiBaseUrl,
    domainWebBaseUrl,
    preferredBaseUrl,
    preferredWebBaseUrl,
    preferredMode,
    discoveryEnabled,
    preferredServerIp,
    qrPairingEnabled:
      typeof settingsNetwork.qrPairingEnabled === 'boolean'
        ? settingsNetwork.qrPairingEnabled
        : true,
    qrPayload,
  };
}

export function buildHealthPayload(settingsNetwork = {}) {
  const deployment = buildDeploymentInfo(settingsNetwork);

  return {
    success: true,
    system: 'BCVS',
    service: 'bcvs-api',
    version: '1.0.0',
    apiBasePath: API_BASE_PATH,
    timestamp: new Date().toISOString(),
    network: {
      hostname: deployment.hostname,
      port: deployment.port,
      ipv4: deployment.ipv4,
      apiUrls: deployment.apiUrls,
      webUrls: deployment.webUrls,
    },
    environment: {
      lanApiBaseUrls: deployment.lanApiBaseUrls,
      lanWebBaseUrls: deployment.lanWebBaseUrls,
      domainApiBaseUrl: deployment.domainApiBaseUrl,
      domainWebBaseUrl: deployment.domainWebBaseUrl,
      preferredBaseUrl: deployment.preferredBaseUrl,
      preferredWebBaseUrl: deployment.preferredWebBaseUrl,
      preferredMode: deployment.preferredMode,
    },
  };
}

export function buildNetworkQrPayload(settingsNetwork = {}) {
  const deployment = buildDeploymentInfo(settingsNetwork);

  return {
    ...deployment.qrPayload,
    generatedAt: new Date().toISOString(),
  };
}

export function buildNetworkInfoPayload(settingsNetwork = {}) {
  const deployment = buildDeploymentInfo(settingsNetwork);

  return {
    success: true,
    system: 'BCVS',
    service: 'bcvs-api',
    version: '1.0.0',
    apiBasePath: API_BASE_PATH,
    timestamp: new Date().toISOString(),
    network: {
      hostname: deployment.hostname,
      port: deployment.port,
      webPort: deployment.webPort,
      ipv4: deployment.ipv4,
      suggestedLanApiUrls: deployment.lanApiBaseUrls,
      suggestedLanWebUrls: deployment.lanWebBaseUrls,
      preferredServerIp: deployment.preferredServerIp,
    },
    environment: {
      lanApiBaseUrls: deployment.lanApiBaseUrls,
      lanWebBaseUrls: deployment.lanWebBaseUrls,
      manualApiBaseUrl: deployment.manualApiBaseUrl,
      manualWebBaseUrl: deployment.manualWebBaseUrl,
      domainApiBaseUrl: deployment.domainApiBaseUrl,
      domainWebBaseUrl: deployment.domainWebBaseUrl,
      preferredBaseUrl: deployment.preferredBaseUrl,
      preferredApiBaseUrl: deployment.preferredBaseUrl,
      preferredWebBaseUrl: deployment.preferredWebBaseUrl,
      preferredMode: deployment.preferredMode,
    },
    discovery: {
      enabled: deployment.discoveryEnabled,
      status: deployment.discoveryEnabled ? 'enabled' : 'disabled',
      serviceName: env.discovery.serviceName,
      serviceType: env.discovery.serviceType,
      serviceProtocol: env.discovery.serviceProtocol,
      serviceFqdn: `_${env.discovery.serviceType}._${env.discovery.serviceProtocol}.local`,
    },
    qr: {
      enabled: deployment.qrPairingEnabled,
      payload: deployment.qrPayload,
      payloads: [
        deployment.qrPayload,
        ...(deployment.domainApiBaseUrl
          ? [
              {
                ...deployment.qrPayload,
                preferred: 'domain',
                healthUrl: deployment.domainApiBaseUrl.replace(
                  /\/api\/?$/i,
                  `${API_BASE_PATH}/health`
                ),
              },
            ]
          : []),
      ],
    },
  };
}
