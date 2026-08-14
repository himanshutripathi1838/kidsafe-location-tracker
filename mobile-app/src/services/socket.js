import io from 'socket.io-client';
import store from '../redux/store';
import { updateLiveLocation, setDeviceOffline, setSocketConnected, setMqttServerOnline } from '../redux/slices/locationSlice';
import { updateLiveReportData, recordSosTriggerInReport, recordGeofenceEventInReport, recordOverspeedEventInReport } from '../redux/slices/reportSlice';
import { receiveRemoteSosAlert } from '../redux/slices/sosSlice';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = 'http://10.124.150.60:5000';

class SocketService {
  socket = null;

  persistReports() {
    try {
      const currentReports = store.getState().report.reports;
      AsyncStorage.setItem('saved_daily_reports', JSON.stringify(currentReports));
    } catch (e) {
      console.log('Error saving reports to AsyncStorage:', e.message);
    }
  }

  connect() {
    if (this.socket) return;

    this.socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('SocketConnected to server:', SOCKET_URL);
      store.dispatch(setSocketConnected(true));
      if (this.currentChildId) {
        this.socket.emit('subscribe', { childId: this.currentChildId });
        console.log(`Socket: Re-emitted subscribe on connect for child: ${this.currentChildId}`);
      }
    });

    this.socket.on('connect_error', (err) => {
      console.log('⚠️ Socket Connection Error to:', SOCKET_URL, '| Reason:', err.message);
    });

    this.socket.on('disconnect', () => {
      console.log('SocketDisconnected from server');
      store.dispatch(setSocketConnected(false));
    });

    // Listen for live tracker updates from the backend MQTT service
    this.socket.on('tracker-update', (data) => {
      console.log('Socket: Received tracker-update:', data);
      
      const previousState = store.getState().location.liveLocations[data.childId];

      store.dispatch(updateLiveLocation({
        childId: data.childId,
        imei: data.imei,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        speed: parseFloat(data.speed),
        battery: parseInt(data.battery, 10),
        network: `${data.signal || 10} GSM`, // Use signal value to display GSM signal strength
        satellites: parseInt(data.satellites, 10),
        course: parseFloat(data.course),
        countryCode: parseInt(data.countryCode, 10),
        operatorCode: parseInt(data.operatorCode, 10),
        lac: parseInt(data.lac, 10),
        cellId: parseInt(data.cellId, 10),
        configMode: parseInt(data.configMode, 10),
        status: data.status, // online / offline status
        timestamp: data.timestamp
      }));

      store.dispatch(updateLiveReportData({
        childId: data.childId,
        imei: data.imei,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        speed: parseFloat(data.speed),
        battery: parseInt(data.battery, 10),
        timestamp: data.timestamp
      }));

      // Check for overspeed and record in daily report
      const childProfile = store.getState().child.children.find(c => c.id === data.childId) || { speed_threshold: 20 };
      if (data.speed !== undefined && parseFloat(data.speed) > childProfile.speed_threshold) {
        store.dispatch(recordOverspeedEventInReport({
          childId: data.childId,
          speed: parseFloat(data.speed),
          threshold: childProfile.speed_threshold
        }));
      }

      // Generate local alerts for Low Battery
      if (data.battery !== undefined && data.battery < 20) {
        const lastAlert = this.lastBatteryAlerts?.[data.childId] || 0;
        const now = Date.now();
        if (now - lastAlert > 15 * 60 * 1000) { // debounce 15 mins
          if (!this.lastBatteryAlerts) this.lastBatteryAlerts = {};
          this.lastBatteryAlerts[data.childId] = now;
          
          Notifications.scheduleNotificationAsync({
            content: {
              title: data.battery < 10 ? "🚨 CRITICAL BATTERY ALERT" : "⚠️ LOW BATTERY WARNING",
              body: `GPS Tracker battery is low at ${data.battery}%. Please connect to charger.`,
              sound: 'default',
            },
            trigger: null,
          });
        }
      }

      // Generate local alerts for Full Battery (100%)
      if (data.battery !== undefined && data.battery === 100) {
        const lastFullAlert = this.lastFullBatteryAlerts?.[data.childId] || 0;
        const now = Date.now();
        if (now - lastFullAlert > 15 * 60 * 1000) { // debounce 15 mins
          if (!this.lastFullBatteryAlerts) this.lastFullBatteryAlerts = {};
          this.lastFullBatteryAlerts[data.childId] = now;
          
          Notifications.scheduleNotificationAsync({
            content: {
              title: "🔋 BATTERY FULLY CHARGED",
              body: `GPS Tracker battery is 100% full. You can unplug the charger now.`,
              sound: 'default',
            },
            trigger: null,
          });
        }
      }

      // Generate local alerts for GPS Signal Lost
      if (data.satellites !== undefined && data.satellites === 0) {
        const lastGpsAlert = this.lastGpsAlerts?.[data.childId] || 0;
        const now = Date.now();
        if (now - lastGpsAlert > 10 * 60 * 1000) { // debounce 10 mins
          if (!this.lastGpsAlerts) this.lastGpsAlerts = {};
          this.lastGpsAlerts[data.childId] = now;

          Notifications.scheduleNotificationAsync({
            content: {
              title: "⚠️ GPS SIGNAL FIX LOST",
              body: `GPS Tracker lost satellite connection. Live mapping coordinates may be degraded.`,
              sound: 'default',
            },
            trigger: null,
          });
        }
      }

      // Generate local alerts for Device Online Again
      if (previousState && previousState.deviceStatus === 'offline' && data.status === 'online') {
        Notifications.scheduleNotificationAsync({
          content: {
            title: "🟢 TRACKER ONLINE AGAIN",
            body: `GPS Tracker for student has reconnected and is transmitting live data.`,
            sound: 'default',
          },
          trigger: null,
        });
        this.persistReports();
      }
    });

    // Listen for tracker going offline (no data for 30s)
    this.socket.on('tracker-offline', (data) => {
      console.log('Socket: Received tracker-offline:', data);
      store.dispatch(setDeviceOffline({ childId: data.childId }));
      
      Notifications.scheduleNotificationAsync({
        content: {
          title: "⚠️ TRACKER OFFLINE ALERT",
          body: `GPS Tracker for student ${data.childName || 'Child'} went offline (no signal received for 30s).`,
          sound: 'default',
        },
        trigger: null,
      });

      Alert.alert(
        '⚠️ Tracker Offline',
        `GPS Tracker has disconnected (no telemetry received for 30 seconds).`
      );
    });

    // Listen for incoming Emergency SOS alerts
    this.socket.on('sos_alert', (data) => {
      console.log('Socket: Received SOS alert:', data);
      store.dispatch(receiveRemoteSosAlert(data));
      store.dispatch(recordSosTriggerInReport({
        childId: data.childId,
        message: data.message || 'SOS Button Pressed'
      }));
      this.persistReports();
    });

    // Listen for Geofence violation broadcasts
    this.socket.on('geofence_alert', (data) => {
      console.log('Socket: Received Geofence alert:', data);
      Alert.alert(
        '⚠️ GEOFENCE WARNING',
        `${data.childName} has ${data.action} safety zone: ${data.zoneName}.`
      );
      store.dispatch(recordGeofenceEventInReport({
        childId: data.childId,
        zoneName: data.zoneName,
        action: data.action
      }));
      this.persistReports();
    });

    // Listen for MQTT broker status updates from the backend
    this.socket.on('mqtt-server-status', (data) => {
      console.log('Socket: Received mqtt-server-status:', data);
      store.dispatch(setMqttServerOnline(data.status === 'online'));
    });
  }

  // Subscribe to specific child channels
  subscribe(childId) {
    if (!this.socket) this.connect();
    
    // Unsubscribe from any previously active child channel first to avoid duplicates
    if (this.currentChildId && this.currentChildId !== childId) {
      this.unsubscribe(this.currentChildId);
    }
    
    this.currentChildId = childId;
    this.socket.emit('subscribe', { childId });
    console.log(`Socket: Subscribed to child channel: ${childId}`);
  }

  // Unsubscribe from child channels
  unsubscribe(childId) {
    if (this.socket) {
      this.socket.emit('unsubscribe', { childId });
      if (this.currentChildId === childId) {
        this.currentChildId = null;
      }
      console.log(`Socket: Unsubscribed from child channel: ${childId}`);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

const socketInstance = new SocketService();
export default socketInstance;
