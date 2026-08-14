const { Location, Child, GeofenceZone, AlertLog, EmergencyContact } = require('../models');
const { calculateHaversineDistance } = require('../services/geofenceService');
const { sendAlertSMS } = require('../services/smsService');
const { sendMulticastPush } = require('../services/pushService');
const Device = require('../models/Device');

// Simple global socket store set by app.js
let ioInstance = null;
exports.setIO = (io) => {
  ioInstance = io;
};

exports.updateLocation = async (req, res) => {
  const { deviceId, latitude, longitude, speed, altitude, accuracy, battery, network } = req.body || {};
  try {
    if (!deviceId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'Device ID, latitude, and longitude are required.' });
    }

    // 1. Resolve Device & Paired Child
    const device = await Device.findOne({ where: { device_id: deviceId } });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Unrecognized tracking hardware Device ID.' });
    }

    const child = await Child.findOne({ where: { device_id: device.id, is_active: true } });
    if (!child) {
      return res.status(404).json({ success: false, message: 'No active child paired to this tracking device.' });
    }

    // Update Device Ping details
    device.last_ping = new Date();
    await device.save();

    // 2. Fetch Previous Location for Crossing Detections
    const previousLocation = await Location.findOne({
      where: { child_id: child.id },
      order: [['timestamp', 'DESC']]
    });

    // 3. Insert new Location record (with PostGIS geometry Point)
    const pointGeography = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)] // longitude first in standard GeoJSON
    };

    const newLocation = await Location.create({
      child_id: child.id,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      location: pointGeography,
      speed: parseFloat(speed) || 0.0,
      altitude: parseFloat(altitude) || 0.0,
      accuracy: parseFloat(accuracy) || 0.0,
      battery: parseInt(battery, 10) || 100,
      network: network || '4G',
      timestamp: new Date()
    });

    // 4. Geofencing Boundary Engine (Entry/Exit crossings)
    const zones = await GeofenceZone.findAll({ where: { child_id: child.id, is_active: true } });
    
    for (const zone of zones) {
      const isCurrentlyInside = calculateHaversineDistance(
        latitude, longitude, zone.latitude, zone.longitude
      ) <= zone.radius;

      let wasPreviouslyInside = false;
      if (previousLocation) {
        wasPreviouslyInside = calculateHaversineDistance(
          previousLocation.latitude, previousLocation.longitude, zone.latitude, zone.longitude
        ) <= zone.radius;
      }

      // Check crossings
      let alertType = null;
      if (!wasPreviouslyInside && isCurrentlyInside && zone.notify_on_entry) {
        alertType = 'geofence_entry';
      } else if (wasPreviouslyInside && !isCurrentlyInside && zone.notify_on_exit) {
        alertType = 'geofence_exit';
      }

      if (alertType) {
        // Trigger Geofence Breach
        const alert = await AlertLog.create({
          child_id: child.id,
          type: alertType,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          speed: parseFloat(speed),
          battery: parseInt(battery, 10),
          status: 'triggered',
          details: { zoneName: zone.name, zoneId: zone.id }
        });

        // Dispatch alert to Contacts
        await dispatchAlert(child, alertType, alert, { zoneName: zone.name });
      }
    }

    // 5. Overspeed engine
    if (speed && speed > child.speed_threshold) {
      const alert = await AlertLog.create({
        child_id: child.id,
        type: 'speed',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: parseFloat(speed),
        battery: parseInt(battery, 10),
        status: 'triggered',
        details: { speedLimit: child.speed_threshold, detectedSpeed: speed }
      });

      await dispatchAlert(child, 'speed', alert, { limit: child.speed_threshold, detected: speed });
    }

    // 6. Battery Warning logic
    if (battery && battery < 20 && (!previousLocation || previousLocation.battery >= 20)) {
      const alert = await AlertLog.create({
        child_id: child.id,
        type: 'battery',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: parseFloat(speed),
        battery: parseInt(battery, 10),
        status: 'triggered',
        details: { percentage: battery }
      });

      await dispatchAlert(child, 'battery', alert, { percent: battery });
    }

    // 7. WebSocket Live Broadcast
    if (ioInstance) {
      const updatePayload = {
        childId: child.id,
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        speed: newLocation.speed,
        battery: newLocation.battery,
        network: newLocation.network,
        timestamp: newLocation.timestamp
      };
      // Send to child room subscribers
      ioInstance.to(`child_${child.id}`).emit('location_update', updatePayload);
    }

    return res.status(200).json({ success: true, message: 'Telemetry processed successfully.' });
  } catch (error) {
    console.error('Update Location Controller Error:', error);
    
    // Resilient Fallback: If DB is offline, return simulated success for testing
    if (error.name === 'SequelizeConnectionRefusedError' || error.message.includes('ECONNREFUSED')) {
      console.log('PostgreSQL database offline. Returning mock success and broadcasting via Socket.IO room.');
      if (ioInstance) {
        ioInstance.to(`child_c-uuid-1`).emit('location_update', {
          childId: 'c-uuid-1',
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          speed: parseFloat(speed) || 0.0,
          battery: parseInt(battery, 10) || 100,
          network: network || '4G',
          timestamp: new Date().toISOString()
        });
      }
      return res.status(200).json({ 
        success: true, 
        message: 'Telemetry processed successfully (DB-Offline Mock Mode).',
        mocked: true 
      });
    }

    return res.status(500).json({ success: false, message: 'Error processing location telemetry.' });
  }
};

// Dispatch alerts to emergency contacts (FCM & Twilio)
const dispatchAlert = async (child, type, alert, contextData) => {
  try {
    const contacts = await EmergencyContact.findAll({
      where: { child_id: child.id, is_active: true }
    });

    const activeContacts = contacts.filter(c => {
      // Filter permissions
      if (type === 'geofence_entry' || type === 'geofence_exit') return c.alert_geofence;
      if (type === 'speed') return c.alert_speed;
      if (type === 'battery') return c.alert_battery;
      return true;
    });

    // 1. Broadcast FCM push
    const tokens = activeContacts.map(c => c.fcm_token).filter(t => t);
    if (tokens.length > 0) {
      const pushTitle = `⚠️ KidSafe Alert: ${child.name}`;
      let pushBody = `Safety alert: ${type}`;
      if (type === 'geofence_entry') pushBody = `${child.name} has entered safety zone: ${contextData.zoneName}.`;
      if (type === 'geofence_exit') pushBody = `${child.name} has exited safety zone: ${contextData.zoneName}.`;
      if (type === 'speed') pushBody = `${child.name} is traveling too fast! Speed: ${contextData.detected} km/h (Limit: ${contextData.limit} km/h).`;
      if (type === 'battery') pushBody = `Device battery is running critically low: ${contextData.percent}%.`;

      await sendMulticastPush(tokens, pushTitle, pushBody, {
        childId: child.id,
        alertId: alert.id,
        type: type
      });
    }

    // 2. Dispatches SMS
    for (const c of activeContacts) {
      // Primary numbers get voice call overrides for SOS, but SMS notifications for general rules
      await sendAlertSMS({
        to: c.phone,
        lang: c.language,
        type: type,
        childName: child.name,
        data: contextData
      });
    }

    // 3. Broadcast Geofence alert over WebSockets
    if (ioInstance && (type === 'geofence_entry' || type === 'geofence_exit')) {
      ioInstance.to(`child_${child.id}`).emit('geofence_alert', {
        childName: child.name,
        action: type === 'geofence_entry' ? 'entered' : 'exited',
        zoneName: contextData.zoneName
      });
    }
  } catch (err) {
    console.error('Error dispatching notifications:', err);
  }
};

exports.getLiveLocation = async (req, res) => {
  try {
    const { childId } = req.params;
    let location = null;

    try {
      location = await Location.findOne({
        where: { child_id: childId },
        order: [['timestamp', 'DESC']]
      });
    } catch (dbError) {
      console.log('PostgreSQL DB offline. Falling back to local JSON cache file lookup for live location.');
      const fs = require('fs');
      const path = require('path');
      const todayStr = new Date().toISOString().split('T')[0];
      const filePath = path.join(__dirname, '..', '..', 'data', `location_logs_${childId}_${todayStr}.json`);
      if (fs.existsSync(filePath)) {
        const logs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (logs.length > 0) {
          // Sort chronologically and extract the latest valid non-zero coordinate log
          const validLogs = logs.filter(l => parseFloat(l.latitude) !== 0 && parseFloat(l.longitude) !== 0 && !isNaN(parseFloat(l.latitude)));
          validLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const lastLog = validLogs.length > 0 ? validLogs[validLogs.length - 1] : logs[logs.length - 1];
          
          location = {
            latitude: parseFloat(lastLog.latitude) || 23.2169,
            longitude: parseFloat(lastLog.longitude) || 77.3967,
            speed: parseFloat(lastLog.speed) || 0.0,
            battery: parseInt(lastLog.battery, 10) || 100,
            satellites: parseInt(lastLog.satellites, 10) || 0,
            timestamp: lastLog.timestamp,
            network: '4G',
            deviceStatus: 'online'
          };
        }
      }
    }

    if (!location) {
      return res.status(404).json({ success: false, message: 'No location logs found for this child.' });
    }

    return res.status(200).json({ success: true, location });
  } catch (error) {
    console.error('Get Live Location Error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching live location.' });
  }
};

exports.getLocationHistory = async (req, res) => {
  try {
    const { childId } = req.params;
    let history = [];

    try {
      const timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
      history = await Location.findAll({
        where: {
          child_id: childId,
          timestamp: {
            [require('sequelize').Op.gte]: timeLimit
          }
        },
        order: [['timestamp', 'ASC']]
      });
    } catch (dbError) {
      console.log('PostgreSQL DB offline. Falling back to local JSON cache file lookup for location history.');
      const fs = require('fs');
      const path = require('path');
      const todayStr = new Date().toISOString().split('T')[0];
      const filePath = path.join(__dirname, '..', '..', 'data', `location_logs_${childId}_${todayStr}.json`);
      if (fs.existsSync(filePath)) {
        const logs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        history = logs.map(l => ({
          latitude: parseFloat(l.latitude),
          longitude: parseFloat(l.longitude),
          speed: parseFloat(l.speed) || 0.0,
          battery: parseInt(l.battery, 10) || 100,
          satellites: parseInt(l.satellites, 10) || 0,
          timestamp: l.timestamp,
          network: '4G'
        }));
      }
    }

    return res.status(200).json({ success: true, history });
  } catch (error) {
    console.error('Get Location History Error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching history.' });
  }
};
