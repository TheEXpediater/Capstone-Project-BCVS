import { env } from '../../config/env.js';
import { getSystemSettingModel } from '../../modules/settings/setting.model.js';

let bonjour = null;
let advertisedService = null;

async function shouldAdvertiseDiscovery() {
  if (!env.discovery.enabled) {
    return false;
  }

  try {
    const SystemSetting = getSystemSettingModel();
    const settings = await SystemSetting.findOne({ code: 'main' }, { network: 1 }).lean();
    if (settings?.network?.discoveryEnabled === false) {
      return false;
    }
  } catch (error) {
    console.warn('[discovery] Could not load persisted discovery settings:', error.message || error);
  }

  return true;
}

export async function startDiscoveryAdvertisement() {
  if (!(await shouldAdvertiseDiscovery())) {
    console.log('[discovery] mDNS advertisement disabled.');
    return;
  }

  import('bonjour-service')
    .then(({ Bonjour }) => {
      try {
        bonjour = new Bonjour();
        advertisedService = bonjour.publish({
          name: env.discovery.serviceName,
          type: env.discovery.serviceType,
          protocol: env.discovery.serviceProtocol,
          port: env.port,
          txt: {
            system: 'BCVS',
            service: 'bcvs-api',
            apiPath: '/api',
            healthPath: '/api/health',
            webPort: String(env.webPort || 5173),
          },
        });

        advertisedService.on?.('up', () => {
          console.log(
            `[discovery] Advertising ${env.discovery.serviceName} as _${env.discovery.serviceType}._${env.discovery.serviceProtocol}.local on port ${env.port}`
          );
        });
        advertisedService.on?.('error', (error) => {
          console.warn('[discovery] mDNS advertisement warning:', error.message || error);
        });
      } catch (error) {
        console.warn('[discovery] Could not start mDNS advertisement:', error.message || error);
      }
    })
    .catch((error) => {
      console.warn('[discovery] bonjour-service is unavailable:', error.message || error);
    });
}

export function stopDiscoveryAdvertisement() {
  try {
    advertisedService?.stop?.();
  } catch (error) {
    console.warn('[discovery] Could not stop advertised service:', error.message || error);
  }

  try {
    if (bonjour?.unpublishAll) {
      bonjour.unpublishAll(() => bonjour.destroy?.());
    } else {
      bonjour?.destroy?.();
    }
  } catch (error) {
    console.warn('[discovery] Could not clean up mDNS advertisement:', error.message || error);
  }

  advertisedService = null;
  bonjour = null;
}
