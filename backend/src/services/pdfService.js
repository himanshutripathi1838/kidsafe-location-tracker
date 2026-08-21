const PDFDocument = require('pdfkit');
const fs = require('fs');

/**
 * Generates a beautiful PDF report for a child's daily travel summary
 * @param {Object} reportData - SummaryReport object
 * @param {Object} child - Child object
 * @param {Array} alerts - Alert logs for that date
 * @returns {Promise<Buffer>} - Resolves to PDF document Buffer
 */
const generateDailyReportPDF = (reportData, child, alerts = []) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      let buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // 1. Header design (Shield logo and title)
      doc.rect(0, 0, doc.page.width, 110).fill('#6200EE');
      doc.fillColor('#FFFFFF')
         .fontSize(24)
         .text('🛡️ KidSafe Tracker', 50, 30, { bold: true })
         .fontSize(12)
         .text('Daily Travel & Activity Commute Summary', 50, 65);

      // Reset text color
      doc.fillColor('#212121');

      // 2. Child Profile metadata block
      doc.moveDown(4);
      doc.fontSize(16).text('Commute Profile details', { underline: true });
      doc.moveDown(0.5);
      
      const leftColX = 50;
      const rightColX = 300;
      let currentY = doc.y;

      doc.fontSize(11)
         .text(`Child Name: ${child.name}`, leftColX, currentY)
         .text(`Report Date: ${reportData.report_date}`, rightColX, currentY);
      
      currentY += 20;
      doc.text(`Age: ${child.age} years`, leftColX, currentY)
         .text(`Hardware Device ID: ${child.device_id || 'Not Associated'}`, rightColX, currentY);

      // 3. Travel Metrics Grid
      doc.moveDown(2.5);
      doc.fontSize(16).text('Travel Metrics Overview');
      doc.moveDown(1);
      
      const gridY = doc.y;
      // Draw grid boxes
      const boxW = 110;
      const boxH = 60;
      const metrics = [
        { label: 'Total Distance', val: `${reportData.total_distance} km` },
        { label: 'Active Duration', val: reportData.active_time || 'N/A' },
        { label: 'Avg Speed', val: `${reportData.avg_speed} km/h` },
        { label: 'Max Speed', val: `${reportData.max_speed} km/h` },
      ];

      metrics.forEach((m, idx) => {
        const boxX = 50 + idx * (boxW + 15);
        doc.rect(boxX, gridY, boxW, boxH).fillAndStroke('#F3F4F6', '#E5E7EB');
        doc.fillColor('#6200EE').fontSize(14).text(m.val, boxX + 10, gridY + 15, { width: boxW - 20, align: 'center', bold: true });
        doc.fillColor('#6B7280').fontSize(9).text(m.label, boxX + 10, gridY + 38, { width: boxW - 20, align: 'center' });
      });

      // Reset styles
      doc.fillColor('#212121').strokeColor('#000000');

      // 4. Stoppage Table
      doc.moveDown(5);
      doc.fontSize(16).text('MQTT Telemetry Timeline Logs');
      doc.moveDown(0.5);

      const drawTelemetryHeader = (y) => {
        doc.rect(50, y, 500, 22).fill('#EEF2FF');
        doc.fillColor('#4B5563')
           .fontSize(8)
           .text('Time', 58, y + 7, { width: 55 })
           .text('Latitude', 115, y + 7, { width: 65 })
           .text('Longitude', 182, y + 7, { width: 70 })
           .text('Speed', 255, y + 7, { width: 45 })
           .text('Battery', 305, y + 7, { width: 45 })
           .text('Network', 355, y + 7, { width: 55 })
           .text('Sat', 415, y + 7, { width: 30 })
           .text('IMEI', 450, y + 7, { width: 95 });
        doc.fillColor('#212121');
        return y + 22;
      };

      const ensureRowSpace = (currentY) => {
        if (currentY <= doc.page.height - 80) return currentY;
        doc.addPage();
        doc.fontSize(13).fillColor('#212121').text('MQTT Telemetry Timeline Logs (continued)', 50, 45);
        return drawTelemetryHeader(70);
      };

      doc.fontSize(8);
      let tableY = drawTelemetryHeader(doc.y);

      const telemetryLogs = reportData.telemetry_logs || reportData.stops_data || [];
      if (telemetryLogs.length === 0) {
        doc.text('No MQTT telemetry packets logged during this report date.', 60, tableY + 5);
        tableY += 22;
      } else {
        telemetryLogs.forEach((log, index) => {
          tableY = ensureRowSpace(tableY);
          const rowHeight = 22;
          if (index % 2 === 0) {
            doc.rect(50, tableY, 500, rowHeight).fill('#FAFAFA');
          }
          doc.fillColor('#212121').fontSize(7.5)
             .text(log.time || (log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'), 58, tableY + 6, { width: 55 })
             .text(Number.isFinite(log.latitude) ? log.latitude.toFixed(6) : 'N/A', 115, tableY + 6, { width: 65 })
             .text(Number.isFinite(log.longitude) ? log.longitude.toFixed(6) : 'N/A', 182, tableY + 6, { width: 70 })
             .text(log.speed !== undefined ? `${parseFloat(log.speed).toFixed(1)}` : 'N/A', 255, tableY + 6, { width: 45 })
             .text(log.battery || 'N/A', 305, tableY + 6, { width: 45 })
             .text(log.network || 'GSM', 355, tableY + 6, { width: 55 })
             .text(log.satellites !== undefined ? String(log.satellites) : '0', 415, tableY + 6, { width: 30 })
             .text(log.imei || reportData.imei || 'N/A', 450, tableY + 6, { width: 95 });
          doc.lineCap('butt').moveTo(50, tableY + rowHeight).lineTo(550, tableY + rowHeight).stroke('#F3F4F6');
          tableY += rowHeight;
        });
      }

      // 5. Alert History
      if (tableY > doc.page.height - 160) {
        doc.addPage();
        doc.y = 50;
      } else {
        doc.y = tableY + 20;
      }
      doc.fontSize(16).text('Safety alerts & Breaches (Last 24 Hours)');
      doc.moveDown(0.5);

      const alertsTop = doc.y;
      // Alert table header
      doc.rect(50, alertsTop, 500, 20).fill('#FEE2E2');
      doc.fillColor('#991B1B')
         .text('Alert Type', 60, alertsTop + 5)
         .text('Event description', 180, alertsTop + 5)
         .text('Triggered Time', 440, alertsTop + 5);

      doc.fillColor('#212121');
      let alertsY = alertsTop + 20;

      if (alerts.length === 0) {
        doc.text('All safe! No emergency alerts triggered on this date.', 60, alertsY + 5);
      } else {
        alerts.forEach((alert) => {
          doc.lineCap('butt').moveTo(50, alertsY + 20).lineTo(550, alertsY + 20).stroke('#F9FAFB');
          
          const alertType = alert.type.toUpperCase();
          const alertDesc = alert.details ? (typeof alert.details === 'string' ? alert.details : JSON.stringify(alert.details)) : 'Custom threshold breach.';
          
          doc.text(alertType, 60, alertsY + 5)
             .text(alertDesc, 180, alertsY + 5, { width: 250 })
             .text(new Date(alert.timestamp).toLocaleTimeString(), 440, alertsY + 5);

          alertsY += 20;
        });
      }

      // 6. Footer (Page numbers and disclaimer)
      const pageHeight = doc.page.height;
      doc.fontSize(8)
         .fillColor('#9CA3AF')
         .text('This is an automated safety report generated by the KidSafe Location Tracking system.', 50, pageHeight - 50, { align: 'center' })
         .text(`Generated at: ${new Date().toLocaleString()}`, 50, pageHeight - 38, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateDailyReportPDF
};
