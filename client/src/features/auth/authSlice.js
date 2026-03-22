// src/features/auth/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authService from './authService';

const initialState = {
  user: (() => { try { return JSON.parse(localStorage.getItem('user')) || null; } catch { return null; } })(),
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: '',
};

// Register
export const register = createAsyncThunk('auth/register', async (user, thunkAPI) => {
  try {
    return await authService.register(user); // service may persist if token+role present
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Registration failed';
    return thunkAPI.rejectWithValue(message);
  }
});

// Login
export const login = createAsyncThunk('auth/login', async (user, thunkAPI) => {
  try {
    return await authService.login(user); // service persists on success
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Login failed';
    return thunkAPI.rejectWithValue(message);
  }
});

// Logout
export const logout = createAsyncThunk('auth/logout', async () => {
  await authService.logout(); // clears server audit + local storage
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    reset: (state) => {
      state.isLoading = false;
      state.isSuccess = false;
      state.isError = false;
      state.message = '';
    },
    setUser: (state, action) => {
    state.user = action.payload || null;
   },
  },
  extraReducers: (builder) => {
    builder
      // register
      .addCase(register.pending,  (s) => { s.isLoading = true; })
      .addCase(register.fulfilled,(s,a) => { s.isLoading = false; s.isSuccess = true; /* keep s.user as-is unless backend returned a token */ if (a.payload?.token) s.user = a.payload; })
      .addCase(register.rejected, (s,a) => { s.isLoading = false; s.isError = true; s.message = a.payload; })

      // login
      .addCase(login.pending,     (s) => { s.isLoading = true; })
      .addCase(login.fulfilled,   (s,a) => { s.isLoading = false; s.isSuccess = true; s.isError = false; s.message = ''; s.user = a.payload; })
      .addCase(login.rejected,    (s,a) => { s.isLoading = false; s.isError = true; s.message = a.payload; s.user = null; })

      // logout
      .addCase(logout.fulfilled,  (s) => { s.user = null; });
  },
});

export const { reset, setUser } = authSlice.actions;
export default authSlice.reducer;
