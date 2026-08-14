const { sequelize } = require('../config/db');
const Parent = require('./Parent');
const Child = require('./Child');
const Device = require('./Device');
const Location = require('./Location');
const GeofenceZone = require('./GeofenceZone');
const EmergencyContact = require('./EmergencyContact');
const AlertLog = require('./AlertLog');
const EditSession = require('./EditSession');
const SummaryReport = require('./SummaryReport');
const Tracker = require('./Tracker');
const LiveLocation = require('./LiveLocation');
const LocationHistory = require('./LocationHistory');

// 1. Parent <-> Child Relationship
Parent.hasMany(Child, { foreignKey: 'parent_id', as: 'children', onDelete: 'CASCADE' });
Child.belongsTo(Parent, { foreignKey: 'parent_id', as: 'parent' });

// 2. Child <-> Device Relationship
Device.hasOne(Child, { foreignKey: 'device_id', as: 'child', onDelete: 'SET NULL' });
Child.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

// 3. Child <-> Location Relationship
Child.hasMany(Location, { foreignKey: 'child_id', as: 'locations', onDelete: 'CASCADE' });
Location.belongsTo(Child, { foreignKey: 'child_id', as: 'child' });

// 4. Child <-> GeofenceZone Relationship
Child.hasMany(GeofenceZone, { foreignKey: 'child_id', as: 'geofences', onDelete: 'CASCADE' });
GeofenceZone.belongsTo(Child, { foreignKey: 'child_id', as: 'child' });

// 5. Child <-> EmergencyContact Relationship
Child.hasMany(EmergencyContact, { foreignKey: 'child_id', as: 'contacts', onDelete: 'CASCADE' });
EmergencyContact.belongsTo(Child, { foreignKey: 'child_id', as: 'child' });

// 6. Child <-> AlertLog Relationship
Child.hasMany(AlertLog, { foreignKey: 'child_id', as: 'alerts', onDelete: 'CASCADE' });
AlertLog.belongsTo(Child, { foreignKey: 'child_id', as: 'child' });

// 7. Child & Parent <-> EditSession Relationship
Child.hasMany(EditSession, { foreignKey: 'child_id', as: 'editSessions', onDelete: 'CASCADE' });
EditSession.belongsTo(Child, { foreignKey: 'child_id', as: 'child' });

Parent.hasMany(EditSession, { foreignKey: 'parent_id', as: 'editSessions', onDelete: 'CASCADE' });
EditSession.belongsTo(Parent, { foreignKey: 'parent_id', as: 'parent' });

// 8. Child <-> SummaryReport Relationship
Child.hasMany(SummaryReport, { foreignKey: 'child_id', as: 'reports', onDelete: 'CASCADE' });
SummaryReport.belongsTo(Child, { foreignKey: 'child_id', as: 'child' });

// 9. Child <-> Tracker Relationship
Child.hasOne(Tracker, { foreignKey: 'child_id', as: 'tracker', onDelete: 'SET NULL' });
Tracker.belongsTo(Child, { foreignKey: 'child_id', as: 'child' });

// 10. Tracker <-> LiveLocation Relationship
Tracker.hasOne(LiveLocation, { foreignKey: 'tracker_id', as: 'liveLocation', onDelete: 'CASCADE' });
LiveLocation.belongsTo(Tracker, { foreignKey: 'tracker_id', as: 'tracker' });

// 11. Tracker <-> LocationHistory Relationship
Tracker.hasMany(LocationHistory, { foreignKey: 'tracker_id', as: 'history', onDelete: 'CASCADE' });
LocationHistory.belongsTo(Tracker, { foreignKey: 'tracker_id', as: 'tracker' });

module.exports = {
  sequelize,
  Parent,
  Child,
  Device,
  Location,
  GeofenceZone,
  EmergencyContact,
  AlertLog,
  EditSession,
  SummaryReport,
  Tracker,
  LiveLocation,
  LocationHistory
};
