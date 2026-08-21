const { SummaryReport, Child, Location, AlertLog } = require('../models');
const { generateDailyReportPDF } = require('../services/pdfService');
const fs = require('fs');
const path = require('path');

const readLocalTelemetryLogs = (childId, date) => {
  try {
    const filePath = path.join(__dirname, '..', '..', 'data', `location_logs_${childId}_${date}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (fileErr) {
    console.error('Failed to read fallback local JSON reports file:', fileErr);
  }
  return [];
};

const getLogNumber = (log, field, fallback = 0) => {
  const value = parseFloat(log[field]);
  return Number.isFinite(value) ? value : fallback;
};

const compileReportFromLogs = async (childId, date, logs) => {
  const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let totalDistance = 0.0;
  let maxSpeed = 0.0;
  let speedSum = 0.0;
  let activeCount = 0;

  for (let i = 0; i < sortedLogs.length; i++) {
    const log = sortedLogs[i];
    const speed = getLogNumber(log, 'speed');
    if (speed > maxSpeed) maxSpeed = speed;
    speedSum += speed;
    if (speed > 2.0) activeCount++;

    if (i > 0) {
      const prev = sortedLogs[i - 1];
      totalDistance += require('../services/geofenceService').calculateHaversineDistance(
        getLogNumber(prev, 'latitude'), getLogNumber(prev, 'longitude'),
        getLogNumber(log, 'latitude'), getLogNumber(log, 'longitude')
      );
    }
  }

  const avgSpeed = sortedLogs.length > 0 ? (speedSum / sortedLogs.length) : 0.0;
  const distanceKm = parseFloat((totalDistance / 1000).toFixed(2));
  const activeTimeMins = Math.ceil((activeCount * 10) / 60);
  const formattedActiveTime = activeTimeMins > 60
    ? `${Math.floor(activeTimeMins / 60)}h ${activeTimeMins % 60}m`
    : `${activeTimeMins}m`;

  let alertsCount = 0;
  try {
    const startTime = new Date(`${date}T00:00:00.000Z`);
    const endTime = new Date(`${date}T23:59:59.999Z`);
    alertsCount = await AlertLog.count({
      where: {
        child_id: childId,
        timestamp: {
          [require('sequelize').Op.between]: [startTime, endTime]
        }
      }
    });
  } catch (e) {}

  const telemetryLogs = sortedLogs.map((log, index) => {
    const logTime = new Date(log.timestamp).getTime();
    const latitude = getLogNumber(log, 'latitude');
    const longitude = getLogNumber(log, 'longitude');
    const speed = getLogNumber(log, 'speed');
    const battery = parseInt(log.battery, 10);
    return {
      id: `mqtt-${logTime}-${index}`,
      name: `MQTT Telemetry - GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      duration: `Speed: ${speed.toFixed(1)} km/h`,
      battery: Number.isFinite(battery) ? `${battery}%` : 'N/A',
      time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      latitude,
      longitude,
      speed,
      satellites: parseInt(log.satellites, 10) || 0,
      network: log.network || (log.signal !== undefined ? `${log.signal} GSM` : 'GSM'),
      timestamp: log.timestamp,
      imei: log.imei || null
    };
  });

  const batteryAvg = sortedLogs.length > 0
    ? Math.floor(sortedLogs.reduce((acc, l) => acc + (parseInt(l.battery, 10) || 100), 0) / sortedLogs.length)
    : 100;

  const batteryHistory = {
    labels: sortedLogs.slice(-8).map(l => new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    data: sortedLogs.slice(-8).map(l => parseInt(l.battery, 10) || 100)
  };

  const speedHistory = {
    labels: sortedLogs.slice(-8).map(l => new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    data: sortedLogs.slice(-8).map(l => parseFloat((getLogNumber(l, 'speed')).toFixed(1)))
  };

  const lastLog = sortedLogs[sortedLogs.length - 1];
  return {
    child_id: childId,
    report_date: date,
    summary_type: 'daily',
    total_distance: distanceKm,
    avg_speed: parseFloat(avgSpeed.toFixed(1)),
    max_speed: parseFloat(maxSpeed.toFixed(1)),
    active_time: formattedActiveTime,
    stops_count: telemetryLogs.length,
    stops_data: telemetryLogs,
    telemetry_logs: telemetryLogs,
    alerts_count: alertsCount,
    battery_avg: batteryAvg,
    battery_history: batteryHistory,
    speed_history: speedHistory,
    route_data: sortedLogs.map(l => ({ lat: getLogNumber(l, 'latitude'), lng: getLogNumber(l, 'longitude') })),
    lastSeen: lastLog ? lastLog.timestamp : null,
    imei: lastLog ? (lastLog.imei || null) : null
  };
};

exports.getDailyReport = async (req, res) => {
  try {
    const { childId } = req.params;
    const { date } = req.query; // format: YYYY-MM-DD
    
    if (!childId || !date) {
      return res.status(400).json({ success: false, message: 'Child ID and date (YYYY-MM-DD) are required.' });
    }

    let logs = readLocalTelemetryLogs(childId, date);
    if (logs.length === 0) {
      try {
        const startTime = new Date(`${date}T00:00:00.000Z`);
        const endTime = new Date(`${date}T23:59:59.999Z`);
        logs = await Location.findAll({
          where: {
            child_id: childId,
            timestamp: {
              [require('sequelize').Op.between]: [startTime, endTime]
            }
          },
          order: [['timestamp', 'ASC']]
        });
      } catch (dbErr) {}
    }

    let report = null;
    if (logs.length > 0) {
      report = await compileReportFromLogs(childId, date, logs);
      try {
        const existing = await SummaryReport.findOne({ where: { child_id: childId, report_date: date } });
        if (existing) {
          await existing.update(report);
        } else {
          await SummaryReport.create(report);
        }
      } catch (dbErr) {}
    } else {
      try {
        report = await SummaryReport.findOne({ where: { child_id: childId, report_date: date } });
      } catch (dbErr) {
        console.warn('DB Offline, falling back to local JSON reports compiler:', dbErr.message);
      }
    }

    if (!report) {
      return res.status(404).json({ success: false, message: 'No location logs found on this date to compile report.' });
    }

    return res.status(200).json({ success: true, report });
  } catch (error) {
    console.error('Get Daily Report Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to compile or retrieve daily report.' });
  }
};

exports.exportPDF = async (req, res) => {
  try {
    const { childId, date } = req.query;
    if (!childId || !date) {
      return res.status(400).json({ success: false, message: 'Child ID and date are required.' });
    }

    // 1. Fetch or compile report from the latest MQTT JSON logs first.
    const logs = readLocalTelemetryLogs(childId, date);
    let report = logs.length > 0 ? await compileReportFromLogs(childId, date, logs) : null;
    if (!report) {
      try {
        report = await SummaryReport.findOne({
          where: { child_id: childId, report_date: date }
        });
      } catch (dbErr) {}
    }
    if (!report) {
      return res.status(404).json({ success: false, message: 'Compiled travel report not found. Compile report first.' });
    }

    // 2. Fetch Child Profile
    let child = null;
    try {
      child = await Child.findByPk(childId);
    } catch (dbErr) {}
    if (!child) {
      child = {
        id: childId,
        name: childId === 'c-uuid-1' ? 'Aarav Singh' : 'Child',
        age: 'N/A',
        device_id: report.imei || 'MQTT Tracker'
      };
    }

    // 3. Fetch Alert logs
    let alerts = [];
    try {
      const startTime = new Date(`${date}T00:00:00.000Z`);
      const endTime = new Date(`${date}T23:59:59.999Z`);
      alerts = await AlertLog.findAll({
        where: {
          child_id: childId,
          timestamp: {
            [require('sequelize').Op.between]: [startTime, endTime]
          }
        }
      });
    } catch (dbErr) {}

    // 4. Generate PDF buffer
    const pdfBuffer = await generateDailyReportPDF(report, child, alerts);
    
    // 5. Send file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=KidSafe_Report_${child.name.replace(/\s+/g, '_')}_${date}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Export PDF Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate PDF document.' });
  }
};

exports.getBatteryHistory = async (req, res) => {
  try {
    const { childId } = req.params;
    
    // Fetch last 24 hours of coordinates to pull battery logs
    const timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await Location.findAll({
      where: {
        child_id: childId,
        timestamp: {
          [require('sequelize').Op.gte]: timeLimit
        }
      },
      attributes: ['battery', 'timestamp'],
      order: [['timestamp', 'ASC']]
    });

    return res.status(200).json({ success: true, logs });
  } catch (error) {
    console.error('Get Battery History Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch battery logs.' });
  }
};
