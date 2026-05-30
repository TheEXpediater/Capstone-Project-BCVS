import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  notificationToEvent,
  registerForPushNotifications
} from '@/services/notificationService';
import { useAppStore } from '@/store/useAppStore';

function routeFromNotificationData(data) {
  if (data?.type === 'credential_ready') {
    return '/(tabs)/scan';
  }

  const sessionId = data?.sessionId || data?.session_id;
  if (sessionId) {
    const nonce = data?.nonce || data?.request?.nonce || '';
    return {
      pathname: '/verification/consent',
      params: {
        sessionId: String(sessionId),
        nonce: String(nonce || '')
      }
    };
  }

  const credentialId = data?.credentialId || data?.credential_id;
  if (credentialId) {
    return `/vc/${encodeURIComponent(String(credentialId))}`;
  }

  return '/(tabs)/activity';
}

export function useNotifications() {
  const user = useAppStore((state) => state.user);
  const addActivity = useAppStore((state) => state.addActivity);
  const registerPushToken = useAppStore((state) => state.registerPushToken);

  useEffect(() => {
    if (!user) return undefined;

    let mounted = true;
    registerForPushNotifications()
      .then((token) => {
        if (mounted && token) return registerPushToken(token);
        return null;
      })
      .catch(() => {});

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!mounted || !response) return;
        const notification = response.notification;
        const data = notification?.request?.content?.data || {};
        addActivity(notificationToEvent(notification)).catch(() => {});
        router.push(routeFromNotificationData(data));
        Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
      })
      .catch(() => {});

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      addActivity(notificationToEvent(notification)).catch(() => {});
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const notification = response?.notification;
      const data = notification?.request?.content?.data || {};
      addActivity(notificationToEvent(notification)).catch(() => {});
      router.push(routeFromNotificationData(data));
    });

    return () => {
      mounted = false;
      receivedSub.remove();
      responseSub.remove();
    };
  }, [user, addActivity, registerPushToken]);
}
