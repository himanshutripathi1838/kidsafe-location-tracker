const { SummaryReport, Child, Location, AlertLog } = require('../models');
const { generateDailyReportPDF } = require('../services/pdfService');

exports.getDailyReport = async (req, res) => {
  try {
    const { childId } = req.params;
    const { date } = req.query; // format: YYYY-MM-DD
    
    if (!childId || !date) {
      return res.status(400).json({ success: false, message: 'Child ID and date (YYYY-MM-DD) are required.' });
    }

    // 1. Check if report already compiled in DB
    let report = null;
    try {
      report = await SummaryReport.findOne({
        where: { child_id: childId, report_date: date }
      });
    } catch (dbErr) {
      console.warn('DB Offline, falling back to local JSON reports compiler:', dbErr.message);
    }

    if (!report) {
      // 2. Compilation engine: Generate daily stats dynamically if no record exists
      let logs = [];
      try {
        // Fallback: Read from local JSON history file if database is offline/empty
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '..', '..', 'data', `location_logs_${childId}_${date}.json`);
        if (fs.existsSync(filePath)) {
          logs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
      } catch (fileErr) {
        console.error('Failed to read fallback local JSON reports file:', fileErr);
      }

      if (logs.length === 0) {
        // Fetch all location logs for this child on selected date from DB if connected
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
        } catch (dbErr) {
          // DB Offline and no local JSON log file
        }
      }

      if (logs.length === 0) {
        return res.status(404).json({ success: false, message: 'No location logs found on this date to compile report.' });
      }

      // Sort logs chronologically to ensure accurate timeline and metrics calculation
      logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Compile stats
      let totalDistance = 0.0;
      let maxSpeed = 0.0;
      let speedSum = 0.0;
      let activeCount = 0;
      
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        if (log.speed > maxSpeed) maxSpeed = log.speed;
        speedSum += log.speed;
        if (log.speed > 2.0) activeCount++;

        if (i > 0) {
          // Add distance using simple flat calculations
          const prev = logs[i - 1];
          const dist = require('../services/geofenceService').calculateHaversineDistance(
            prev.latitude, prev.longitude, log.latitude, log.longitude
          );
          totalDistance += dist;
        }
      }

      const avgSpeed = logs.length > 0 ? (speedSum / logs.length) : 0.0;
      const distanceKm = parseFloat((totalDistance / 1000).toFixed(2));
      const activeTimeMins = activeCount * 10; // assuming pings represent 10s intervals
      const formattedActiveTime = activeTimeMins > 60 
        ? `${Math.floor(activeTimeMins / 60)}h ${activeTimeMins % 60}m`
        : `${activeTimeMins}m`;

      // Aggregate alerts count on this date
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

      // Assemble stops timeline logs from logs array (2-minute intervals)
      const stopsData = [];
      let lastLoggedTime = 0;
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const logTime = new Date(log.timestamp).getTime();
        if (i === 0 || logTime - lastLoggedTime >= 2 * 60 * 1000) {
          const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          stopsData.push({
            id: `log-${logTime}`,
            name: `Telemetry Log - 📍 (GPS: ${parseFloat(log.latitude).toFixed(5)}, ${parseFloat(log.longitude).toFixed(5)})`,
            duration: `Speed: ${parseFloat(log.speed).toFixed(1)} km/h`,
            battery: log.battery !== undefined ? `${log.battery}%` : '100%',
            time: timeStr
          });
          lastLoggedTime = logTime;
        }
      }

      // Compile battery graph datasets
      const batteryAvg = logs.length > 0 ? Math.floor(logs.reduce((acc, l) => acc + (l.battery || 100), 0) / logs.length) : 100;

      const batteryHistory = {
        labels: logs.slice(-8).map(l => new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
        data: logs.slice(-8).map(l => l.battery || 100)
      };
      
      const speedHistory = {
        labels: logs.slice(-8).map(l => new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
        data: logs.slice(-8).map(l => parseFloat((l.speed || 0).toFixed(1)))
      };

      const lastLog = logs[logs.length - 1];
      report = {
        child_id: childId,
        report_date: date,
        summary_type: 'daily',
        total_distance: distanceKm,
        avg_speed: parseFloat(avgSpeed.toFixed(1)),
        max_speed: parseFloat(maxSpeed.toFixed(1)),
        active_time: formattedActiveTime,
        stops_count: stopsData.length,
        stops_data: stopsData,
        alerts_count: alertsCount,
        battery_avg: batteryAvg,
        battery_history: batteryHistory,
        speed_history: speedHistory,
        route_data: logs.map(l => ({ lat: l.latitude, lng: l.longitude })),
        lastSeen: lastLog ? lastLog.timestamp : null,
        imei: lastLog ? (lastLog.imei || null) : null
      };

      try {
        await SummaryReport.create(report);
      } catch (dbErr) {}
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

    // 1. Fetch Report
    const report = await SummaryReport.findOne({
      where: { child_id: childId, report_date: date }
    });
    if (!report) {
      return res.status(404).json({ success: false, message: 'Compiled travel report not found. Compile report first.' });
    }

    // 2. Fetch Child Profile
    const child = await Child.findByPk(childId);
    if (!child) {
      return res.status(404).json({ success: false, message: 'Child not found.' });
    }

    // 3. Fetch Alert logs
    const startTime = new Date(`${date}T00:00:00.000Z`);
    const endTime = new Date(`${date}T23:59:59.999Z`);
    const alerts = await AlertLog.findAll({
      where: {
        child_id: childId,
        timestamp: {
          [require('sequelize').Op.between]: [startTime, endTime]
        }
      }
    });

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
