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
    (value) => String(value || '').trim().toLowerCase() === 'verified'
  );
}

function isVerifiedAndLinked(user) {
  return hasVerifiedStatus(user) && Boolean(String(user?.studentId || '').trim());
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

    if (token) {
      try {
        credentials = await vcService.syncFromBackend();
      } catch {
        credentials = localCredentials;
      }
    }

    const notifications = await notificationService.fetchHistory();

    set({
      bootstrapped: true,
      user: token ? user : null,
      sessionId: sessionId || '',
      credentials,
      credentialRequests: [],
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
      set({ credentialRequests: requests });
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
    await get().addActivity({
      type: 'credential_requested',
      title: 'Credential request submitted',
      body: result?.processingNote || 'Processing may take up to 3 working days after payment.',
      data: {
        credentialRequestId: result?.request?._id,
        paymentCode: result?.paymentCode || result?.request?.paymentCode || ''
      }
    });
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
      const notifications = await notificationService.fetchHistory();
      set({ notifications });
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

  async registerPushToken(token) {
    return notificationService.registerPushToken(token);
  },

  async markNotificationsSeen() {
    await writeJson(STORAGE_KEYS.LAST_SEEN_AT, Date.now());
  }
}));

export const selectIsAuthenticated = (state) => !!state.user;

