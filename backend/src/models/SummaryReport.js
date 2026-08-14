const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SummaryReport = sequelize.define('SummaryReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  child_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  report_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  summary_type: {
    type: DataTypes.STRING, // 'daily', 'weekly'
    defaultValue: 'daily',
  },
  total_distance: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  avg_speed: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  max_speed: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  active_time: {
    type: DataTypes.STRING, // Store as formatted string like '1h 45m'
    allowNull: true,
  },
  stops_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  stops_data: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  alerts_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  battery_avg: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  route_data: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  sent_to_app_1: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  sent_to_app_2: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  generated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'summary_reports',
  timestamps: true,
  underscored: true
});

module.exports = SummaryReport;
