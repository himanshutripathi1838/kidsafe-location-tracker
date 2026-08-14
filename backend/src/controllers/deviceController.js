const Device = require('../models/Device');
const Child = require('../models/Child');

exports.pairDevice = async (req, res) => {
  try {
    const { name, age, deviceId } = req.body;
    const parentId = req.user.id; // From Auth Middleware

    if (!name || !deviceId) {
      return res.status(400).json({ success: false, message: 'Child Name and Device Hardware ID are required.' });
    }

    // 1. Find or create the physical Device entry in the DB
    let device = await Device.findOne({ where: { device_id: deviceId } });
    if (!device) {
      // Auto-create hardware record to avoid blocking prototype testing
      device = await Device.create({
        device_id: deviceId,
        device_name: `${name}'s Tracker Watch`,
        owner_phone: req.user.phone,
        authorized_phone_1: req.user.phone, // Mummy/Papa
        is_locked: false,
        is_active: true
      });
    }

    // Check if device is already paired to another active child
    const alreadyPaired = await Child.findOne({ where: { device_id: device.id, is_active: true } });
    if (alreadyPaired) {
      return res.status(400).json({ success: false, message: 'This device is already paired with another child.' });
    }

    // 2. Create the child profile associated with this parent and device
    const child = await Child.create({
      parent_id: parentId,
      name,
      age: parseInt(age, 10) || null,
      device_id: device.id,
      is_active: true
    });

    return res.status(201).json({
      success: true,
      message: 'Device successfully paired and child profile created.',
      child: {
        id: child.id,
        name: child.name,
        age: child.age,
        device_id: deviceId,
        speed_threshold: child.speed_threshold
      }
    });
  } catch (error) {
    console.error('Pair Device Controller Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to pair device.' });
  }
};

exports.authorizePhone = async (req, res) => {
  try {
    const { deviceId, phone, slot } = req.body; // slot: 1 (Mummy) or 2 (Papa)
    if (!deviceId || !phone || !slot) {
      return res.status(400).json({ success: false, message: 'Device ID, phone number, and authorization slot are required.' });
    }

    const device = await Device.findOne({ where: { device_id: deviceId } });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    if (slot === 1 || slot === '1') {
      device.authorized_phone_1 = phone;
    } else if (slot === 2 || slot === '2') {
      device.authorized_phone_2 = phone;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid slot. Must be 1 (Mummy) or 2 (Papa).' });
    }

    await device.save();
    return res.status(200).json({ success: true, message: `Phone authorized in Slot ${slot} successfully.` });
  } catch (error) {
    console.error('Authorize Phone Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to authorize phone.' });
  }
};

exports.getDeviceStatus = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOne({ where: { device_id: deviceId } });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    return res.status(200).json({
      success: true,
      device: {
        device_id: device.device_id,
        is_locked: device.is_locked,
        lock_reason: device.lock_reason,
        firmware_version: device.firmware_version,
        last_ping: device.last_ping,
        authorized_phone_1: device.authorized_phone_1,
        authorized_phone_2: device.authorized_phone_2
      }
    });
  } catch (error) {
    console.error('Get Device Status Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve status.' });
  }
};

exports.lockDevice = async (req, res) => {
  try {
    const { deviceId, reason } = req.body;
    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'Device ID is required.' });
    }

    const device = await Device.findOne({ where: { device_id: deviceId } });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    device.is_locked = true;
    device.lock_reason = reason || 'Locked by administrator/parent request';
    await device.save();

    return res.status(200).json({ success: true, message: 'Device locked successfully.' });
  } catch (error) {
    console.error('Lock Device Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to lock device.' });
  }
};

exports.unlockDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'Device ID is required.' });
    }

    const device = await Device.findOne({ where: { device_id: deviceId } });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    device.is_locked = false;
    device.lock_reason = null;
    await device.save();

    return res.status(200).json({ success: true, message: 'Device unlocked successfully.' });
  } catch (error) {
    console.error('Unlock Device Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to unlock device.' });
  }
};
