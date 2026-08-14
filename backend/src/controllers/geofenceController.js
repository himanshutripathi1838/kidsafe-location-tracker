const GeofenceZone = require('../models/GeofenceZone');

exports.createGeofence = async (req, res) => {
  try {
    const { childId, name, latitude, longitude, radius, color, notifyOnEntry, notifyOnExit } = req.body;
    if (!childId || !name || latitude === undefined || longitude === undefined || !radius) {
      return res.status(400).json({ success: false, message: 'Child ID, name, center coordinates, and radius are required.' });
    }

    // Set center geography point
    const pointGeography = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)]
    };

    const zone = await GeofenceZone.create({
      child_id: childId,
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      center: pointGeography,
      radius: parseInt(radius, 10),
      color: color || '#4CAF50',
      notify_on_entry: notifyOnEntry !== false,
      notify_on_exit: notifyOnExit !== false,
      is_active: true
    });

    return res.status(201).json({ success: true, message: 'Geofence safety zone created successfully.', zone });
  } catch (error) {
    console.error('Create Geofence Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create safety zone.' });
  }
};

exports.updateGeofence = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, radius, color, notifyOnEntry, notifyOnExit, isActive } = req.body;

    const zone = await GeofenceZone.findByPk(id);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Safety zone not found.' });
    }

    if (name) zone.name = name;
    if (radius) zone.radius = parseInt(radius, 10);
    if (color) zone.color = color;
    if (notifyOnEntry !== undefined) zone.notify_on_entry = notifyOnEntry;
    if (notifyOnExit !== undefined) zone.notify_on_exit = notifyOnExit;
    if (isActive !== undefined) zone.is_active = isActive;

    await zone.save();
    return res.status(200).json({ success: true, message: 'Safety zone updated successfully.', zone });
  } catch (error) {
    console.error('Update Geofence Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update safety zone.' });
  }
};

exports.deleteGeofence = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await GeofenceZone.findByPk(id);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Safety zone not found.' });
    }

    await zone.destroy();
    return res.status(200).json({ success: true, message: 'Safety zone deleted successfully.' });
  } catch (error) {
    console.error('Delete Geofence Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete safety zone.' });
  }
};

exports.listGeofences = async (req, res) => {
  try {
    const { childId } = req.params;
    const zones = await GeofenceZone.findAll({
      where: { child_id: childId }
    });

    return res.status(200).json({ success: true, zones });
  } catch (error) {
    console.error('List Geofences Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve safety zones.' });
  }
};
