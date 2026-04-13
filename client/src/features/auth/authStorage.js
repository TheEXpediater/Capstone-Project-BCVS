const STORAGE_KEY = 'auth';

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '='
  );

  const decoded = atob(padded);

  try {
    return decodeURIComponent(
      Array.from(decoded)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
  } catch {
    return decoded;
  }
}

export function readStoredAuth() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function writeStoredAuth(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export function parseJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    return JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    return null;
  }
}

export function isJwtExpired(token) {
  const payload = parseJwtPayload(token);

  if (!payload?.exp) return true;

  return Date.now() >= payload.exp * 1000;
}

export function hasValidStoredAuth() {
  const stored = readStoredAuth();

  if (!stored?.token) {
    clearStoredAuth();
    return null;
  }

  if (isJwtExpired(stored.token)) {
    clearStoredAuth();
    return null;
  }

  return stored;
}