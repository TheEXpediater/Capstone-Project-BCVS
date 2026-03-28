import { ApiError } from '../../shared/utils/ApiError.js';

const CONTRACT_SERVICE_URL = process.env.CONTRACT_SERVICE_URL || 'http://localhost:5001';

function buildUrl(path) {
  return `${CONTRACT_SERVICE_URL.replace(/\/$/, '')}${path}`;
}

async function requestJson(path, options = {}) {
  let response;

  try {
    response = await fetch(buildUrl(path), {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    throw new ApiError(502, `Smart contract service is unreachable: ${error.message}`);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(response.status || 500, payload?.error || payload?.message || 'Smart contract request failed');
  }

  return payload;
}

export async function getContractsDashboard() {
  const [health, account, contracts] = await Promise.all([
    requestJson('/api/health'),
    requestJson('/api/account'),
    requestJson('/api/contracts'),
  ]);

  return {
    health,
    account,
    contracts,
  };
}

export async function estimateDeployment() {
  return requestJson('/api/estimate', { method: 'POST' });
}

export async function deployContract() {
  return requestJson('/api/deploy', { method: 'POST' });
}
