import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import childReducer from './slices/childSlice';
import locationReducer from './slices/locationSlice';
import sosReducer from './slices/sosSlice';
import geofenceReducer from './slices/geofenceSlice';
import contactReducer from './slices/contactSlice';
import reportReducer from './slices/reportSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    child: childReducer,
    location: locationReducer,
    sos: sosReducer,
    geofence: geofenceReducer,
    contact: contactReducer,
    report: reportReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Turn off serialization checks for simple map coordinates and socket objects
    }),
});

export default store;
