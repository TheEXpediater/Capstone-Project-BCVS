import { buildHealthPayload, buildNetworkInfoPayload } from '../../shared/utils/networkInfo.js';
import { getSystemSettingModel } from '../settings/setting.model.js';

async function loadNetworkSettings() {
  try {
    const SystemSetting = getSystemSettingModel();
    const settings = await SystemSetting.findOne({ code: 'main' }, { network: 1 }).lean();
    return settings?.network || {};
  } catch (error) {
    console.warn('[network-info] Could not load persisted network settings:', error.message);
    return {};
  }
}

export async function getHealthPayload() {
  const networkSettings = await loadNetworkSettings();
  return buildHealthPayload(networkSettings);
}

export async function getNetworkInfoPayload() {
  const networkSettings = await loadNetworkSettings();
  return buildNetworkInfoPayload(networkSettings);
}
