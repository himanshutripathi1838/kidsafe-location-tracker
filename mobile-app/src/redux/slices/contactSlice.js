import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const mockContacts = {
  'c-uuid-1': [
    {
      id: 'con-1',
      name: 'Vikram Singh',
      phone: '+91 70679 91838',
      relationship: 'Father',
      is_primary: true,
      call_priority: 1,
      alert_sos: true,
      alert_geofence: true,
      alert_speed: true,
      alert_battery: true,
      alert_device_off: true,
      alert_tamper: true,
      alert_summary: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '06:00',
      language: 'english'
    },
    {
      id: 'con-2',
      name: 'Priya Singh',
      phone: '+91 62653 27545',
      relationship: 'Mother',
      is_primary: true,
      call_priority: 2,
      alert_sos: true,
      alert_geofence: true,
      alert_speed: false,
      alert_battery: true,
      alert_device_off: true,
      alert_tamper: true,
      alert_summary: true,
      quiet_hours_start: '22:30',
      quiet_hours_end: '05:30',
      language: 'hindi'
    },
    {
      id: 'con-3',
      name: 'Ramesh Singh',
      phone: '+91 76543 21098',
      relationship: 'Grandfather',
      is_primary: false,
      call_priority: 0,
      alert_sos: true,
      alert_geofence: true,
      alert_speed: false,
      alert_battery: false,
      alert_device_off: true,
      alert_tamper: false,
      alert_summary: false,
      quiet_hours_start: '21:00',
      quiet_hours_end: '07:00',
      language: 'hindi'
    },
    {
      id: 'con-4',
      name: 'Kavita Devi',
      phone: '+91 65432 10987',
      relationship: 'Grandmother',
      is_primary: false,
      call_priority: 0,
      alert_sos: true,
      alert_geofence: false,
      alert_speed: false,
      alert_battery: false,
      alert_device_off: false,
      alert_tamper: false,
      alert_summary: false,
      quiet_hours_start: '20:30',
      quiet_hours_end: '07:30',
      language: 'hindi'
    }
  ],
  'c-uuid-2': [
    {
      id: 'con-5',
      name: 'Vikram Singh',
      phone: '+91 70679 91838',
      relationship: 'Father',
      is_primary: true,
      call_priority: 1,
      alert_sos: true,
      alert_geofence: true,
      alert_speed: true,
      alert_battery: true,
      alert_device_off: true,
      alert_tamper: true,
      alert_summary: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '06:00',
      language: 'english'
    },
    {
      id: 'con-6',
      name: 'Priya Singh',
      phone: '+91 62653 27545',
      relationship: 'Mother',
      is_primary: true,
      call_priority: 2,
      alert_sos: true,
      alert_geofence: true,
      alert_speed: true,
      alert_battery: true,
      alert_device_off: true,
      alert_tamper: true,
      alert_summary: true,
      quiet_hours_start: '22:30',
      quiet_hours_end: '05:30',
      language: 'hindi'
    }
  ]
};

export const fetchContacts = createAsyncThunk(
  'contact/fetch',
  async (childId, { rejectWithValue }) => {
    try {
      return mockContacts[childId] || [];
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const startEditSession = createAsyncThunk(
  'contact/startEditSession',
  async ({ childId }, { rejectWithValue }) => {
    try {
      // Mocks sending SMS OTP to primary contact phone
      return {
        session_id: `sess-${Date.now()}`,
        active: true,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
        otp_verified: false
      };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const verifyEditSessionOtp = createAsyncThunk(
  'contact/verifyOtp',
  async ({ otp }, { rejectWithValue }) => {
    try {
      // Mock code bypass
      if (otp === '1234' || otp === '123456') {
        return true;
      }
      throw new Error('Invalid OTP. Use 1234 to verify contact edit session.');
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const contactSlice = createSlice({
  name: 'contact',
  initialState: {
    contacts: mockContacts,
    editSession: null,
    loading: false,
    error: null
  },
  reducers: {
    reorderContactsLocal: (state, action) => {
      const { childId, reorderedList } = action.payload;
      state.contacts[childId] = reorderedList;
    },
    saveContactLocal: (state, action) => {
      const { childId, contact } = action.payload;
      if (!state.contacts[childId]) {
        state.contacts[childId] = [];
      }
      
      const index = state.contacts[childId].findIndex(c => c.id === contact.id);
      if (index !== -1) {
        state.contacts[childId][index] = contact;
      } else {
        state.contacts[childId].push(contact);
      }
    },
    deleteContactLocal: (state, action) => {
      const { childId, contactId } = action.payload;
      if (state.contacts[childId]) {
        state.contacts[childId] = state.contacts[childId].filter(c => c.id !== contactId);
      }
    },
    endEditSession: (state) => {
      state.editSession = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContacts.fulfilled, (state, action) => {
        state.contacts[action.meta.arg] = action.payload;
      })
      .addCase(startEditSession.fulfilled, (state, action) => {
        state.editSession = action.payload;
      })
      .addCase(verifyEditSessionOtp.fulfilled, (state) => {
        if (state.editSession) {
          state.editSession.otp_verified = true;
        }
      })
      .addCase(verifyEditSessionOtp.rejected, (state, action) => {
        state.error = action.payload;
      });
  }
});

export const { reorderContactsLocal, saveContactLocal, deleteContactLocal, endEditSession } = contactSlice.actions;
export default contactSlice.reducer;
