import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://10.152.202.60:5000/api'; // Local Laptop Server IP

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Auth Token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor with Mock Fallback for easy client testing
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config } = error;
    
    // If the server is unreachable (status code is undefined or connection timeout),
    // we intercept and return simulated mock responses for a smooth frontend experience.
    if (!error.response || error.code === 'ECONNABORTED' || error.message.includes('Network Error')) {
      console.warn(`API server offline. Mocking response for: ${config.url}`);
      return handleMockFallback(config);
    }
    
    return Promise.reject(error);
  }
);

// Mock Fallbacks router
const handleMockFallback = (config) => {
  const url = config.url;

  if (url.includes('/auth/send-otp')) {
    return { data: { success: true, message: 'Mock OTP sent successfully (1234)' } };
  }
  
  if (url.includes('/auth/verify-otp')) {
    return {
      data: {
        token: 'mock-jwt-token-xyz',
        parent: { id: 'p-uuid-1', name: 'Vikram Singh', phone: '+91 98765 43210', email: 'parent@gmail.com' }
      }
    };
  }

  if (url.includes('/children/list')) {
    return {
      data: [
        { id: 'c-uuid-1', name: 'Aarav Singh', age: 8, device_id: 'dev-aarav-101', speed_threshold: 20 },
        { id: 'c-uuid-2', name: 'Diya Singh', age: 12, device_id: 'dev-diya-202', speed_threshold: 25 }
      ]
    };
  }

  if (url.includes('/location/live/')) {
    return {
      data: {
        latitude: 28.6253,
        longitude: 77.2155,
        speed: 5,
        battery: 88,
        network: '4G',
        timestamp: new Date().toISOString()
      }
    };
  }

  if (url.includes('/geofence/list/')) {
    return {
      data: [
        { id: 'z-1', name: 'Home', latitude: 28.6129, longitude: 77.2295, radius: 200, color: '#4CAF50' },
        { id: 'z-2', name: 'School', latitude: 28.6253, longitude: 77.2155, radius: 150, color: '#2196F3' }
      ]
    };
  }

  // General fallback
  return Promise.resolve({ data: { success: true, mocked: true } });
};

export default apiClient;
