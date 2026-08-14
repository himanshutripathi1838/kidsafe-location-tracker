/**
 * Parses raw GPS tracker CSV strings into structured telemetry objects.
 * 
 * Format:
 * YYYY/MM/DD,HH:MM:SS,Satellites,Latitude,Longitude,Speed,Course,Reserved,Battery,Signal,CountryCode,OperatorCode,LAC,CellID,ConfigMode
 * 
 * Example:
 * 2026/8/1,7:40:59,0,23.216732,77.396492,1.46,0.00,0,100,13,404,93,1772,6043,2
 */
function parseTrackerMessage(messageStr, trackerId = null) {
  if (!messageStr) return null;
  
  const parts = messageStr.trim().split(',');
  if (parts.length < 15) {
    throw new Error(`Invalid telemetry format: expected 15 parameters, received ${parts.length}`);
  }

  const [
    dateStr,
    timeStr,
    satellites,
    latitude,
    longitude,
    speed,
    course,
    reserved,
    battery,
    signal,
    countryCode,
    operatorCode,
    lac,
    cellId,
    configMode
  ] = parts;

  // Split date components
  const dateParts = dateStr.split('/');
  if (dateParts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // 0-indexed month
  const day = parseInt(dateParts[2], 10);

  // Split time components (resilient to both colons and slashes)
  const timeParts = timeStr.includes(':') ? timeStr.split(':') : timeStr.split('/');
  if (timeParts.length !== 3) {
    throw new Error(`Invalid time format: ${timeStr} (expected HH:MM:SS or HH/MM/SS)`);
  }
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);
  const second = parseInt(timeParts[2], 10);

  // Construct local Timestamp
  const timestamp = new Date(year, month, day, hour, minute, second);
  if (isNaN(timestamp.getTime())) {
    throw new Error(`Failed to parse valid Date from: ${dateStr} ${timeStr}`);
  }

  const parsedLat = parseFloat(latitude);
  const parsedLng = parseFloat(longitude);
  const hasGpsFix = !(parsedLat === 0 && parsedLng === 0);

  return {
    trackerId,
    latitude: parsedLat,
    longitude: parsedLng,
    speed: parseFloat(speed),
    battery: parseInt(battery, 10),
    signal: parseInt(signal, 10),
    satellites: parseInt(satellites, 10),
    course: parseFloat(course),
    countryCode: parseInt(countryCode, 10),
    operatorCode: parseInt(operatorCode, 10),
    lac: parseInt(lac, 10),
    cellId: parseInt(cellId, 10),
    configMode: parseInt(configMode, 10),
    hasGpsFix,
    timestamp
  };
}

module.exports = {
  parseTrackerMessage
};
