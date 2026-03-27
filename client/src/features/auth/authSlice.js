import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getWebMe, loginWeb, logout, readStoredAuth } from './authAPI';

const stored = readStoredAuth();

const initialState = {
  token: stored?.token || null,
  sessionId: stored?.sessionId || null,
  user: stored?.user || null,
  isLoading: false,
  isError: false,
  message: '',
};

export const login = createAsyncThunk('auth/login', async (payload, thunkAPI) => {
  try {
    return await loginWeb(payload);
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Login failed';
    return thunkAPI.rejectWithValue(message);
  }
});

export const hydrateAuth = createAsyncThunk('auth/hydrateAuth', async (_, thunkAPI) => {
  try {
    if (!readStoredAuth()?.token) {
      return null;
    }
    return await getWebMe();
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Session expired';
    return thunkAPI.rejectWithValue(message);
  }
});

export const signOut = createAsyncThunk('auth/signOut', async () => {
  await logout();
  return null;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetAuthMessage: (state) => {
      state.isError = false;
      state.message = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.message = '';
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.sessionId = action.payload.sessionId;
        state.user = action.payload.user;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        state.token = null;
        state.sessionId = null;
        state.user = null;
      })
      .addCase(hydrateAuth.fulfilled, (state, action) => {
        if (!action.payload) return;
        state.token = action.payload.token;
        state.sessionId = action.payload.sessionId;
        state.user = action.payload.user;
      })
      .addCase(hydrateAuth.rejected, (state, action) => {
        state.isError = true;
        state.message = action.payload;
        state.token = null;
        state.sessionId = null;
        state.user = null;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.token = null;
        state.sessionId = null;
        state.user = null;
        state.isLoading = false;
        state.isError = false;
        state.message = '';
      });
  },
});

export const { resetAuthMessage } = authSlice.actions;
export default authSlice.reducer;
