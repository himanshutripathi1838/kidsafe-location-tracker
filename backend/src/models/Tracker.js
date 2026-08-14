const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Tracker = sequelize.define('Tracker', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  imei: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  childId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'child_id' // Explicit snake_case field mapping
  },
  status: {
    type: DataTypes.ENUM('online', 'offline'),
    defaultValue: 'offline',
    allowNull: false,
  },
  lastSeen: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_seen'
  }
}, {
  tableName: 'trackers',
  timestamps: true,
  underscored: true
});

module.exports = Tracker;
