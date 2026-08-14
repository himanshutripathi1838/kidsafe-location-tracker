# KidSafe: System Integration Testing Guide

This guide explains how to test the location tracker end-to-end using curl or Postman, simulating coordinates to trigger alarms and notifications.

---

## 🛰️ 1. Simulating GPS Telemetry Pings

Since physical devices (ESP32) might not be active during testing, you can simulate coordinates to trigger speed thresholds or geofence crossings.

### A. Normal Location Ping ( Delhi India Gate )
Sends normal tracking telemetry with safe speeds and healthy battery:
```bash
curl -X POST http://localhost:5000/api/location/update \
-H "Content-Type: application/json" \
-d '{
  "deviceId": "dev-aarav-101",
  "latitude": 28.6129,
  "longitude": 77.2295,
  "speed": 12.0,
  "altitude": 210.0,
  "accuracy": 3.0,
  "battery": 95,
  "network": "4G"
}'
```

### B. Speed Limit Violation Alert (>20 km/h)
Triggers an overspeed alarm block because speed is 32 km/h (exceeding the child's limit of 20 km/h). All contacts with `alert_speed = true` receive push alerts and warning SMS:
```bash
curl -X POST http://localhost:5000/api/location/update \
-H "Content-Type: application/json" \
-d '{
  "deviceId": "dev-aarav-101",
  "latitude": 28.6160,
  "longitude": 77.2250,
  "speed": 32.5,
  "battery": 91,
  "network": "4G"
}'
```

### C. Low Battery Alert (<20%)
Fires a low-battery alert to the primary 2 contacts:
```bash
curl -X POST http://localhost:5000/api/location/update \
-H "Content-Type: application/json" \
-d '{
  "deviceId": "dev-aarav-101",
  "latitude": 28.6129,
  "longitude": 77.2295,
  "speed": 5.0,
  "battery": 18,
  "network": "3G"
}'
```

### D. Geofence Boundary Crossing (Exit Warning)
If a child travels from inside the Home geofence (India Gate) to outside (say, 1km away), the backend detects the exit boundary crossing and dispatches SMS/Push notifications:
```bash
curl -X POST http://localhost:5000/api/location/update \
-H "Content-Type: application/json" \
-d '{
  "deviceId": "dev-aarav-101",
  "latitude": 28.6350,
  "longitude": 77.2580,
  "speed": 15.0,
  "battery": 82,
  "network": "4G"
}'
```

---

## 🚨 2. Triggering Emergency SOS Alarms

Simulates a child pressing the physical SOS button on their watch/pendant:
```bash
curl -X POST http://localhost:5000/api/sos/trigger \
-H "Content-Type: application/json" \
-d '{
  "childId": "c-uuid-1",
  "latitude": 28.6253,
  "longitude": 77.2155,
  "speed": 0.0,
  "battery": 80
}'
```
### Expected System Reactions:
1. The backend inserts a red `AlertLog` of type `sos`.
2. Twilio places concurrent phone calls to primary numbers (+91 98765 43210 / प्रिया सिंह) reading the warning text.
3. Automated warning SMS with tracking links are dispatched to all 10 emergency contacts.
4. FCM pushes notifications to parent phones.
5. The Socket.IO server pushes an emergency event, prompting a full-screen red warning modal on parent apps.

---

## ✏️ 3. Testing Gated Contacts Edit Session

1. **Request edit access (OTP generation)**:
   ```bash
   curl -X POST http://localhost:5000/api/contacts/edit-session/start \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
   -d '{"childId": "c-uuid-1"}'
   ```
   *Response returns `"debugOtp": "xxxx"` for quick testing.*

2. **Verify OTP code (Unlock gate)**:
   ```bash
   curl -X POST http://localhost:5000/api/contacts/edit-session/verify \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
   -d '{"otp": "1234"}'
   ```
   *Once verified, contact edit APIs (`/add`, `/update`, `/delete`) become unlocked for 5 minutes.*
