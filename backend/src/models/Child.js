const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Child = sequelize.define('Child', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  parent_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  device_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  school_mode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  school_start: {
    type: DataTypes.TIME,
    defaultValue: '08:00',
  },
  school_end: {
    type: DataTypes.TIME,
    defaultValue: '14:30',
  },
  speed_threshold: {
    type: DataTypes.FLOAT,
    defaultValue: 20.0,
  }
}, {
  tableName: 'children',
  timestamps: true,
  underscored: true
});

module.exports = Child;
