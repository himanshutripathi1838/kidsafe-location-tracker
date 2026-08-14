# KidSafe: REST API & WebSockets Documentation

All REST routes are prefixed with `/api`. All write/read routes except OTP requests require a `Bearer <JWT_TOKEN>` authorization header.

---

## 🔒 1. Authentication Routes

### POST `/auth/send-otp`
Sends a random 4-digit code to the user's phone number.
- **Request Body**:
  ```json
  { "phone": "+919876543210" }
  ```
- **Response (200)**:
  ```json
  { "success": true, "message": "OTP sent successfully." }
  ```

### POST `/auth/verify-otp`
Verifies OTP code and returns authentication JWT token.
- **Request Body**:
  ```json
  { "phone": "+919876543210", "otp": "1234" }
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "parent": { "id": "p-uuid-1", "name": "Vikram", "phone": "+919876543210" }
  }
  ```

---

## 🧒 2. Device Pairing & Lock Routes

### POST `/device/pair`
Pairs a tracking device ID with a child profile.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  { "name": "Aarav Singh", "age": 8, "deviceId": "dev-aarav-101" }
  ```

### POST `/device/lock`
Locks the tracking device.
- **Request Body**:
  ```json
  { "deviceId": "dev-aarav-101", "reason": "Tamper detected / case open" }
  ```

---

## 📍 3. Telemetry Location Routes

### POST `/location/update`
Receives coordinates from ESP32 tracker module.
- **Request Body**:
  ```json
  {
    "deviceId": "dev-aarav-101",
    "latitude": 28.6253,
    "longitude": 77.2155,
    "speed": 0.0,
    "battery": 85,
    "network": "4G"
  }
  ```

### GET `/location/live/:childId`
Retrieves child's latest coordinates.

---

## 🚨 4. SOS Emergency Alerts

### POST `/sos/trigger`
Dispatches SOS alarm.
- **Request Body**:
  ```json
  {
    "childId": "c-uuid-1",
    "latitude": 28.6253,
    "longitude": 77.2155,
    "speed": 0.0,
    "battery": 85
  }
  ```

---

## 📞 5. Gated Contact Settings

### POST `/contacts/edit-session/start`
Sends security edit OTP to parent.
- **Request Body**:
  ```json
  { "childId": "c-uuid-1" }
  ```

### POST `/contacts/edit-session/verify`
Unlocks configuration panel for 5 minutes.
- **Request Body**:
  ```json
  { "otp": "1234" }
  ```

### POST `/contacts/add`
Adds a contact (Requires unlocked edit session).
- **Request Body**:
  ```json
  {
    "childId": "c-uuid-1",
    "name": "Vikram Singh",
    "phone": "+919876543210",
    "relationship": "Father",
    "isPrimary": true
  }
  ```

---

## 📈 6. Activity Reports & PDF Exports

### GET `/reports/daily/:childId?date=YYYY-MM-DD`
Retrieves daily travel distance, times, stops, and battery averages.

### GET `/reports/export?childId=c-uuid-1&date=YYYY-MM-DD`
Serves direct download attachment link of dailyTravel_Report.pdf.

---

## 📡 7. Real-Time WebSockets Events (Socket.IO)

### Client Emissions:
- `subscribe` room subscribe:
  - **Body**: `{ "childId": "c-uuid-1" }`
  - *Places socket connection in the child room `child_c-uuid-1`.*
- `unsubscribe` room unsubscribe:
  - **Body**: `{ "childId": "c-uuid-1" }`

### Server Broadcasts:
- `location_update`: Real-time coordinates update.
- `sos_alert`: Full-screen emergency alarm event.
- `geofence_alert`: Geofence warning event.
