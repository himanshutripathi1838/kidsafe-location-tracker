const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EmergencyContact = sequelize.define('EmergencyContact', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  child_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  relationship: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  call_priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0, // 1, 2 for primary dials
  },
  fcm_token: {
    type: DataTypes.STRING,
    allowNull: true, // FCM push registrations
  },
  alert_sos: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  alert_geofence: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  alert_speed: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  alert_battery: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  alert_device_off: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  alert_tamper: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  alert_summary: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  quiet_hours_start: {
    type: DataTypes.TIME,
    defaultValue: '22:00',
  },
  quiet_hours_end: {
    type: DataTypes.TIME,
    defaultValue: '06:00',
  },
  language: {
    type: DataTypes.STRING,
    defaultValue: 'english',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  tableName: 'emergency_contacts',
  timestamps: true,
  underscored: true
});

module.exports = EmergencyContact;
