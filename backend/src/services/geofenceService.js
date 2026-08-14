// Geofence processing helper using both PostGIS and JavaScript-level Haversine calculations

/**
 * Calculates Haversine distance in meters between two coordinates.
 * Exposes a fallback mechanism if PostGIS is not installed locally.
 */
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
};

/**
 * Checks if a coordinate point is inside a geofence zone.
 * @param {Object} point - { latitude, longitude }
 * @param {Object} zone - { latitude, longitude, radius }
 */
const isInsideZone = (point, zone) => {
  const distance = calculateHaversineDistance(
    parseFloat(point.latitude),
    parseFloat(point.longitude),
    parseFloat(zone.latitude),
    parseFloat(zone.longitude)
  );
  return distance <= zone.radius;
};

/**
 * Sequelize raw query helper: Check zones for a location using PostgreSQL PostGIS geography.
 * Utilizes PostGIS ST_DWithin or ST_Distance.
 */
const checkGeofencesPostGIS = async (childId, latitude, longitude, sequelizeInstance) => {
  try {
    // PostGIS query: Find all active zones for a child where the distance from the point to center is <= radius
    const query = `
      SELECT id, name, radius, color, notify_on_entry, notify_on_exit, is_active,
             ST_Distance(center, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography) as distance
      FROM geofence_zones
      WHERE child_id = :childId AND is_active = true
    `;
    
    const [results] = await sequelizeInstance.query(query, {
      replacements: { childId, latitude, longitude },
    });
    
    return results.map(r => ({
      ...r,
      isInside: r.distance <= r.radius
    }));
  } catch (error) {
    console.warn('PostGIS query failed (PostGIS extension may not be installed/activated). Falling back to JS-level checking:', error.message);
    return null;
  }
};

module.exports = {
  calculateHaversineDistance,
  isInsideZone,
  checkGeofencesPostGIS
};
