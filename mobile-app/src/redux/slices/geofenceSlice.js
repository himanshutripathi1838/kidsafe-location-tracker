import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const mockZones = {
  'c-uuid-1': [
    {
      id: 'z-1',
      name: 'Safe Route (Road Corridor to New Market)',
      type: 'path',
      path: [
        { latitude: 23.2205, longitude: 77.4002 }, // Start near MKM Urology Hospital
        { latitude: 23.2215, longitude: 77.3996 }, // Main Road 2
        { latitude: 23.2245, longitude: 77.3989 }, // Main Road 2 (RBI Colony)
        { latitude: 23.2278, longitude: 77.4001 }, // TT Nagar Road
        { latitude: 23.2305, longitude: 77.4010 }, // New Market southern approach
        { latitude: 23.2334, longitude: 77.4011 }  // Destination: New Market Center
      ],
      radius: 60, // Safe road corridor width: 60 meters buffer around actual road path
      color: '#10B981', // Green
      notify_on_entry: true,
      notify_on_exit: true,
      is_active: true
    }
  ],
  'c-uuid-2': [
    {
      id: 'z-3',
      name: 'Safe Route (Road Corridor to New Market)',
      type: 'path',
      path: [
        { latitude: 23.2205, longitude: 77.4002 },
        { latitude: 23.2215, longitude: 77.3996 },
        { latitude: 23.2245, longitude: 77.3989 },
        { latitude: 23.2278, longitude: 77.4001 },
        { latitude: 23.2305, longitude: 77.4010 },
        { latitude: 23.2334, longitude: 77.4011 }
      ],
      radius: 60,
      color: '#10B981',
      notify_on_entry: true,
      notify_on_exit: true,
      is_active: true
    }
  ]
};

export const fetchGeofences = createAsyncThunk(
  'geofence/fetch',
  async (childId, { rejectWithValue }) => {
    try {
      return mockZones[childId] || [];
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const addGeofenceZone = createAsyncThunk(
  'geofence/add',
  async ({ childId, zoneData }, { rejectWithValue }) => {
    try {
      const newZone = {
        id: `z-${Date.now()}`,
        name: zoneData.name,
        latitude: zoneData.latitude,
        longitude: zoneData.longitude,
        radius: parseInt(zoneData.radius, 10) || 100,
        color: zoneData.color || '#9C27B0',
        notify_on_entry: zoneData.notifyOnEntry ?? true,
        notify_on_exit: zoneData.notifyOnExit ?? true,
        is_active: true
      };
      return { childId, zone: newZone };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateGeofenceZone = createAsyncThunk(
  'geofence/update',
  async ({ childId, zoneId, zoneData }, { rejectWithValue }) => {
    try {
      return { childId, zoneId, zoneData };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteGeofenceZone = createAsyncThunk(
  'geofence/delete',
  async ({ childId, zoneId }, { rejectWithValue }) => {
    try {
      return { childId, zoneId };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const geofenceSlice = createSlice({
  name: 'geofence',
  initialState: {
    zones: mockZones,
    loading: false,
    error: null
  },
  reducers: {
    toggleZoneStatus: (state, action) => {
      const { childId, zoneId } = action.payload;
      const zoneList = state.zones[childId];
      if (zoneList) {
        const zone = zoneList.find(z => z.id === zoneId);
        if (zone) {
          zone.is_active = !zone.is_active;
        }
      }
    },
    resetGeofencesToDefault: (state) => {
      state.zones = mockZones;
    },
    updatePathStartPoint: (state, action) => {
      const { childId, zoneId, latitude, longitude } = action.payload;
      const zoneList = state.zones[childId];
      if (zoneList) {
        const zone = zoneList.find(z => z.id === zoneId);
        if (zone && zone.type === 'path' && zone.path.length > 0) {
          zone.path[0] = { latitude, longitude };
        }
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGeofences.fulfilled, (state, action) => {
        state.zones[action.meta.arg] = action.payload;
      })
      .addCase(addGeofenceZone.fulfilled, (state, action) => {
        const { childId, zone } = action.payload;
        if (!state.zones[childId]) {
          state.zones[childId] = [];
        }
        state.zones[childId].push(zone);
      })
      .addCase(updateGeofenceZone.fulfilled, (state, action) => {
        const { childId, zoneId, zoneData } = action.payload;
        const zoneList = state.zones[childId];
        if (zoneList) {
          const index = zoneList.findIndex(z => z.id === zoneId);
          if (index !== -1) {
            zoneList[index] = { ...zoneList[index], ...zoneData };
          }
        }
      })
      .addCase(deleteGeofenceZone.fulfilled, (state, action) => {
        const { childId, zoneId } = action.payload;
        const zoneList = state.zones[childId];
        if (zoneList) {
          state.zones[childId] = zoneList.filter(z => z.id !== zoneId);
        }
      });
  }
});

export const { toggleZoneStatus, resetGeofencesToDefault, updatePathStartPoint } = geofenceSlice.actions;
export default geofenceSlice.reducer;
