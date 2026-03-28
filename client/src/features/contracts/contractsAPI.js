import api from '../../services/api';

export async function getContractsDashboard() {
  const response = await api.get('/contracts/dashboard');
  return response.data.data;
}

export async function estimateDeployment() {
  const response = await api.post('/contracts/estimate');
  return response.data.data;
}

export async function deployContract() {
  const response = await api.post('/contracts/deploy');
  return response.data.data;
}
