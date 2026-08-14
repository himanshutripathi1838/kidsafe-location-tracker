const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  child_id: {
    type: DataTypes.UUID,
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
  location: {
    type: DataTypes.GEOGRAPHY('POINT', 4326),
    allowNull: true,
  },
  speed: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  altitude: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  accuracy: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  battery: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  network: {
    type: DataTypes.STRING,
    defaultValue: '4G',
  },
  is_fallback: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'locations',
  timestamps: true, // will generate created_at and updated_at
  updatedAt: false, // Location updates are insert-only
  underscored: true
});

module.exports = Location;
