const { AlertLog, Child, EmergencyContact } = require('../models');
const { sendAlertSMS } = require('../services/smsService');
const { sendMulticastPush } = require('../services/pushService');
const { triggerEmergencyCall } = require('../services/voiceService');

let ioInstance = null;
exports.setIO = (io) => {
  ioInstance = io;
};

exports.triggerSOS = async (req, res) => {
  try {
    const { childId, latitude, longitude, speed, battery } = req.body;
    if (!childId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'Child ID and trigger coordinates are required.' });
    }

    const child = await Child.findByPk(childId);
    if (!child) {
      return res.status(404).json({ success: false, message: 'Child profile not found.' });
    }

    // 1. Log active SOS Alert
    const alert = await AlertLog.create({
      child_id: childId,
      type: 'sos',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      speed: parseFloat(speed) || 0.0,
      battery: parseInt(battery, 10) || 100,
      status: 'triggered',
      timestamp: new Date()
    });

    // 2. Fetch all emergency contacts (Max 10)
    const contacts = await EmergencyContact.findAll({
      where: { child_id: childId, is_active: true }
    });

    // 3. Separate Primary (2 numbers) and Secondary contacts
    const primaryContacts = contacts
      .filter(c => c.is_primary)
      .sort((a, b) => a.call_priority - b.call_priority);
    
    // 4. Dispatch Push notifications to ALL contacts with FCM tokens
    const fcmTokens = contacts.map(c => c.fcm_token).filter(t => t);
    if (fcmTokens.length > 0) {
      await sendMulticastPush(
        fcmTokens,
        `🚨 EMERGENCY SOS: ${child.name}`,
        `${child.name} has triggered a distress SOS alarm. Check location immediately!`,
        {
          childId: child.id,
          alertId: alert.id,
          type: 'sos',
          latitude: latitude.toString(),
          longitude: longitude.toString()
        }
      );
    }

    // 5. Dispatch SMS with live map link to ALL contacts
    for (const c of contacts) {
      if (c.alert_sos) {
        await sendAlertSMS({
          to: c.phone,
          lang: c.language,
          type: 'sos',
          childName: child.name,
          data: { latitude, longitude }
        });
      }
    }

    // 6. Voice Call Dispatch to Top 2 Primary Contacts
    for (const c of primaryContacts.slice(0, 2)) {
      // Fires asynchronously so calls are placed concurrently
      triggerEmergencyCall(c.phone, child.name, c.language)
        .catch(err => console.error(`Failed emergency call to ${c.phone}:`, err.message));
    }

    // 7. WebSocket Live Dispatch
    if (ioInstance) {
      ioInstance.to(`child_${childId}`).emit('sos_alert', {
        id: alert.id,
        child_id: child.id,
        child_name: child.name,
        latitude: alert.latitude,
        longitude: alert.longitude,
        speed: alert.speed,
        battery: alert.battery,
        timestamp: alert.timestamp,
        status: 'triggered'
      });
    }

    return res.status(201).json({ success: true, message: 'Emergency SOS alert dispatched successfully.', alertId: alert.id });
  } catch (error) {
    console.error('Trigger SOS Controller Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process SOS alert.' });
  }
};

exports.resolveSOS = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({ success: false, message: 'Resolution notes are mandatory.' });
    }

    const alert = await AlertLog.findByPk(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'SOS Alert record not found.' });
    }

    alert.status = 'resolved';
    alert.resolved_notes = notes;
    alert.resolved_at = new Date();
    await alert.save();

    return res.status(200).json({ success: true, message: 'Emergency alert resolved and closed.', alert });
  } catch (error) {
    console.error('Resolve SOS Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to resolve emergency alert.' });
  }
};

exports.getSOSHistory = async (req, res) => {
  try {
    const { childId } = req.params;
    const history = await AlertLog.findAll({
      where: {
        child_id: childId,
        type: 'sos'
      },
      order: [['timestamp', 'DESC']]
    });

    return res.status(200).json({ success: true, history });
  } catch (error) {
    console.error('SOS History Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve SOS logs.' });
  }
};
