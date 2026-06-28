import { useCallback, useEffect } from 'react';
import { refreshApiBaseUrl, setApiBaseUrl } from '@/services/apiClient';
import { resolveStartupServerConfig } from '@/services/serverConfigService';
import { useAppStore } from '@/store/useAppStore';

export function useBootstrap() {
  const bootstrapped = useAppStore((state) => state.bootstrapped);
  const bootstrap = useAppStore((state) => state.bootstrap);
  const setError = useAppStore((state) => state.setError);

  const runBootstrap = useCallback(() => {
    setError('');

    return resolveStartupServerConfig()
      .then((result) => {
        if (result?.config?.apiBaseUrl) {
          setApiBaseUrl(result.config.apiBaseUrl);
        }
        return refreshApiBaseUrl();
      })
      .then(() => bootstrap())
      .catch((error) => {
        setError(error?.message || 'Failed to start app');
      });
  }, [bootstrap, setError]);

  useEffect(() => {
    if (!bootstrapped) {
      runBootstrap();
    }
  }, [bootstrapped, runBootstrap]);

  return { ready: bootstrapped, retry: runBootstrap };
}

