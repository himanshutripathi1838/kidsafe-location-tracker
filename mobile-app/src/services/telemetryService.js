import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';
import store from '../redux/store';
import { updateLiveLocation } from '../redux/slices/locationSlice';
import { updateLiveReportData } from '../redux/slices/reportSlice';
import { addAlertToHistory } from '../redux/slices/sosSlice';
import socketInstance from './socket';

// Helper to trigger instant local push notification
async function triggerLocalPushNotification(childName, zoneName) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🚨 GEOFENCE BREACH: ${childName}`,
        body: `${childName} has exited the safe zone "${zoneName}". Emergency SMS alerts sent to +91 70679 91838 & +91 62653 27545.`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        channelId: 'emergency-alerts',
      },
      trigger: null,
    });
  } catch (err) {
    console.log('Failed to trigger local notification:', err.message);
  }
}

// Haversine distance in km
export function calculateHaversineKm(lat1, lon1, lat2, lon2) {
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

// Distance from point P to line segment AB in meters
export function getDistanceToSegmentMeters(latP, lngP, latA, lngA, latB, lngB) {
  const xA = lngA;
  const yA = latA;
  const xB = lngB;
  const yB = latB;
  const xP = lngP;
  const yP = latP;

  const dx = xB - xA;
  const dy = yB - yA;

  if (dx === 0 && dy === 0) {
    return calculateHaversineKm(latP, lngP, latA, lngA) * 1000;
  }

  let t = ((xP - xA) * dx + (yP - yA) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t)); // Clamp to segment boundaries

  const latC = yA + t * dy;
  const lngC = xA + t * dx;

  return calculateHaversineKm(latP, lngP, latC, lngC) * 1000;
}

// Distance from point P to a multi-point road path (polyline) in meters
export function getDistanceToPathMeters(latP, lngP, pathPoints) {
  if (!pathPoints || pathPoints.length === 0) return Infinity;
  if (pathPoints.length === 1) {
    return calculateHaversineKm(latP, lngP, pathPoints[0].latitude, pathPoints[0].longitude) * 1000;
  }
  let minDistance = Infinity;
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const ptA = pathPoints[i];
    const ptB = pathPoints[i+1];
    const dist = getDistanceToSegmentMeters(
      latP, lngP,
      ptA.latitude, ptA.longitude,
      ptB.latitude, ptB.longitude
    );
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

// Deterministic speed-to-mode categorizer
export function getTransportModeBySpeed(speedKmH) {
  if (!speedKmH || speedKmH < 0.2) {
    return { mode: 'Stationary', emoji: '🛑', text: 'Stopped' };
  } else if (speedKmH <= 5.0) {
    return { mode: 'Walking', emoji: '🚶', text: 'Pedestrian Walking' };
  } else if (speedKmH <= 18.0) {
    return { mode: 'Bicycle', emoji: '🚲', text: 'Bicycle Riding' };
  } else if (speedKmH <= 50.0) {
    return { mode: 'School Bus', emoji: '🚌', text: 'School Bus Transit' };
  } else {
    return { mode: 'Vehicle', emoji: '🚗', text: 'Express Vehicle' };
  }
}

class TelemetryService {
  locationSubscription = null;
  lastPosition = null;
  lastTimestamp = null;
  activeChildId = null;

  async startRealTimeTelemetry(childId) {
    if (!childId) return;

    try {
      this.stopRealTimeTelemetry();

      // Completely delegating real-time GPS tracking to MQTT-driven Socket.IO broker updates
      console.log('TelemetryService: Subscribing to Socket.IO updates for child:', childId);
      socketInstance.subscribe(childId);
      
      this.activeChildId = childId;
    } catch (err) {
      console.error('TelemetryService: Failed to start telemetry channel:', err);
    }
  }

  stopRealTimeTelemetry() {
    if (this.activeChildId) {
      console.log('TelemetryService: Unsubscribing from Socket.IO channel:', this.activeChildId);
      socketInstance.unsubscribe(this.activeChildId);
      this.activeChildId = null;
    }
  }
}

export default new TelemetryService();
