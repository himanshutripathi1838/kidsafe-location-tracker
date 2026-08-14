const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const LiveLocation = sequelize.define('LiveLocation', {
  trackerId: {
    type: DataTypes.UUID,
    primaryKey: true,
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
  signal: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  course: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0.0,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'live_locations',
  timestamps: true,
  underscored: true
});

module.exports = LiveLocation;
