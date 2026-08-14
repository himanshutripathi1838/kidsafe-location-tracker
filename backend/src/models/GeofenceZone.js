const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const GeofenceZone = sequelize.define('GeofenceZone', {
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
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
  },
  center: {
    type: DataTypes.GEOGRAPHY('POINT', 4326),
    allowNull: true,
  },
  radius: {
    type: DataTypes.INTEGER, // meters
    allowNull: false,
    defaultValue: 100,
  },
  color: {
    type: DataTypes.STRING,
    defaultValue: '#4CAF50',
  },
  notify_on_entry: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  notify_on_exit: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  tableName: 'geofence_zones',
  timestamps: true,
  underscored: true
});

module.exports = GeofenceZone;
