import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../services/api';

// Preloaded mock data for yesterday's commute reports
// Dynamic reports calculation helper based on realistic transport modes
const mockReports = {
  'c-uuid-1': {
    date: new Date(Date.now() - 3600000 * 24).toISOString().split('T')[0],
    total_distance: 4.8, // km total commute
    active_time: '1h 15m',
    avg_speed: 3.8, // km/h realistic walking/commute average
    max_speed: 26.5, // km/h school bus transit max speed
    stops_count: 3,
    stops_data: [
      { id: 's-1', name: 'Home (New Market, Bhopal)', duration: '12h 30m', battery: '98%', time: '08:00 AM' },
      { id: 's-2', name: 'Roshanpura Square (Traffic Halt)', duration: '15 mins', battery: '91%', time: '08:25 AM' },
      { id: 's-3', name: 'St. Joseph School (Arera Colony, Bhopal)', duration: '6h 30m', battery: '78%', time: '02:30 PM' }
    ],
    battery_history: {
      labels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
      data: [98, 92, 88, 82, 78, 72, 65]
    },
    speed_history: {
      labels: ['08:00', '08:15', '08:30', '14:30', '14:45', '15:00'],
      data: [0.0, 3.6, 24.5, 0.0, 26.5, 3.8] // 3.6-3.8 km/h walking, 24.5-26.5 km/h School Bus
    }
  },
  'c-uuid-2': {
    date: new Date(Date.now() - 3600000 * 24).toISOString().split('T')[0],
    total_distance: 1.8, // km
    active_time: '45m',
    avg_speed: 3.4, // km/h walking speed
    max_speed: 14.2, // km/h bicycle park ride
    stops_count: 2,
    stops_data: [
      { id: 's-4', name: 'Home (GTB Complex, Bhopal)', duration: '14h 10m', battery: '95%', time: '08:15 AM' },
      { id: 's-5', name: 'Van Vihar Boat Club Park (Bhopal)', duration: '1h 20m', battery: '82%', time: '05:30 PM' }
    ],
    battery_history: {
      labels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
      data: [95, 90, 84, 80, 75, 71, 62]
    },
    speed_history: {
      labels: ['08:00', '08:20', '08:40', '17:00', '17:20', '17:40'],
      data: [0.0, 3.4, 3.6, 0.0, 14.2, 3.5] // 3.4-3.6 km/h walking, 14.2 km/h bicycle
    }
  }
};

export const fetchDailyReport = createAsyncThunk(
  'report/fetchDaily',
  async ({ childId, date }, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/reports/daily/${childId}?date=${date}`);
      if (response.data && response.data.success && response.data.report) {
        return response.data.report;
      }
      return null;
    } catch (err) {
      // Fallback: If backend fails (offline) and date is today, return initial fresh layout
      const todayStr = new Date().toISOString().split('T')[0];
      if (date === todayStr) {
        return {
          date: todayStr,
          total_distance: 0.0,
          active_time: '0m',
          avg_speed: 0.0,
          max_speed: 0.0,
          stops_count: 0,
          stops_data: [],
          battery_history: { labels: [], data: [] },
          speed_history: { labels: [], data: [] }
        };
      }
      return rejectWithValue(err.message || 'Failed to fetch report');
    }
  }
);

const reportSlice = createSlice({
  name: 'report',
  initialState: {
    reports: mockReports,
    selectedDate: new Date().toISOString().split('T')[0],
    loading: false,
    error: null
  },
  reducers: {
    setSelectedDate: (state, action) => {
      state.selectedDate = action.payload;
    },
    loadPersistedReports: (state, action) => {
      if (action.payload) {
        state.reports = { ...state.reports, ...action.payload };
      }
    },
    updateLiveReportData: (state, action) => {
      const { childId, latitude, longitude, speed, battery, timestamp, imei } = action.payload;
      if (!childId) return;

      if (!state.reports[childId]) {
        state.reports[childId] = {
          date: new Date().toISOString().split('T')[0],
          total_distance: 0.0,
          active_time: '0m',
          avg_speed: parseFloat((speed || 0).toFixed(1)),
          max_speed: parseFloat((speed || 0).toFixed(1)),
          stops_count: 0,
          stops_data: [],
          battery_history: { labels: [], data: [] },
          speed_history: { labels: [], data: [] },
          lastLoggedTimestamp: 0,
          imei: imei || null,
          lastSeen: timestamp || new Date().toISOString()
        };
      }

      const report = state.reports[childId];
      report.imei = imei || report.imei;
      report.lastSeen = timestamp || new Date().toISOString();

      const timeStr = new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const numericSpeed = parseFloat((speed || 0).toFixed(1));

      // Update max speed dynamically
      if (numericSpeed > report.max_speed) {
        report.max_speed = numericSpeed;
      }

      // Update total distance incrementally if speed > 0.5 (simulated movement delta)
      if (numericSpeed > 0.5) {
        report.total_distance = parseFloat((report.total_distance + 0.05).toFixed(2));
      }

      // Real-time speed graph update (rolling 8 points window)
      report.speed_history.labels.push(timeStr);
      report.speed_history.data.push(numericSpeed);
      if (report.speed_history.data.length > 8) {
        report.speed_history.labels.shift();
        report.speed_history.data.shift();
      }

      // Real-time battery graph update (rolling 8 points window)
      if (battery !== undefined) {
        report.battery_history.labels.push(timeStr);
        report.battery_history.data.push(battery);
        if (report.battery_history.data.length > 8) {
          report.battery_history.labels.shift();
          report.battery_history.data.shift();
        }
      }

      // 2-MINUTE INTERVAL TIMELINE LOG ENGINE
      const now = Date.now();
      const lastLogTime = report.lastLoggedTimestamp || 0;

      if (now - lastLogTime >= 2 * 60 * 1000 || report.stops_data.length === 0) {
        const currentLocStr = (latitude !== undefined && longitude !== undefined)
          ? `📍 (GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)})`
          : '🛰️ GPS Lock Pending';

        report.stops_data.push({
          id: `log-${now}`,
          name: `Telemetry Log - ${currentLocStr}`,
          duration: `Speed: ${numericSpeed} km/h`,
          battery: battery !== undefined ? `${battery}%` : '85%',
          time: timeStr
        });
        report.stops_count = report.stops_data.length;
        report.lastLoggedTimestamp = now;
      }
    },
    recordDeviceOfflineInReport: (state, action) => {
      const { childId, lastLocation } = action.payload;
      if (!childId || !lastLocation) return;

      const report = state.reports[childId];
      if (report) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const alreadyOffline = report.stops_data.some(s => s.name.includes('Offline'));
        if (!alreadyOffline) {
          report.stops_data.push({
            id: `offline-${Date.now()}`,
            name: `🔴 Last Known Location (Device Offline / Powered Off)`,
            duration: 'Continuous / Offline',
            battery: '0%',
            time: `${timeStr} (GPS: ${lastLocation.latitude.toFixed(4)}, ${lastLocation.longitude.toFixed(4)})`
          });
          report.stops_count += 1;
        }
      }
    },
    recordSosTriggerInReport: (state, action) => {
      const { childId, time, message } = action.payload;
      const report = state.reports[childId];
      if (report) {
        const timeStr = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        report.stops_data.push({
          id: `sos-${Date.now()}`,
          name: `🚨 EMERGENCY SOS ALERT: ${message || 'SOS Triggered'}`,
          duration: 'SOS Active',
          battery: report.stops_data[report.stops_data.length - 1]?.battery || '100%',
          time: timeStr
        });
        report.stops_count = report.stops_data.length;
      }
    },
    recordGeofenceEventInReport: (state, action) => {
      const { childId, zoneName, action: direction, time } = action.payload;
      const report = state.reports[childId];
      if (report) {
        const timeStr = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        report.stops_data.push({
          id: `geofence-${Date.now()}`,
          name: `⚠️ GEOFENCE VIOLATION: ${direction === 'exit' ? 'Exited' : 'Entered'} Safe Zone (${zoneName})`,
          duration: direction === 'exit' ? 'Outside Zone' : 'Inside Zone',
          battery: report.stops_data[report.stops_data.length - 1]?.battery || '100%',
          time: timeStr
        });
        report.stops_count = report.stops_data.length;
      }
    },
    recordOverspeedEventInReport: (state, action) => {
      const { childId, speed, threshold, time } = action.payload;
      const report = state.reports[childId];
      if (report) {
        const timeStr = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const lastEntry = report.stops_data[report.stops_data.length - 1];
        if (lastEntry && lastEntry.name.includes('OVERSPEED')) return;

        report.stops_data.push({
          id: `overspeed-${Date.now()}`,
          name: `⚠️ OVERSPEED WARNING: Speed of ${speed} km/h exceeded limit of ${threshold} km/h`,
          duration: 'Overspeeding',
          battery: lastEntry?.battery || '100%',
          time: timeStr
        });
        report.stops_count = report.stops_data.length;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDailyReport.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDailyReport.fulfilled, (state, action) => {
        state.loading = false;
        const { childId } = action.meta.arg;
        if (action.payload) {
          const existingReport = state.reports[childId];
          const newReport = { ...action.payload };
          
          // Preserve lastLoggedTimestamp from existing live session if available
          // so that updateLiveReportData continues to append 2-min interval logs
          if (existingReport && existingReport.lastLoggedTimestamp) {
            newReport.lastLoggedTimestamp = existingReport.lastLoggedTimestamp;
          } else if (newReport.stops_data && newReport.stops_data.length > 0) {
            // Set lastLoggedTimestamp from the last stop entry ID (which contains the timestamp)
            const lastStop = newReport.stops_data[newReport.stops_data.length - 1];
            if (lastStop.id && lastStop.id.startsWith('log-')) {
              newReport.lastLoggedTimestamp = parseInt(lastStop.id.replace('log-', ''), 10);
            } else {
              newReport.lastLoggedTimestamp = Date.now();
            }
          }
          
          state.reports[childId] = newReport;
        }
      })
      .addCase(fetchDailyReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { setSelectedDate, updateLiveReportData, loadPersistedReports, recordDeviceOfflineInReport, recordSosTriggerInReport, recordGeofenceEventInReport, recordOverspeedEventInReport } = reportSlice.actions;
export default reportSlice.reducer;
