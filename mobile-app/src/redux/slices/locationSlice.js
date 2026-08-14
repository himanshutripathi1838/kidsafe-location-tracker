import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../services/api';

// Haversine distance calculation in km
function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Initial Bhopal routes (New Market, Roshanpura Square, Arera Colony, Bhopal)
const mockRoutes = {
  'c-uuid-1': [
    { latitude: 23.2334, longitude: 77.4011, speed: 0.0, battery: 98, network: '4G', mode: 'Stopped', status: 'New Market (Home)', timestamp: new Date(Date.now() - 3600000 * 3).toISOString() }, // New Market Bhopal
    { latitude: 23.2345, longitude: 77.4020, speed: 3.6, battery: 96, network: '4G', mode: 'Walking', status: 'TT Nagar Walk', timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString() }, // TT Nagar Walking
    { latitude: 23.2370, longitude: 77.4035, speed: 24.5, battery: 95, network: '4G', mode: 'School Bus', status: 'Roshanpura Square', timestamp: new Date(Date.now() - 3600000 * 2).toISOString() }, // Roshanpura Square Bus
    { latitude: 23.2280, longitude: 77.4180, speed: 28.0, battery: 92, network: '3G', mode: 'School Bus', status: 'Link Road No. 1', timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString() },
    { latitude: 23.2210, longitude: 77.4320, speed: 3.8, battery: 89, network: '4G', mode: 'Walking', status: 'School Gate Arera Colony', timestamp: new Date(Date.now() - 3600000 * 1).toISOString() },
    { latitude: 23.2334, longitude: 77.4011, speed: 0.0, battery: 85, network: '4G', mode: 'Stopped', status: 'New Market Bhopal', timestamp: new Date().toISOString() } // New Market Bhopal
  ],
  'c-uuid-2': [
    { latitude: 23.2370, longitude: 77.4025, speed: 0.0, battery: 74, network: '4G', mode: 'Stopped', status: 'GTB Complex Bhopal', timestamp: new Date(Date.now() - 3600000 * 4).toISOString() },
    { latitude: 23.2360, longitude: 77.4018, speed: 3.4, battery: 72, network: '4G', mode: 'Walking', status: 'Top N Town Walk', timestamp: new Date(Date.now() - 3600000 * 3).toISOString() },
    { latitude: 23.2300, longitude: 77.3820, speed: 14.2, battery: 70, network: '3G', mode: 'Bicycle', status: 'Boat Club Road Bhopal', timestamp: new Date(Date.now() - 3600000 * 2).toISOString() },
    { latitude: 23.2334, longitude: 77.4011, speed: 3.5, battery: 68, network: '4G', mode: 'Walking', status: 'New Market Bhopal', timestamp: new Date(Date.now() - 3600000 * 1).toISOString() },
    { latitude: 23.2334, longitude: 77.4011, speed: 0.0, battery: 65, network: '4G', mode: 'Stopped', status: 'New Market Bhopal', timestamp: new Date().toISOString() }
  ]
};

export const fetchLiveLocation = createAsyncThunk(
  'location/fetchLive',
  async (childId, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/location/live/${childId}`);
      if (response.data && response.data.success && response.data.location) {
        return response.data.location;
      }
      return null;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch live location');
    }
  }
);

export const fetchLocationHistory = createAsyncThunk(
  'location/fetchHistory',
  async (childId, { rejectWithValue }) => {
    try {
      return mockRoutes[childId] || [];
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch location history');
    }
  }
);

const locationSlice = createSlice({
  name: 'location',
  initialState: {
    isSimulationMode: false,
    isSocketConnected: false,
    isMqttServerOnline: true,
    liveLocations: {},
    routeHistory: {},
    isHistoryMocked: {},
    loading: false,
    error: null,
  },
  reducers: {
    setSocketConnected: (state, action) => {
      state.isSocketConnected = action.payload;
    },
    setSimulationMode: (state, action) => {
      state.isSimulationMode = action.payload;
    },
    updateLiveLocation: (state, action) => {
      const { 
        childId, latitude, longitude, speed, battery, network, isSimulated,
        satellites, course, countryCode, operatorCode, lac, cellId, configMode, status 
      } = action.payload;
      
      // Safeguard: Ignore invalid or missing coordinates to prevent MapView crashes
      if (!childId || typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude) || (latitude === 0 && longitude === 0)) {
        return;
      }

      // Safeguard: If simulation is active, block raw GPS updates to prevent flickering
      if (state.isSimulationMode && !isSimulated) {
        return;
      }

      const calcSpeed = speed ?? 0;
      let mode = 'Stationary';
      let statusText = '🛑 Stopped';

      if (calcSpeed < 0.5) {
        mode = 'Stationary';
        statusText = '🛑 Stopped';
      } else if (calcSpeed <= 5.0) {
        mode = 'Walking';
        statusText = '🚶 Walking';
      } else if (calcSpeed <= 16.0) {
        mode = 'Bicycle';
        statusText = '🚲 Bicycle';
      } else {
        mode = 'School Bus / Vehicle';
        statusText = '🚌 School Bus / Vehicle';
      }

      const newLoc = {
        latitude,
        longitude,
        speed: calcSpeed,
        battery: battery ?? 100,
        network: network ?? '4G LTE',
        timestamp: new Date().toISOString(),
        status: statusText,
        mode,
        satellites: satellites ?? 0,
        course: course ?? 0.0,
        countryCode: countryCode ?? 404,
        operatorCode: operatorCode ?? 93,
        lac: lac ?? 1772,
        cellId: cellId ?? 6043,
        configMode: configMode ?? 2,
        deviceStatus: status ?? 'online',
        imei: action.payload.imei || null
      };
      
      state.liveLocations[childId] = newLoc;
      
      // Clear mock coordinates when receiving the first real/live MQTT telemetry coordinate
      if (state.isHistoryMocked[childId] && !isSimulated) {
        state.routeHistory[childId] = [];
        state.isHistoryMocked[childId] = false;
      }

      if (!state.routeHistory[childId]) {
        state.routeHistory[childId] = [];
      }
      
      const history = state.routeHistory[childId];
      const lastPoint = history[history.length - 1];
      
      // Jitter filter: Only add to path history if distance to last coordinate is greater than ~4 meters (0.00004 deg)
      let shouldAppend = true;
      if (lastPoint) {
        const diffLat = Math.abs(newLoc.latitude - lastPoint.latitude);
        const diffLng = Math.abs(newLoc.longitude - lastPoint.longitude);
        if (diffLat < 0.00004 && diffLng < 0.00004) {
          shouldAppend = false;
        }
      }
      
      if (shouldAppend) {
        history.push(newLoc);
        if (history.length > 200) {
          history.shift();
        }
      }
    },
    setDeviceOffline: (state, action) => {
      const { childId } = action.payload;
      if (state.liveLocations[childId]) {
        state.liveLocations[childId].status = 'Offline (Device Powered Off)';
        state.liveLocations[childId].battery = 0;
        state.liveLocations[childId].network = 'Disconnected';
      }
    },
    simulateMovementStep: (state, action) => {
      const { childId, transportMode = 'walking' } = action.payload || {};
      const currentLoc = state.liveLocations[childId];
      if (!currentLoc) return;

      // Deterministic movement calculation (Physics: d = v * t, no Math.random!)
      let stepSpeed = 3.6;
      let latShift = 0.000045;
      let modeName = 'Walking';
      let modeEmoji = '🚶';

      if (transportMode === 'bus') {
        stepSpeed = 26.5;
        latShift = 0.00031;
        modeName = 'School Bus';
        modeEmoji = '🚌';
      } else if (transportMode === 'bicycle') {
        stepSpeed = 12.5;
        latShift = 0.00014;
        modeName = 'Bicycle';
        modeEmoji = '🚲';
      }

      const newLat = currentLoc.latitude + latShift;
      const newLng = currentLoc.longitude + (latShift * 0.4);

      const newLoc = {
        latitude: parseFloat(newLat.toFixed(6)),
        longitude: parseFloat(newLng.toFixed(6)),
        speed: stepSpeed,
        battery: Math.max(5, currentLoc.battery),
        network: currentLoc.network || '4G LTE',
        timestamp: new Date().toISOString(),
        status: `${modeEmoji} ${modeName}`,
        mode: modeName
      };

      state.liveLocations[childId] = newLoc;
      if (!state.routeHistory[childId]) {
        state.routeHistory[childId] = [];
      }
      state.routeHistory[childId].push(newLoc);
      
      if (state.routeHistory[childId].length > 100) {
        state.routeHistory[childId].shift();
      }
    },
    setMqttServerOnline: (state, action) => {
      state.isMqttServerOnline = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLocationHistory.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchLocationHistory.fulfilled, (state, action) => {
        state.loading = false;
        const childId = action.meta.arg;
        state.routeHistory[childId] = action.payload;
      })
      .addCase(fetchLocationHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchLiveLocation.fulfilled, (state, action) => {
        if (action.payload) {
          const childId = action.meta.arg;
          state.liveLocations[childId] = action.payload;
        }
      });
  }
});

export const { updateLiveLocation, setDeviceOffline, simulateMovementStep, setSimulationMode, setSocketConnected, setMqttServerOnline } = locationSlice.actions;
export default locationSlice.reducer;
