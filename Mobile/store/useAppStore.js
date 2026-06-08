import { create } from 'zustand';
import * as authService from '@/services/authService';
import * as notificationService from '@/services/notificationService';
import * as vcService from '@/services/vcService';
import * as verificationService from '@/services/verificationService';
import { clearSession, loadSession, saveSession, STORAGE_KEYS, writeJson } from '@/utils/storage';

const initialLoaders = {
  auth: false,
  credentials: false,
  requests: false,
  verification: false,
  notifications: false
};

const VERIFICATION_REQUIRED_MESSAGE = 'Your account must be verified before claiming this credential.';

function hasVerifiedStatus(user) {
  if (user?.verified === true) return true;

  return [user?.verified, user?.verificationStatus, user?.status].some(
    (value) => ['verified', 'true'].includes(String(value || '').trim().toLowerCase())
  );
}

function isVerifiedAndLinked(user) {
  return hasVerifiedStatus(user) && Boolean(String(user?.studentId || '').trim());
}

function sortNotifications(items) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt || b.ts || 0) - new Date(a.createdAt || a.ts || 0)
  );
}

async function mergeActivityItems(history = [], credentialRequests = []) {
  const requestEvents = notificationService.credentialRequestsToEvents(credentialRequests);
  const visibleRequestEvents = await notificationService.filterDeletedNotifications(requestEvents);
  const byId = new Map();

  [...history, ...visibleRequestEvents].forEach((item) => {
    if (item?.id) byId.set(String(item.id), item);
  });

  return sortNotifications(Array.from(byId.values()));
}

export const useAppStore = create((set, get) => ({
  bootstrapped: false,
  user: null,
  sessionId: '',
  credentials: [],
  credentialRequests: [],
  notifications: [],
  activeRequest: null,
  error: '',
  loading: initialLoaders,

  setLoading(key, value) {
    set((state) => ({
      loading: { ...state.loading, [key]: value }
    }));
  },

  setError(message) {
    set({ error: message || '' });
  },

  async bootstrap() {
    const { token, sessionId, user } = await loadSession();
    const localCredentials = await vcService.listCredentials();
    let credentials = localCredentials;
    let credentialRequests = [];

    if (token) {
      try {
        credentials = await vcService.syncFromBackend();
      } catch {
        credentials = localCredentials;
      }

      try {
        credentialRequests = await vcService.listCredentialRequests();
      } catch {
        credentialRequests = [];
      }
    }

    const history = await notificationService.fetchHistory();
    const notifications = await mergeActivityItems(history, credentialRequests);

    set({
      bootstrapped: true,
      user: token ? user : null,
      sessionId: sessionId || '',
      credentials,
      credentialRequests,
      notifications
    });
  },

  async login(payload) {
    get().setLoading('auth', true);
    try {
      const session = await authService.login(payload);
      set({
        user: session.user,
        sessionId: session.sessionId || '',
        error: ''
      });
      return session;
    } finally {
      get().setLoading('auth', false);
    }
  },

  async register(payload) {
    get().setLoading('auth', true);
    try {
      const session = await authService.register(payload);
      set({
        user: session.user,
        sessionId: session.sessionId || '',
        error: ''
      });
      return session;
    } finally {
      get().setLoading('auth', false);
    }
  },

  async logout() {
    await authService.logout();
    await clearSession();
    set({
      user: null,
      sessionId: '',
      credentialRequests: [],
      activeRequest: null,
      error: ''
    });
  },

  async restoreSavedSession() {
    const { token, sessionId, user } = await loadSession();

    if (!token || !user) {
      throw new Error('No saved session is available on this device.');
    }

    set({
      user,
      sessionId: sessionId || '',
      error: ''
    });

    get().loadCredentials({ sync: true }).catch(() => {});
    get().loadNotifications().catch(() => {});

    return { token, sessionId, user };
  },

  async refreshAccount() {
    const user = await authService.fetchMe();
    const { token, sessionId } = await loadSession();
    await saveSession({ token, sessionId, user });
    set({ user });
    return user;
  },

  async loadAccountVerification() {
    return verificationService.getAccountVerification();
  },

  async submitAccountVerification(payload) {
    const submission = await verificationService.submitAccountVerification(payload);
    await get().refreshAccount();
    return submission;
  },

  async requestEmailOtp(email) {
    return authService.requestEmailOtp(email);
  },

  async verifyEmailOtp(payload) {
    return authService.verifyEmailOtp(payload);
  },

  async requestPasswordResetOtp(email) {
    return authService.requestPasswordResetOtp(email);
  },

  async verifyPasswordResetOtp(payload) {
    return authService.verifyPasswordResetOtp(payload);
  },

  async resetPassword(payload) {
    return authService.resetPassword(payload);
  },

  async loadCredentials({ sync = false } = {}) {
    get().setLoading('credentials', true);
    try {
      const credentials = sync
        ? await vcService.syncFromBackend()
        : await vcService.listCredentials();
      set({ credentials });
      return credentials;
    } finally {
      get().setLoading('credentials', false);
    }
  },

  async loadCredentialRequests() {
    get().setLoading('requests', true);
    try {
      const requests = await vcService.listCredentialRequests();
      const notifications = await mergeActivityItems(get().notifications, requests);
      set({ credentialRequests: requests, notifications });
      return requests;
    } finally {
      get().setLoading('requests', false);
    }
  },

  async requestCredential(payload = {}) {
    let user = get().user;

    if (!isVerifiedAndLinked(user)) {
      user = await get().refreshAccount();
    }

    if (!isVerifiedAndLinked(user)) {
      throw new Error('Your account must be verified before requesting this credential.');
    }

    const result = await vcService.requestCredential(payload);
    await get().loadCredentialRequests().catch(() => {});
    await get().addActivity(
      notificationService.credentialRequestToEvent(result?.request || result) || {
        type: 'credential_requested',
        title: 'Credential request submitted',
        body: result?.processingNote || 'Processing may take up to 3 working days after payment.',
        data: {
          request: result?.request || result,
          credentialRequestId: result?.request?._id,
          credentialType: result?.request?.credentialType || payload?.credentialType,
          requestStatus: result?.request?.status || result?.status || 'pending',
          paymentStatus: result?.request?.paymentStatus || result?.paymentStatus || 'unpaid',
          paymentCode: result?.paymentCode || result?.request?.paymentCode || '',
          receiptNo: result?.request?.receiptNo || result?.receiptNo || '',
          paidAt: result?.request?.paidAt || result?.paidAt || '',
          amount: result?.request?.amount || result?.amount || '',
          createdAt: result?.request?.createdAt || result?.createdAt || '',
          processingNote:
            result?.processingNote ||
            result?.request?.processingNote ||
            'Processing may take up to 3 working days after payment.',
          credentialStatus: result?.request?.credentialStatus || result?.request?.status || ''
        }
      }
    );
    return result;
  },

  async saveCredential(credential) {
    const saved = await vcService.saveCredential(credential);
    await get().loadCredentials();
    await get().addActivity({
      type: 'credential_saved',
      title: 'Credential saved',
      body: saved.meta?.title || 'Stored locally',
      data: { credentialId: saved.id }
    });
    return saved;
  },

  async deleteCredential(id) {
    const credentials = await vcService.deleteCredential(id);
    set({ credentials });
  },

  async claimCredential(scanResult) {
    let user = get().user;

    if (!isVerifiedAndLinked(user)) {
      user = await get().refreshAccount();
    }

    if (!isVerifiedAndLinked(user)) {
      throw new Error(VERIFICATION_REQUIRED_MESSAGE);
    }

    const saved = await vcService.claimCredential(scanResult);
    await get().loadCredentials();
    await get().addActivity({
      type: 'credential_claimed',
      title: 'Credential claimed',
      body: saved.meta?.title || 'Stored locally',
      data: { credentialId: saved.id }
    });
    return saved;
  },

  async loadVerificationRequest(sessionId, nonce = '') {
    get().setLoading('verification', true);
    try {
      const request = await verificationService.getVerificationRequest(sessionId, nonce);
      set({ activeRequest: request, error: '' });
      return request;
    } finally {
      get().setLoading('verification', false);
    }
  },

  async approveVerificationRequest({ sessionId, nonce = '', credential }) {
    get().setLoading('verification', true);
    try {
      const result = await verificationService.approveVerificationRequest({
        sessionId,
        nonce,
        credential
      });
      await get().addActivity({
        type: 'verification_approved',
        title: 'Credential shared',
        body: get().activeRequest?.request?.purpose || get().activeRequest?.purpose || '',
        data: { sessionId }
      });
      set({ activeRequest: null });
      return result;
    } finally {
      get().setLoading('verification', false);
    }
  },

  async denyVerificationRequest(sessionId, nonce = '') {
    get().setLoading('verification', true);
    try {
      const result = await verificationService.denyVerificationRequest(sessionId, nonce);
      await get().addActivity({
        type: 'verification_denied',
        title: 'Verification denied',
        body: 'You denied the verifier request.',
        data: { sessionId }
      });
      set({ activeRequest: null });
      return result;
    } finally {
      get().setLoading('verification', false);
    }
  },

  async loadNotifications() {
    get().setLoading('notifications', true);
    try {
      const history = await notificationService.fetchHistory();
      let credentialRequests = get().credentialRequests;

      try {
        credentialRequests = await vcService.listCredentialRequests();
      } catch {
        credentialRequests = get().credentialRequests;
      }

      const notifications = await mergeActivityItems(history, credentialRequests);
      set({ notifications, credentialRequests });
      return notifications;
    } finally {
      get().setLoading('notifications', false);
    }
  },

  async addActivity(event) {
    const saved = await notificationService.saveLocalEvent(event);
    const notifications = [saved, ...get().notifications.filter((item) => item.id !== saved.id)];
    set({ notifications });
    return saved;
  },

  async hideRemoteNotifications(ids = []) {
    const stringIds = ids.map((id) => String(id));
    await notificationService.saveDeletedNotificationIds(stringIds);
    set((state) => ({
      notifications: state.notifications.filter((item) => !stringIds.includes(String(item.id)))
    }));
  },

  async deleteNotifications(ids = []) {
    const stringIds = ids.map((id) => String(id));
    await notificationService.deleteLocalEvents(stringIds);
    await notificationService.saveDeletedNotificationIds(stringIds);
    set((state) => ({
      notifications: state.notifications.filter((item) => !stringIds.includes(String(item.id)))
    }));
  },

  async registerPushToken(token) {
    return notificationService.registerPushToken(token);
  },

  async markNotificationsSeen() {
    await writeJson(STORAGE_KEYS.LAST_SEEN_AT, Date.now());
  }
}));

export const selectIsAuthenticated = (state) => !!state.user;

