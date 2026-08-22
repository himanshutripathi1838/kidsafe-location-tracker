const mqtt = require('mqtt');
const logger = require('../config/logger');
const { parseTrackerMessage } = require('../utils/mqttParser');

// Import models
const Tracker = require('../models/Tracker');
const LiveLocation = require('../models/LiveLocation');
const LocationHistory = require('../models/LocationHistory');
const Child = require('../models/Child');
const GeofenceZone = require('../models/GeofenceZone');
const EmergencyContact = require('../models/EmergencyContact');
const AlertLog = require('../models/AlertLog');

const geofenceService = require('./geofenceService');
const pushService = require('./pushService');
const smsService = require('./smsService');

let client = null;
let ioInstance = null;
const lastKnownCoordinates = {};
const lastChildTelemetryAt = {};
const offlineNotifiedChildren = {};
let isMqttConnected = false;

const brokerUrl = 'mqtt://103.73.191.240:1883';
const mqttOptions = {
  keepalive: 60,
  clientId: `kidsafe_backend_${Math.random().toString(16).substr(2, 8)}`,
  clean: true,
  connectTimeout: 30 * 1000,
  reconnectPeriod: 5000, // Try to reconnect every 5s
  username: 'roshan',
  password: 'roshan1',
};

/**
 * Set the Socket.IO instance for real-time notifications.
 */
function setIO(io) {
  ioInstance = io;
}

/**
 * Establishes connection to the MQTT Broker and listens to tracker topics.
 */
function initializeMQTT() {
  logger.info(`Connecting to MQTT Broker: ${brokerUrl}`);
  client = mqtt.connect(brokerUrl, mqttOptions);

  client.on('connect', async () => {
    logger.info('Successfully connected to MQTT Broker!');
    isMqttConnected = true;
    broadcastMqttStatus('online');
    
    // Subscribe to all tracker topics (e.g. tracking/imei or just imei topics).
    // The prompt specifies topic format is IMEI number (e.g. 866262031290033).
    // We subscribe to all topics match IMEI by wildcards.
    // However, since MQTT wildcards can capture everything, we subscribe to a wildcard '#'.
    // Or we subscribe to specific active tracker IMEIs from database.
    // The safest and most dynamic way is subscribing to wildcard '#'. Since it's a dedicated broker,
    // we can filter valid IMEI topics in the message handler.
    client.subscribe('#', (err) => {
      if (err) {
        logger.error('Failed to subscribe to MQTT wildcard topic:', err);
      } else {
        logger.info('Subscribed to MQTT wildcard topic (#) successfully.');
      }
    });
  });

  client.on('message', async (topic, message) => {
    try {
      // Validate that topic name looks like a standard IMEI number (15 digits)
      const imeiRegex = /^[0-9]{15}$/;
      if (!imeiRegex.test(topic)) {
        return;
      }

      const rawPayload = message.toString();
      logger.info(`Received telemetry on topic [${topic}]: ${rawPayload}`);

      // 1. Resolve Tracker and child association (with DB-offline fallback)
      let childId = 'c-uuid-1'; // Default fallback for development testing
      let trackerId = 'mock-tracker-id';
      let isDbConnected = true;

      try {
        let tracker = await Tracker.findOne({ where: { imei: topic } });
        if (!tracker) {
          const firstChild = await Child.findOne({ where: { is_active: true } });
          tracker = await Tracker.create({
            imei: topic,
            status: 'online',
            childId: firstChild ? firstChild.id : 'c-uuid-1',
            lastSeen: new Date()
          });
          logger.info(`Auto-created new GPS tracker. IMEI: ${topic} | Auto-paired: ${firstChild ? firstChild.name : 'c-uuid-1'}`);
        } else if (!tracker.childId) {
          const firstChild = await Child.findOne({ where: { is_active: true } });
          if (firstChild) {
            tracker.childId = firstChild.id;
            await tracker.save();
            logger.info(`Auto-paired unassigned tracker ${topic} with child ${firstChild.name}`);
          }
        }
        childId = tracker.childId || 'c-uuid-1';
        trackerId = tracker.id;
      } catch (dbErr) {
        isDbConnected = false;
        logger.warn(`PostgreSQL Database offline. Falling back to in-memory telemetry stream: ${dbErr.message}`);
        
        // Resolve using static fallback map when DB is offline
        const offlineChildMapping = {
          '866262031290033': 'c-uuid-1', // Aarav Singh
          '864369034877211': 'c-uuid-1', // Aarav Singh (New IMEI)
          'dev-aarav-101': 'c-uuid-1',
          '866506050605814': 'c-uuid-2', // Diya Singh
          'dev-diya-202': 'c-uuid-2'
        };
        childId = offlineChildMapping[topic] || null;
        trackerId = topic;
      }

      if (!childId) {
        // Ignore unmapped random devices on public broker to prevent location jumping
        return;
      }

      // 2. Parse telemetry string
      const parsed = parseTrackerMessage(rawPayload, trackerId);

      // If coordinates are valid, update last known coordinates cache
      if (parsed.hasGpsFix) {
        lastKnownCoordinates[childId] = {
          latitude: parsed.latitude,
          longitude: parsed.longitude
        };
      } else {
        // Fallback to cache first, otherwise check if DB has last live location, otherwise standard default Bhopal coordinates
        let lastLat = 23.2334;
        let lastLng = 77.4011;
        if (lastKnownCoordinates[childId]) {
          lastLat = lastKnownCoordinates[childId].latitude;
          lastLng = lastKnownCoordinates[childId].longitude;
        } else if (isDbConnected) {
          try {
            const dbLoc = await LiveLocation.findOne({ where: { trackerId } });
            if (dbLoc && dbLoc.latitude !== 0) {
              lastLat = dbLoc.latitude;
              lastLng = dbLoc.longitude;
            }
          } catch (e) {
            // ignore
          }
        }
        parsed.latitude = lastLat;
        parsed.longitude = lastLng;
        logger.info(`Telemetry has no GPS lock (0.0, 0.0). Retaining last known position: ${lastLat}, ${lastLng}`);
      }

      // Save to local JSON history file (for offline/mobile closed persistence)
      try {
        const fs = require('fs');
        const path = require('path');
        const dataDir = path.join(__dirname, '..', '..', 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const dateStr = new Date(parsed.timestamp).toISOString().split('T')[0];
        const filePath = path.join(dataDir, `location_logs_${childId}_${dateStr}.json`);
        
        let logs = [];
        if (fs.existsSync(filePath)) {
          try {
            logs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          } catch (e) {
            logs = [];
          }
        }
        
        logs.push({
          imei: topic,
          trackerId,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          speed: parsed.speed,
          battery: parsed.battery,
          signal: parsed.signal,
          satellites: parsed.satellites,
          course: parsed.course,
          countryCode: parsed.countryCode,
          operatorCode: parsed.operatorCode,
          lac: parsed.lac,
          cellId: parsed.cellId,
          configMode: parsed.configMode,
          network: `${parsed.signal} GSM`,
          hasGpsFix: parsed.hasGpsFix,
          timestamp: parsed.timestamp
        });
        
        fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf8');
      } catch (fileErr) {
        logger.error(`Failed to write local telemetry logs cache: ${fileErr.message}`);
      }

      if (isDbConnected) {
        try {
          // Save previous location state before updating
          const prevLiveLoc = await LiveLocation.findOne({ where: { trackerId } });

          // Compare incoming timestamp with previous stored live location timestamp
          let isNewTelemetry = true;
          if (prevLiveLoc && prevLiveLoc.timestamp) {
            const incomingTime = new Date(parsed.timestamp).getTime();
            const existingTime = new Date(prevLiveLoc.timestamp).getTime();
            if (incomingTime <= existingTime) {
              isNewTelemetry = false;
              logger.info(`MQTT Ingestion: Received older/duplicate telemetry packet. Skipping live DB update.`);
            }
          }

          if (isNewTelemetry) {
            const [liveLoc, created] = await LiveLocation.findOrCreate({
              where: { trackerId },
              defaults: parsed
            });
            if (!created) {
              await liveLoc.update(parsed);
            }

            // Only insert into history database if device has a valid GPS fix
            if (parsed.hasGpsFix) {
              await LocationHistory.create({
                trackerId,
                latitude: parsed.latitude,
                longitude: parsed.longitude,
                speed: parsed.speed,
                battery: parsed.battery,
                timestamp: parsed.timestamp
              });
            }

            // Update tracker status and lastSeen
            const trackerObj = await Tracker.findByPk(trackerId);
            if (trackerObj) {
              trackerObj.status = 'online';
              trackerObj.lastSeen = parsed.timestamp;
              await trackerObj.save();
            }

            // Geofence violation checking - only run if device has a valid GPS fix
            if (childId && parsed.hasGpsFix) {
              await checkGeofenceExits(childId, parsed, prevLiveLoc);
            }
          }
        } catch (dbUpdateErr) {
          logger.error(`Failed to update database entries: ${dbUpdateErr.message}`);
        }
      }

      // 3. ALWAYS emit live location over Socket.IO (even if DB is offline!)
      if (ioInstance && childId) {
        const socketRoom = `child_${childId}`;
        lastChildTelemetryAt[childId] = Date.now();
        offlineNotifiedChildren[childId] = false;
        const updatePayload = {
          trackerId,
          childId,
          imei: topic,
          latitude: parseFloat(parsed.latitude),
          longitude: parseFloat(parsed.longitude),
          speed: parseFloat(parsed.speed),
          battery: parseInt(parsed.battery, 10),
          signal: parseInt(parsed.signal, 10),
          satellites: parseInt(parsed.satellites, 10),
          course: parseFloat(parsed.course),
          countryCode: parseInt(parsed.countryCode, 10),
          operatorCode: parseInt(parsed.operatorCode, 10),
          lac: parseInt(parsed.lac, 10),
          cellId: parseInt(parsed.cellId, 10),
          configMode: parseInt(parsed.configMode, 10),
          status: 'online',
          timestamp: parsed.timestamp.toISOString()
        };

        ioInstance.to(socketRoom).emit('tracker-update', updatePayload);
        ioInstance.emit('tracker-update', updatePayload);
        logger.info(`Dispatched tracker-update stream to Socket.IO room [${socketRoom}] and global channel.`);
      }

    } catch (err) {
      logger.error('Error processing MQTT telemetry payload:', err);
    }
  });

  client.on('reconnect', () => {
    logger.warn('MQTT Connection lost. Reconnecting to broker...');
    broadcastMqttStatus('offline');
  });

  client.on('close', () => {
    logger.warn('MQTT Connection closed by broker.');
    broadcastMqttStatus('offline');
  });

  client.on('error', (err) => {
    logger.error('MQTT Client connection error:', err);
    broadcastMqttStatus('offline');
  });

  client.on('offline', () => {
    logger.warn('MQTT client is offline.');
    broadcastMqttStatus('offline');
  });
}

function broadcastMqttStatus(status) {
  isMqttConnected = (status === 'online');
  if (ioInstance) {
    ioInstance.emit('mqtt-server-status', { status });
    logger.info(`Broadcasted MQTT connection status to clients: ${status}`);
  }
}

/**
 * Checks safety circular zones. Triggers notifications on geofence exits.
 */
async function checkGeofenceExits(childId, currentLoc, prevLoc) {
  try {
    const child = await Child.findByPrimaryKey ? await Child.findByPk(childId) : await Child.findOne({ where: { id: childId } });
    if (!child) return;

    // Fetch active geofences for this child
    const zones = await GeofenceZone.findAll({
      where: { child_id: childId, is_active: true }
    });

    for (const zone of zones) {
      // Ignore path or line corridors (only process custom circle zones here)
      if (zone.type === 'path' || zone.type === 'line') continue;

      const isCurrentlyInside = geofenceService.isInsideZone(
        { latitude: currentLoc.latitude, longitude: currentLoc.longitude },
        zone
      );

      let wasInside = true;
      if (prevLoc) {
        wasInside = geofenceService.isInsideZone(
          { latitude: prevLoc.latitude, longitude: prevLoc.longitude },
          zone
        );
      }

      // Detect transition: exit
      if (wasInside && !isCurrentlyInside) {
        logger.warn(`GEOFENCE EXIT DETECTED: Child "${child.name}" exited zone "${zone.name}"`);

        // 1. Write Alert Log to DB
        await AlertLog.create({
          child_id: childId,
          type: 'geofence',
          latitude: currentLoc.latitude,
          longitude: currentLoc.longitude,
          speed: currentLoc.speed,
          battery: currentLoc.battery,
          status: 'triggered',
          details: {
            zoneId: zone.id,
            zoneName: zone.name,
            transition: 'exit'
          }
        });

        // 2. Fetch emergency contacts to notify
        const contacts = await EmergencyContact.findAll({
          where: { child_id: childId, is_active: true }
        });

        for (const contact of contacts) {
          if (!contact.alert_geofence) continue;

          // Dispatch SMS via Twilio
          if (contact.phone) {
            try {
              await smsService.sendAlertSMS({
                to: contact.phone,
                lang: contact.language || 'english',
                type: 'geofence_exit',
                childName: child.name,
                data: { zoneName: zone.name }
              });
            } catch (smsErr) {
              logger.error(`Failed to send Geofence Exit SMS to ${contact.phone}:`, smsErr);
            }
          }

          // Dispatch Push Notification via FCM
          if (contact.fcm_token) {
            try {
              await pushService.sendPush(
                contact.fcm_token,
                `🚨 Safety Alert: Geofence Exit`,
                `${child.name} has exited the safety zone: ${zone.name}`,
                {
                  childId,
                  type: 'geofence_exit',
                  zoneName: zone.name,
                  latitude: currentLoc.latitude.toString(),
                  longitude: currentLoc.longitude.toString()
                }
              );
            } catch (pushErr) {
              logger.error(`Failed to send Geofence Exit FCM push to contact ${contact.id}:`, pushErr);
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error('Error during geofence checking loop:', err);
  }
}

/**
 * Periodically checks for trackers that have not published data in 30 seconds
 * and marks them offline, notifying parents.
 */
function startOfflineDetection() {
  logger.info('Starting tracker offline detection interval daemon (every 10s)...');
  
  setInterval(async () => {
    try {
      const now = Date.now();
      for (const [childId, lastSeen] of Object.entries(lastChildTelemetryAt)) {
        if (now - lastSeen > 30 * 1000 && !offlineNotifiedChildren[childId]) {
          offlineNotifiedChildren[childId] = true;
          if (ioInstance) {
            const socketRoom = `child_${childId}`;
            ioInstance.to(socketRoom).emit('tracker-offline', {
              childId,
              status: 'offline',
              reason: 'No MQTT telemetry received for 30 seconds.',
              timestamp: new Date().toISOString()
            });
            logger.warn(`In-memory tracker timeout detected for child ${childId}. Emitted tracker-offline.`);
          }
        }
      }

      const Op = require('sequelize').Op;
      const timeoutThreshold = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      
      // Find all trackers currently online that have not sent telemetry since timeoutThreshold
      const expiredTrackers = await Tracker.findAll({
        where: {
          status: 'online',
          lastSeen: {
            [Op.lt]: timeoutThreshold
          }
        }
      });

      for (const tracker of expiredTrackers) {
        logger.warn(`Tracker timeout detected for IMEI: ${tracker.imei}. Marking status as offline.`);
        
        tracker.status = 'offline';
        await tracker.save();

        if (tracker.childId) {
          // 1. Emit tracker-offline to child room
          if (ioInstance) {
            const socketRoom = `child_${tracker.childId}`;
            ioInstance.to(socketRoom).emit('tracker-offline', {
              trackerId: tracker.id,
              childId: tracker.childId,
              imei: tracker.imei,
              status: 'offline',
              timestamp: new Date().toISOString()
            });
            logger.info(`Emitted tracker-offline to Socket.IO room: ${socketRoom}`);
          }

          // 2. Alert parent devices via FCM Push notifications
          const child = await Child.findOne({ where: { id: tracker.childId } });
          const childName = child ? child.name : 'Child';

          const contacts = await EmergencyContact.findAll({
            where: { child_id: tracker.childId, is_active: true }
          });

          for (const contact of contacts) {
            if (contact.fcm_token) {
              try {
                await pushService.sendPush(
                  contact.fcm_token,
                  `⚠️ Tracker Offline: ${childName}`,
                  `The GPS tracking device for ${childName} has gone offline (no data for 30s).`,
                  {
                    childId: tracker.childId,
                    trackerId: tracker.id,
                    type: 'tracker_offline'
                  }
                );
              } catch (pushErr) {
                logger.error(`Failed to send offline push alert to contact ${contact.id}:`, pushErr);
              }
            }
          }
        }
      }
    } catch (err) {
      logger.error('Error in tracker offline detection loop:', err);
    }
  }, 10 * 1000); // Check every 10 seconds
}

function isMQTTConnected() {
  return isMqttConnected;
}

module.exports = {
  initializeMQTT,
  setIO,
  startOfflineDetection,
  isMQTTConnected
};
