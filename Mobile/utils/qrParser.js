function tryJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getQueryParam(url, keys) {
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value !== null && value !== '') return value;
  }
  return '';
}

function parseUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function getJsonValue(json, keys) {
  for (const key of keys) {
    const value = json?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function parseVerificationJson(json, raw) {
  const sessionId =
    getJsonValue(json, ['sessionId', 'session_id', 'verificationSessionId']) ||
    getJsonValue(json?.request, ['sessionId', 'session_id']);

  if (!sessionId) {
    return null;
  }

  const nonce =
    getJsonValue(json, ['nonce']) ||
    getJsonValue(json?.request, ['nonce']);

  return {
    kind: 'verification_request',
    raw,
    sessionId: String(sessionId || ''),
    nonce: String(nonce || '')
  };
}

function parseClaimJson(json, raw) {
  const token =
    getJsonValue(json, ['claimToken', 'claim_token', 'token']) ||
    getJsonValue(json?.claim, ['token', 'claimToken']) ||
    getJsonValue(json?.request, ['claimToken', 'token']);

  if (!token) {
    return null;
  }

  return {
    kind: 'claim_request',
    raw,
    token: String(token)
  };
}

function parseServerConfigJson(json, raw) {
  if (json?.type !== 'BCVS_SERVER_CONFIG' || json?.system !== 'BCVS') {
    return null;
  }

  return {
    kind: 'server_config',
    raw,
    preferred: String(json.preferred || 'lan'),
    lanApiBaseUrl: String(json.lanApiBaseUrl || ''),
    lanWebBaseUrl: String(json.lanWebBaseUrl || ''),
    domainApiBaseUrl: String(json.domainApiBaseUrl || ''),
    domainWebBaseUrl: String(json.domainWebBaseUrl || ''),
    healthUrl: String(json.healthUrl || '')
  };
}

export function parseQrPayload(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return { kind: 'unknown', raw };

  const json = tryJson(raw);
  if (json) {
    const serverConfig = parseServerConfigJson(json, raw);
    if (serverConfig) return serverConfig;

    const verification = parseVerificationJson(json, raw);
    if (verification) return verification;

    const claim = parseClaimJson(json, raw);
    if (claim) return claim;

    const nestedUrl = getJsonValue(json, ['url', 'claimUrl', 'claim_uri', 'verifyUrl']);
    if (nestedUrl) {
      return parseQrPayload(String(nestedUrl));
    }
  }

  const url = parseUrl(raw);
  if (url) {
    const claimToken = getQueryParam(url, ['claimToken', 'claim_token', 'token']);
    const sessionId = getQueryParam(url, ['sessionId', 'session_id']);

    const verificationTarget = `${url.hostname || ''}${url.pathname || ''}`;
    const sessionMatch = verificationTarget.match(
      /(?:^|\/)(?:verification(?:\/session)?|verify)\/([^/?#]+)/i
    );
    if (sessionId || sessionMatch?.[1]) {
      return {
        kind: 'verification_request',
        raw,
        sessionId: String(sessionId || sessionMatch[1]),
        nonce: getQueryParam(url, ['nonce'])
      };
    }

    if (claimToken || /\/claim\//i.test(url.pathname) || /\/c\/[^/]+/i.test(url.pathname)) {
      return {
        kind: 'claim_request',
        raw,
        url: raw,
        token: claimToken || url.pathname.split('/').filter(Boolean).pop()
      };
    }
  }

  return { kind: 'unknown', raw };
}

