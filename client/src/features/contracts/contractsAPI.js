import api from '../../services/api';

export async function getContractsDashboard() {
  const response = await api.get('/contracts/dashboard');
  return response.data.data;
}

export async function estimateDeployment(payload = {}) {
  const response = await api.post('/contracts/estimate', payload);
  return response.data.data;
}

export async function deployContract(payload = {}) {
  const response = await api.post('/contracts/deploy', payload);
  return response.data.data;
}

export async function registerExistingContract(payload = {}) {
  const response = await api.post('/contracts/register-existing', payload);
  return response.data.data;
}

export async function selectActiveAnchorContract(payload = {}) {
  const response = await api.post('/contracts/anchor/select', payload);
  return response.data.data;
}

export async function getContractCapabilities(address) {
  const response = await api.get(`/contracts/capabilities/${encodeURIComponent(address)}`);
  return response.data.data;
}

export async function checkAnchorReadiness(contractIdOrAddress) {
  const response = await api.get(`/contracts/${encodeURIComponent(contractIdOrAddress)}/health`);
  return response.data.data;
}
