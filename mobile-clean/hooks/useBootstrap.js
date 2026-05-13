import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function useBootstrap() {
  const bootstrapped = useAppStore((state) => state.bootstrapped);
  const bootstrap = useAppStore((state) => state.bootstrap);

  useEffect(() => {
    if (!bootstrapped) {
      bootstrap().catch((error) => {
        useAppStore.getState().setError(error?.message || 'Failed to start app');
      });
    }
  }, [bootstrapped, bootstrap]);

  return bootstrapped;
}

