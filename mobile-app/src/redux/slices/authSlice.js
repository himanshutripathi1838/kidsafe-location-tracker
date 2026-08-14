import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper to get configuration for requests
const getHeaders = (token) => ({
  headers: { Authorization: `Bearer ${token}` }
});

export const loginWithPhone = createAsyncThunk(
  'auth/loginWithPhone',
  async ({ phone }, { rejectWithValue }) => {
    try {
      // Mock mode fallback if API is not available
      // In production: await axios.post(`${process.env.API_URL}/auth/send-otp`, { phone });
      return { success: true, message: 'OTP Sent successfully' };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to send OTP');
    }
  }
);

export const verifyOTP = createAsyncThunk(
  'auth/verifyOTP',
  async ({ phone, otp }, { rejectWithValue }) => {
    try {
      // Mock verification for local testing
      if (otp === '123456' || otp === '1234') {
        const mockResponse = {
          token: 'mock-jwt-token-xyz',
          parent: {
            id: 'p-uuid-1',
            name: 'Vikram Singh',
            phone: phone,
            email: 'vikram.singh@gmail.com',
            is_active: true
          }
        };
        await AsyncStorage.setItem('token', mockResponse.token);
        await AsyncStorage.setItem('user', JSON.stringify(mockResponse.parent));
        return mockResponse;
      }
      throw new Error('Invalid OTP. Use 123456 or 1234 to bypass in testing mode.');
    } catch (err) {
      return rejectWithValue(err.message || 'OTP verification failed');
    }
  }
);

export const registerParent = createAsyncThunk(
  'auth/registerParent',
  async ({ name, phone, email, password }, { rejectWithValue }) => {
    try {
      const mockResponse = {
        token: 'mock-jwt-token-xyz',
        parent: {
          id: 'p-uuid-1',
          name: name,
          phone: phone,
          email: email || 'parent@gmail.com',
          is_active: true
        }
      };
      await AsyncStorage.setItem('token', mockResponse.token);
      await AsyncStorage.setItem('user', JSON.stringify(mockResponse.parent));
      return mockResponse;
    } catch (err) {
      return rejectWithValue(err.message || 'Registration failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    return null;
  }
);

export const loadStoredSession = createAsyncThunk(
  'auth/loadStoredSession',
  async (_, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userJSON = await AsyncStorage.getItem('user');
      if (token && userJSON) {
        return { token, parent: JSON.parse(userJSON) };
      }
      return null;
    } catch (err) {
      return rejectWithValue('Failed to load session');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    otpSent: false,
    error: null,
    language: 'en',
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetOtpStatus: (state) => {
      state.otpSent = false;
    },
    setLanguage: (state, action) => {
      state.language = action.payload;
    },
    updateParentProfile: (state, action) => {
      const { name, phone } = action.payload;
      if (state.user) {
        state.user.name = name;
        state.user.phone = phone;
        AsyncStorage.setItem('user', JSON.stringify(state.user)).catch(err => console.log('AsyncStorage error:', err));
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Login Phone (Send OTP)
      .addCase(loginWithPhone.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithPhone.fulfilled, (state) => {
        state.loading = false;
        state.otpSent = true;
      })
      .addCase(loginWithPhone.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Verify OTP
      .addCase(verifyOTP.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.user = action.payload.parent;
        state.otpSent = false;
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Register
      .addCase(registerParent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerParent.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.user = action.payload.parent;
      })
      .addCase(registerParent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.otpSent = false;
        state.error = null;
      })
      // Load session
      .addCase(loadStoredSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.token = action.payload.token;
          state.user = action.payload.parent;
          state.isAuthenticated = true;
        }
      });
  },
});

export const { clearError, resetOtpStatus, setLanguage, updateParentProfile } = authSlice.actions;
export default authSlice.reducer;
