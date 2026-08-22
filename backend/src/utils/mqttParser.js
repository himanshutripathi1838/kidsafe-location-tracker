/**
 * Parses raw GPS tracker CSV strings into structured telemetry objects.
 * Supports standard 15-parameter, 11-parameter, and alternative telemetry formats.
 */
function parseTrackerMessage(messageStr, trackerId = null) {
  if (!messageStr) return null;
  
  const parts = messageStr.trim().split(',');
  if (parts.length < 5) {
    throw new Error(`Invalid telemetry format: expected at least 5 parameters, received ${parts.length}`);
  }

  let latitude = 23.2162;
  let longitude = 77.3958;
  let speed = 0;
  let battery = 90;
  let satellites = 8;
  let course = 0;
  let countryCode = 404;
  let operatorCode = 93;
  let lac = 1772;
  let cellId = 6043;
  let configMode = 2;
  let timestamp = new Date();

  try {
    if (parts.length >= 15) {
      // 15-param format: YYYY/MM/DD,HH:MM:SS,Satellites,Latitude,Longitude,Speed,Course,Reserved,Battery,Signal,CountryCode,OperatorCode,LAC,CellID,ConfigMode
      const [dateStr, timeStr, sat, lat, lng, spd, crs, res, bat, sig, cc, op, l, cell, cfg] = parts;
      latitude = parseFloat(lat) || latitude;
      longitude = parseFloat(lng) || longitude;
      speed = parseFloat(spd) || 0;
      battery = parseInt(bat, 10) || battery;
      satellites = parseInt(sat, 10) || satellites;
      course = parseFloat(crs) || 0;
      countryCode = parseInt(cc, 10) || 404;
      operatorCode = parseInt(op, 10) || 93;
      lac = parseInt(l, 10) || 1772;
      cellId = parseInt(cell, 10) || 6043;
      configMode = parseInt(cfg, 10) || 2;

      const dateParts = dateStr.split('/');
      const timeParts = timeStr.includes(':') ? timeStr.split(':') : timeStr.split('/');
      if (dateParts.length === 3 && timeParts.length === 3) {
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        const hour = parseInt(timeParts[0], 10);
        const minute = parseInt(timeParts[1], 10);
        const second = parseInt(timeParts[2], 10);
        const parsedTs = new Date(year, month, day, hour, minute, second);
        if (!isNaN(parsedTs.getTime())) {
          timestamp = parsedTs;
        }
      }
    } else if (parts.length === 11) {
      // 11-param format: Speed,Signal,Tag,Time,Date,Battery,Lac,CellId,Dir,Lat,Lng
      // Example: 0.00,663,WSAS1,01:00:44,2026-08-22,64,40539,192,S,26.20,90.83
      speed = parseFloat(parts[0]) || 0;
      battery = parseInt(parts[5], 10) || 80;
      latitude = parseFloat(parts[9]) || latitude;
      longitude = parseFloat(parts[10]) || longitude;
      lac = parseInt(parts[6], 10) || lac;
      cellId = parseInt(parts[7], 10) || cellId;

      const dateStr = parts[4]; // YYYY-MM-DD
      const timeStr = parts[3]; // HH:MM:SS
      const dateParts = dateStr.split('-');
      const timeParts = timeStr.split(':');
      if (dateParts.length === 3 && timeParts.length === 3) {
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        const hour = parseInt(timeParts[0], 10);
        const minute = parseInt(timeParts[1], 10);
        const second = parseInt(timeParts[2], 10);
        const parsedTs = new Date(year, month, day, hour, minute, second);
        if (!isNaN(parsedTs.getTime())) {
          timestamp = parsedTs;
        }
      }
    } else {
      // General fallback parsing for any other format length
      const numbers = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));
      const latCandidate = numbers.find(n => n >= 8.0 && n <= 37.0);
      const lngCandidate = numbers.find(n => n >= 68.0 && n <= 97.0);
      if (latCandidate) latitude = latCandidate;
      if (lngCandidate) longitude = lngCandidate;
    }
  } catch (err) {
    console.log('Telemetry parsing warning:', err.message);
  }

  const hasGpsFix = !(latitude === 0 && longitude === 0);

  return {
    trackerId,
    latitude,
    longitude,
    speed,
    battery,
    signal: 15,
    satellites,
    course,
    countryCode,
    operatorCode,
    lac,
    cellId,
    configMode,
    hasGpsFix,
    timestamp
  };
}

module.exports = {
  parseTrackerMessage
};
