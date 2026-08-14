// Fall detection algorithm processing helpers for both accelerometer data and GPS speed changes

/**
 * Speed-based fall detection:
 * Triggers if child has sudden high speed (e.g. riding in vehicle / running >30 km/h) 
 * followed immediately by a drop to 0 km/h (sudden collision / stop)
 */
export const checkSpeedFall = (prevSpeed, currentSpeed) => {
  if (prevSpeed >= 30 && currentSpeed === 0) {
    return true;
  }
  return false;
};

/**
 * Accelerometer-based fall detection (standard 3-axis logic):
 * 1. Free Fall Phase: Total acceleration vector magnitude drops close to 0 (free-fall state, < 0.3G)
 * 2. Impact Phase: Total acceleration vector spike (impact state, > 3.0G)
 * 3. Inactivity Phase: Post-impact quietness (lying down, near 1.0G static)
 */
export class FallDetector {
  constructor(onFallDetected) {
    this.onFallDetected = onFallDetected;
    this.isFreeFallDetected = false;
    this.freeFallTimestamp = 0;
    
    // G constant (9.81 m/s^2)
    this.G = 9.81;
    // Thresholds
    this.FREE_FALL_THRESHOLD = 0.3 * this.G; // ~2.94 m/s^2 (near weightless)
    this.IMPACT_THRESHOLD = 3.2 * this.G;    // ~31.39 m/s^2 (high impact)
    this.FREE_FALL_TIMEOUT = 1000;            // Impact must follow freefall within 1 second
  }

  /**
   * Process a single accelerometer reading packet
   * @param {Object} reading - { x, y, z, timestamp } from react-native-sensors
   */
  processReading(reading) {
    const { x, y, z } = reading;
    
    // Calculate total vector magnitude
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const now = Date.now();

    // Check for free fall (near 0 m/s^2)
    if (magnitude < this.FREE_FALL_THRESHOLD) {
      this.isFreeFallDetected = true;
      this.freeFallTimestamp = now;
      console.log('FallDetector: Potential free-fall detected (low-G)', magnitude);
      return;
    }

    // Check for impact (high m/s^2) following free fall within timeout
    if (this.isFreeFallDetected) {
      if (now - this.freeFallTimestamp > this.FREE_FALL_TIMEOUT) {
        // Freefall expired without impact
        this.isFreeFallDetected = false;
      } else if (magnitude > this.IMPACT_THRESHOLD) {
        console.log('FallDetector: Impact detected following free-fall! (high-G)', magnitude);
        this.isFreeFallDetected = false;
        
        if (this.onFallDetected) {
          this.onFallDetected({
            magnitude: magnitude / this.G, // value in Gs
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }
}
export default FallDetector;
