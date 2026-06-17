import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';
import { API_BASE_URL, DOMAIN_API_BASE_URL, WEB_BASE_URL } from '@/constants/config';
import { STORAGE_KEYS, readJson, writeJson } from '@/utils/storage';

const DEFAULT_API_PORT = 5000;
const HEALTH_TIMEOUT_MS = 7000;
const DISCOVERY_TIMEOUT_MS = 7000;
const SERVER_CONFIG_TYPE = 'BCVS_SERVER_CONFIG';

function cleanString(value, fallback = '') {
  const cleaned = String(value || '').trim();
  return cleaned || fallback;
}

function cleanUrl(value) {
  return cleanString(value).replace(/\/+$/, '');
}

function isIpv4(hostname) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function isLocalhost(hostname) {
  return ['localhost', '127.0.0.1', '::1'].includes(String(hostname || '').toLowerCase());
}

function looksLikeLanHost(hostname) {
  return (
    isIpv4(hostname) ||
    String(hostname || '').endsWith('.local') ||
    String(hostname || '').toLowerCase() === '10.0.2.2'
  );
}

function inferScheme(input) {
  if (/^https?:\/\//i.test(input)) return input;
  const host = input.split('/')[0].split(':')[0];
  return `${looksLikeLanHost(host) ? 'http' : 'https'}://${input}`;
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getHealthUrl(apiBaseUrl) {
  return normalizeServerUrl(apiBaseUrl, { allowLocalhost: true }).apiBaseUrl.replace(
    /\/api\/?$/i,
    '/api/health'
  );
}

export function normalizeServerUrl(rawInput, options = {}) {
  const raw = cleanUrl(rawInput);
  const allowLocalhost = options.allowLocalhost ?? __DEV__;

  if (!raw) {
    throw new Error('Enter a server IP address, hostname, or URL.');
  }

  let parsed;
  try {
    parsed = new URL(inferScheme(raw));
  } catch {
    throw new Error('Server URL is not valid.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS server URLs are supported.');
  }

  if (isLocalhost(parsed.hostname) && !allowLocalhost) {
    throw new Error('Use the server LAN IP address instead of localhost on a physical device.');
  }

  if (!parsed.port && parsed.protocol === 'http:' && looksLikeLanHost(parsed.hostname)) {
    parsed.port = String(DEFAULT_API_PORT);
  }

  let pathname = parsed.pathname.replace(/\/+$/, '');
  if (!pathname || pathname === '/') {
    pathname = '/api';
  } else if (!/\/api$/i.test(pathname)) {
    pathname = `${pathname}/api`;
  }

  parsed.pathname = pathname;
  parsed.search = '';
  parsed.hash = '';

  return {
    apiBaseUrl: cleanUrl(parsed.toString()),
    mode: looksLikeLanHost(parsed.hostname) ? 'lan' : 'domain',
    host: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80'),
  };
}

export function deriveApiBaseUrl(rawInput, options = {}) {
  return normalizeServerUrl(rawInput, options).apiBaseUrl;
}

export async function validateHealth(apiBaseUrl) {
  const normalized = normalizeServerUrl(apiBaseUrl, { allowLocalhost: true }).apiBaseUrl;
  const healthUrl = getHealthUrl(normalized);
  const response = await axios.get(healthUrl, { timeout: HEALTH_TIMEOUT_MS });
  const payload = response.data || {};

  if (payload.system !== 'BCVS' || payload.service !== 'bcvs-api') {
    throw new Error('The server responded, but it is not a BCVS API.');
  }

  return {
    apiBaseUrl: normalized,
    healthUrl,
    payload,
  };
}

export function parseServerConfigQr(rawValue) {
  const raw = cleanString(rawValue);
  const parsed = parseJson(raw);

  if (!parsed || parsed.type !== SERVER_CONFIG_TYPE || parsed.system !== 'BCVS') {
    throw new Error('This QR code is not a BCVS server configuration.');
  }

  return {
    type: SERVER_CONFIG_TYPE,
    system: 'BCVS',
    preferred: ['lan', 'domain', 'manual'].includes(parsed.preferred) ? parsed.preferred : 'lan',
    lanApiBaseUrl: cleanString(parsed.lanApiBaseUrl),
    lanWebBaseUrl: cleanString(parsed.lanWebBaseUrl),
    domainApiBaseUrl: cleanString(parsed.domainApiBaseUrl),
    domainWebBaseUrl: cleanString(parsed.domainWebBaseUrl),
    healthUrl: cleanString(parsed.healthUrl),
    raw,
  };
}

function configCandidateForMode(config) {
  const mode = config?.mode || config?.preferred || 'lan';

  if (mode === 'domain' && config?.domainApiBaseUrl) return config.domainApiBaseUrl;
  if (mode === 'manual' && config?.manualApiBaseUrl) return config.manualApiBaseUrl;
  if (config?.lanApiBaseUrl) return config.lanApiBaseUrl;
  if (config?.apiBaseUrl) return config.apiBaseUrl;
  if (config?.domainApiBaseUrl) return config.domainApiBaseUrl;
  return '';
}

export async function getSavedServerConfig() {
  return readJson(STORAGE_KEYS.SERVER_CONFIG, null);
}

export async function getActiveApiBaseUrl() {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_API_BASE_URL);
  return cleanUrl(saved || API_BASE_URL);
}

export async function saveServerConfig(input, options = {}) {
  const source = typeof input === 'string' ? { manualApiBaseUrl: input, mode: 'manual' } : input || {};
  const candidate = source.apiBaseUrl || configCandidateForMode(source);
  const normalized = normalizeServerUrl(candidate, options);
  const now = new Date().toISOString();
  const config = {
    type: SERVER_CONFIG_TYPE,
    system: 'BCVS',
    mode: source.mode || source.preferred || normalized.mode,
    preferred: source.preferred || source.mode || normalized.mode,
    apiBaseUrl: normalized.apiBaseUrl,
    manualApiBaseUrl: source.manualApiBaseUrl || (source.mode === 'manual' ? normalized.apiBaseUrl : ''),
    lanApiBaseUrl: source.lanApiBaseUrl || (normalized.mode === 'lan' ? normalized.apiBaseUrl : ''),
    lanWebBaseUrl: cleanString(source.lanWebBaseUrl),
    domainApiBaseUrl: source.domainApiBaseUrl || (normalized.mode === 'domain' ? normalized.apiBaseUrl : ''),
    domainWebBaseUrl: cleanString(source.domainWebBaseUrl),
    healthUrl: getHealthUrl(normalized.apiBaseUrl),
    updatedAt: now,
  };

  await Promise.all([
    writeJson(STORAGE_KEYS.SERVER_CONFIG, config),
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_API_BASE_URL, config.apiBaseUrl),
    AsyncStorage.setItem(STORAGE_KEYS.PREFERRED_SERVER_MODE, config.mode),
  ]);

  return config;
}

export async function clearServerConfig() {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.SERVER_CONFIG,
    STORAGE_KEYS.ACTIVE_API_BASE_URL,
    STORAGE_KEYS.LAST_DISCOVERED_SERVER,
    STORAGE_KEYS.PREFERRED_SERVER_MODE,
  ]);
}

export async function saveConfigFromQr(rawValue) {
  const parsed = parseServerConfigQr(rawValue);
  const preferredUrl =
    parsed.preferred === 'domain' && parsed.domainApiBaseUrl
      ? parsed.domainApiBaseUrl
      : parsed.lanApiBaseUrl || parsed.domainApiBaseUrl;

  const health = await validateHealth(preferredUrl);
  return saveServerConfig(
    {
      ...parsed,
      apiBaseUrl: health.apiBaseUrl,
      mode: parsed.preferred,
    },
    { allowLocalhost: true }
  );
}

function getZeroconfClass() {
  try {
    const module = require('react-native-zeroconf');
    return module.default || module;
  } catch {
    return null;
  }
}

function serviceAddress(service) {
  const addresses = [
    ...(Array.isArray(service?.addresses) ? service.addresses : []),
    service?.host,
    service?.hostname,
    service?.address,
  ].filter(Boolean);

  return addresses.find((address) => isIpv4(address) && !isLocalhost(address)) || '';
}

export async function discoverServers({ timeoutMs = DISCOVERY_TIMEOUT_MS } = {}) {
  const Zeroconf = getZeroconfClass();

  if (!Zeroconf) {
    return [];
  }

  return new Promise((resolve) => {
    const zeroconf = new Zeroconf();
    const found = new Map();
    let settled = false;

    function finish() {
      if (settled) return;
      settled = true;
      try {
        zeroconf.stop();
        zeroconf.removeDeviceListeners?.();
      } catch {}
      resolve([...found.values()]);
    }

    zeroconf.on('resolved', (service) => {
      const host = serviceAddress(service);
      const port = Number(service?.port || DEFAULT_API_PORT);

      if (!host || !port) return;

      const apiBaseUrl = `http://${host}:${port}/api`;
      found.set(apiBaseUrl, {
        name: service?.name || 'BCVS Registrar Server',
        host,
        port,
        apiBaseUrl,
        mode: 'lan',
        txt: service?.txt || {},
      });
    });

    zeroconf.on('error', finish);

    try {
      zeroconf.scan('bcvs-api', 'tcp', Platform.OS === 'ios' ? 'local.' : 'local');
    } catch {
      finish();
      return;
    }

    setTimeout(finish, timeoutMs);
  });
}

export async function discoverAndValidateServer() {
  const servers = await discoverServers();

  for (const server of servers) {
    try {
      const health = await validateHealth(server.apiBaseUrl);
      const config = await saveServerConfig(
        {
          ...server,
          apiBaseUrl: health.apiBaseUrl,
          lanApiBaseUrl: health.apiBaseUrl,
          mode: 'lan',
          preferred: 'lan',
        },
        { allowLocalhost: true }
      );
      await writeJson(STORAGE_KEYS.LAST_DISCOVERED_SERVER, server);
      return { config, servers };
    } catch {}
  }

  return { config: null, servers };
}

export async function resolveStartupServerConfig() {
  const saved = await getSavedServerConfig();

  if (saved?.apiBaseUrl) {
    try {
      await validateHealth(saved.apiBaseUrl);
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_API_BASE_URL, saved.apiBaseUrl);
      return { config: saved, status: 'saved' };
    } catch {}
  }

  if (DOMAIN_API_BASE_URL) {
    try {
      const health = await validateHealth(DOMAIN_API_BASE_URL);
      const config = await saveServerConfig({
        apiBaseUrl: health.apiBaseUrl,
        domainApiBaseUrl: health.apiBaseUrl,
        mode: 'domain',
        preferred: 'domain',
      });
      return { config, status: 'domain' };
    } catch {}
  }

  const discovered = await discoverAndValidateServer();
  if (discovered.config) {
    return { config: discovered.config, status: 'discovered', servers: discovered.servers };
  }

  await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_API_BASE_URL, API_BASE_URL);
  return {
    config: {
      apiBaseUrl: API_BASE_URL,
      domainApiBaseUrl: DOMAIN_API_BASE_URL,
      domainWebBaseUrl: '',
      lanWebBaseUrl: WEB_BASE_URL,
      mode: 'development',
      preferred: 'development',
    },
    status: 'fallback',
    servers: discovered.servers,
  };
}
