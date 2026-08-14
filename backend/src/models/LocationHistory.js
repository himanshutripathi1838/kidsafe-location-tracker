const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const LocationHistory = sequelize.define('LocationHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  trackerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'tracker_id'
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
  },
  speed: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0.0,
  },
  battery: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'location_histories',
  timestamps: true,
  updatedAt: false, // insert-only log
  underscored: true
});

module.exports = LocationHistory;
