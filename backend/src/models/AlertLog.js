const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AlertLog = sequelize.define('AlertLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  child_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING, // 'sos', 'geofence', 'speed', 'fall', 'battery', 'device_off', 'tamper'
    allowNull: false,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  speed: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  battery: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING, // 'triggered', 'sent', 'resolved'
    defaultValue: 'triggered',
  },
  details: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  resolved_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'alert_logs',
  timestamps: true,
  underscored: true
});

module.exports = AlertLog;
