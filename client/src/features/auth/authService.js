// src/features/auth/authService.js
import axios from 'axios';
import { API_URL } from '../../../config';//make this on the env its actually just this export const API_URL = "http://localhost:5000";   

const LS_KEY = 'user';
const allowedRoles = ['admin', 'superadmin', 'developer','cashier'];

const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; }
};
const setStoredUser = (u) => localStorage.setItem(LS_KEY, JSON.stringify(u));
const clearStoredUser = () => localStorage.removeItem(LS_KEY);

// export if other modules need it
export const getToken = () => getStoredUser()?.token || null;

// ----- Register (web/admin) -----
const register = async (userData) => {
  const { data } = await axios.post(`${API_URL}/api/web/users`, userData);
  // If backend returns a token + role, only persist if role is allowed
  if (data?.token && allowedRoles.includes(data.role)) {
    setStoredUser(data);
  }
  return data;
};

// ----- Login -----
const login = async (userData) => {
  const { data } = await axios.post(`${API_URL}/api/web/users/login`, userData);
  if (!data) return null;

  if (!allowedRoles.includes(data.role)) {
    throw new Error('Unauthorized role: only admin, staff, or developer can log in.');
  }
  setStoredUser(data);
  return data;
};

// ----- Logout (calls backend + clears client) -----
const logout = async () => {
  const token = getToken();
  try {
    if (token) {
      await axios.post(
        `${API_URL}/api/web/users/logout`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }
  } catch {
    // ignore API/network errors; still clear local state
  } finally {
    clearStoredUser();
  }
};

const requestPasswordReset = async (email) => {
  const { data } = await axios.post(`${API_URL}/api/password/forgot`, { email });
  return data; // { success: true, debugCode? }
};

const verifyPasswordReset = async (email, code) => {
  const { data } = await axios.post(`${API_URL}/api/password/verify`, { email, code });
  return data; // { success: true, resetSession }
};

const completePasswordReset = async ({ email, resetSession, newPassword }) => {
  const { data } = await axios.post(`${API_URL}/api/password/reset`, {
    email,
    resetSession,
    newPassword,
  });
  return data; // { success: true }
};

export default {
  register,
  login,
  logout,
  getToken,
  requestPasswordReset,
  verifyPasswordReset,
  completePasswordReset,
};
