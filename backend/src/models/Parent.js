const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Parent = sequelize.define('Parent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: true, // OTP-based verification fallback
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  tableName: 'parents',
  timestamps: true,
  underscored: true
});

module.exports = Parent;
