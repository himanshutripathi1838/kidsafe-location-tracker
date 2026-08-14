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
      doc.fontSize(16).text('Stoppage Timeline Logs');
      doc.moveDown(0.5);

      const tableTop = doc.y;
      doc.fontSize(10);
      
      // Table Header
      doc.rect(50, tableTop, 500, 20).fill('#EEF2FF');
      doc.fillColor('#4B5563')
         .text('Stop Location / Name', 60, tableTop + 5)
         .text('Time', 280, tableTop + 5)
         .text('Stoppage Duration', 360, tableTop + 5)
         .text('Battery %', 460, tableTop + 5);

      doc.fillColor('#212121');
      let tableY = tableTop + 20;

      const stops = reportData.stops_data || [];
      if (stops.length === 0) {
        doc.text('No prolonged stoppages logged during routing.', 60, tableY + 5);
        tableY += 20;
      } else {
        stops.forEach((stop) => {
          // Draw bottom border line
          doc.lineCap('butt').moveTo(50, tableY + 20).lineTo(550, tableY + 20).stroke('#F3F4F6');
          
          doc.text(stop.name, 60, tableY + 5, { width: 210 })
             .text(stop.time || 'N/A', 280, tableY + 5)
             .text(stop.duration || 'N/A', 360, tableY + 5)
             .text(stop.battery || 'N/A', 460, tableY + 5);
          
          tableY += 20;
        });
      }

      // 5. Alert History
      doc.y = tableY + 20;
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
