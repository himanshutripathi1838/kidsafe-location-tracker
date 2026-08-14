import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const triggerLocalSos = createAsyncThunk(
  'sos/triggerLocal',
  async ({ childId, childName, location }, { rejectWithValue }) => {
    try {
      const sosAlert = {
        id: `sos-${Date.now()}`,
        child_id: childId,
        child_name: childName,
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed || 0,
        battery: location.battery || 100,
        timestamp: new Date().toISOString(),
        status: 'triggered'
      };
      return sosAlert;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const resolveSosAlert = createAsyncThunk(
  'sos/resolve',
  async ({ alertId, notes }, { rejectWithValue }) => {
    try {
      return { alertId, notes, resolved_at: new Date().toISOString() };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const sosSlice = createSlice({
  name: 'sos',
  initialState: {
    activeSosAlert: null,
    alertHistory: [
      {
        id: 'sos-hist-1',
        child_name: 'Aarav Singh',
        type: 'SOS',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        status: 'resolved',
        resolved_notes: 'Accidental click while playing',
        resolved_at: new Date(Date.now() - 3600000 * 23.9).toISOString()
      },
      {
        id: 'sos-hist-2',
        child_name: 'Aarav Singh',
        type: 'Overspeed',
        details: 'Speed exceeded 20 km/h (22 km/h detected)',
        timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
        status: 'resolved',
        resolved_notes: 'Traveling in school bus',
        resolved_at: new Date(Date.now() - 3600000 * 1.4).toISOString()
      }
    ],
    loading: false,
    error: null
  },
  reducers: {
    dismissActiveSos: (state) => {
      state.activeSosAlert = null;
    },
    receiveRemoteSosAlert: (state, action) => {
      state.activeSosAlert = action.payload;
    },
    addAlertToHistory: (state, action) => {
      const newAlert = {
        id: `alert-${Date.now()}`,
        status: 'triggered',
        timestamp: new Date().toISOString(),
        ...action.payload
      };
      state.alertHistory.unshift(newAlert);
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(triggerLocalSos.fulfilled, (state, action) => {
        state.activeSosAlert = action.payload;
      })
      .addCase(resolveSosAlert.fulfilled, (state, action) => {
        const { alertId, notes, resolved_at } = action.payload;
        if (state.activeSosAlert && state.activeSosAlert.id === alertId) {
          const resolvedAlert = {
            ...state.activeSosAlert,
            status: 'resolved',
            resolved_notes: notes,
            resolved_at
          };
          state.alertHistory.unshift(resolvedAlert);
          state.activeSosAlert = null;
        } else {
          const index = state.alertHistory.findIndex(h => h.id === alertId);
          if (index !== -1) {
            state.alertHistory[index].status = 'resolved';
            state.alertHistory[index].resolved_notes = notes;
            state.alertHistory[index].resolved_at = resolved_at;
          }
        }
      });
  }
});

export const { dismissActiveSos, receiveRemoteSosAlert, addAlertToHistory } = sosSlice.actions;
export default sosSlice.reducer;
