import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Initial Mock Children
const initialChildren = [
  {
    id: 'c-uuid-1',
    name: 'Aarav Singh',
    age: 8,
    device_id: '864369034877211',
    is_active: true,
    school_mode: true,
    school_start: '08:00',
    school_end: '14:30',
    speed_threshold: 20.0,
  }
];

export const fetchChildren = createAsyncThunk(
  'child/fetchChildren',
  async (_, { rejectWithValue }) => {
    try {
      // In production: const res = await axios.get(`${API_URL}/children/list`); return res.data;
      return initialChildren;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch children');
    }
  }
);

export const addChild = createAsyncThunk(
  'child/addChild',
  async (childData, { rejectWithValue }) => {
    try {
      const newChild = {
        id: `c-uuid-${Date.now()}`,
        name: childData.name,
        age: parseInt(childData.age, 10),
        device_id: childData.deviceId,
        is_active: true,
        school_mode: false,
        school_start: '08:00',
        school_end: '14:30',
        speed_threshold: 20.0,
      };
      return newChild;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to add child');
    }
  }
);

export const updateChildSettings = createAsyncThunk(
  'child/updateChildSettings',
  async ({ childId, settings }, { rejectWithValue }) => {
    try {
      return { childId, settings };
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to update settings');
    }
  }
);

const childSlice = createSlice({
  name: 'child',
  initialState: {
    children: initialChildren,
    selectedChildId: 'c-uuid-1',
    loading: false,
    error: null,
  },
  reducers: {
    setSelectedChildId: (state, action) => {
      state.selectedChildId = action.payload;
    },
    updateLocalChildSettings: (state, action) => {
      const { childId, settings } = action.payload;
      const index = state.children.findIndex(c => c.id === childId);
      if (index !== -1) {
        state.children[index] = { ...state.children[index], ...settings };
      }
    },
    addChildLocal: (state, action) => {
      state.children.push(action.payload);
      state.selectedChildId = action.payload.id;
    },
    deleteChildLocal: (state, action) => {
      const childId = action.payload;
      state.children = state.children.filter(c => c.id !== childId);
      if (state.selectedChildId === childId) {
        if (state.children.length > 0) {
          state.selectedChildId = state.children[0].id;
        } else {
          state.selectedChildId = null;
        }
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChildren.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchChildren.fulfilled, (state, action) => {
        state.loading = false;
        state.children = action.payload;
        if (action.payload.length > 0 && !state.selectedChildId) {
          state.selectedChildId = action.payload[0].id;
        }
      })
      .addCase(fetchChildren.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(addChild.fulfilled, (state, action) => {
        state.children.push(action.payload);
        state.selectedChildId = action.payload.id;
      })
      .addCase(updateChildSettings.fulfilled, (state, action) => {
        const { childId, settings } = action.payload;
        const index = state.children.findIndex(c => c.id === childId);
        if (index !== -1) {
          state.children[index] = { ...state.children[index], ...settings };
        }
      });
  }
});

export const { setSelectedChildId, updateLocalChildSettings, addChildLocal, deleteChildLocal } = childSlice.actions;
export default childSlice.reducer;
