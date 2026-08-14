const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EditSession = sequelize.define('EditSession', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  child_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  parent_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  session_start: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  session_end: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  otp_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  changes_made: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  device_info: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING, // 'active', 'expired', 'completed', 'failed'
    defaultValue: 'active',
  }
}, {
  tableName: 'edit_sessions',
  timestamps: true,
  underscored: true
});

module.exports = EditSession;
