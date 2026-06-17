import { useEffect } from 'react';
import { refreshApiBaseUrl, setApiBaseUrl } from '@/services/apiClient';
import { resolveStartupServerConfig } from '@/services/serverConfigService';
import { useAppStore } from '@/store/useAppStore';

export function useBootstrap() {
  const bootstrapped = useAppStore((state) => state.bootstrapped);
  const bootstrap = useAppStore((state) => state.bootstrap);

  useEffect(() => {
    if (!bootstrapped) {
      resolveStartupServerConfig()
        .then((result) => {
          if (result?.config?.apiBaseUrl) {
            setApiBaseUrl(result.config.apiBaseUrl);
          }
          return refreshApiBaseUrl();
        })
        .then(() => bootstrap())
        .catch((error) => {
          useAppStore.getState().setError(error?.message || 'Failed to start app');
        });
    }
  }, [bootstrapped, bootstrap]);

  return bootstrapped;
}

