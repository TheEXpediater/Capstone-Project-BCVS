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
    if (value) return value;
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

export function parseQrPayload(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return { kind: 'unknown', raw };

  const json = tryJson(raw);
  if (json) {
    const sessionId =
      json.sessionId ||
      json.session_id ||
      json.verificationSessionId ||
      json.request?.sessionId;

    if (sessionId || json.type === 'verification_request') {
      return {
        kind: 'verification_request',
        raw,
        sessionId: String(sessionId || ''),
        nonce: json.nonce || json.request?.nonce || ''
      };
    }

    if (json.jws || json.vc || json.credential) {
      return {
        kind: 'credential',
        raw,
        credential: json.credential || json.vc || json
      };
    }
  }

  const url = parseUrl(raw);
  if (url) {
    const claimToken = getQueryParam(url, ['claimToken', 'claim_token', 'token']);
    const sessionId = getQueryParam(url, ['sessionId', 'session_id']);

    const sessionMatch = url.pathname.match(/verification(?:\/session)?\/([^/?#]+)/i);
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
        kind: 'claim_url',
        raw,
        url: raw,
        token: claimToken || url.pathname.split('/').filter(Boolean).pop()
      };
    }
  }

  return { kind: 'unknown', raw };
}

