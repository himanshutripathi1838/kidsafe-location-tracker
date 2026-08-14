# 🛡️ KidSafe: Kids Real-Time Location Tracking & SOS System

KidSafe is a production-ready, complete IoT + Mobile + Backend tracking ecosystem designed for parents to monitor their school-going children (5-15 years) in real-time, enforce geofence boundaries, detect physical falls, and dispatch automated phone calls, SMS alerts, and push notifications during emergency distress SOS states.

---

## 🏗️ Project Architecture

```
d:\Loaction_tracker/
├── backend/            # Express.js REST API + PostgreSQL PostGIS + Socket.IO + node-cron + twilio/FCM
├── mobile-app/         # React Native (Android) Redux + Google Maps + webrtc VoIP + react-native-sensors
├── firmware/           # ESP32 C++ Sketch + GPS (NEO-6M) + GPRS/MQTT (SIM7000) + Accelerometer (MPU6050)
└── documentation/      # Step-by-step installation, testing, and deployment guidelines
```

---

## 🚀 Quick Start Guide

### 1. Database Setup (PostgreSQL + PostGIS)
KidSafe utilizes PostGIS spatial geographical types to run fast geofence intersection queries.
1. Install PostgreSQL and the PostGIS extension on your server.
2. Create a new database:
   ```sql
   CREATE DATABASE kids_location_tracker;
   ```
3. Sync the tables by running the backend server. The Sequelize ORM will automatically run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
   and generate all tables and relationship schemas.

### 2. Run the Express Backend
1. Go to the backend folder:
   ```bash
   cd backend
   ```
2. Copy `.env.example` to `.env` and fill in your parameters:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start in development mode (using nodemon):
   ```bash
   npm run dev
   ```

### 3. Run the React Native Mobile App
1. Go to the mobile app folder:
   ```bash
   cd mobile-app
   ```
2. Copy `.env.example` to `.env` and adjust the API URLs (defaults are configured for Android Emulator loopback):
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build and run on Android Emulator/Device:
   ```bash
   npm run android
   ```
   *(Ensure Android SDK is configured. Use verification codes `1234` or `123456` to bypass OTP walls during local testing).*

### 4. Build ESP32 Firmware
1. Open the [main.ino](file:///d:/Loaction_tracker/firmware/main/main.ino) file in your Arduino IDE or PlatformIO.
2. Edit [config.h](file:///d:/Loaction_tracker/firmware/main/config.h) to configure APN cellular credentials and MQTT brokers.
3. Flash the binary to your ESP32 board. Connect the NEO-6M GPS, SIM7000 LTE shield, and MPU6050 accelerometer to the configured pins.

---

## 📖 Deep-Dive Guides & Documentation

To proceed with configurations, review the following guides:
- 🛠️ [Setup & Installation Instructions](file:///d:/Loaction_tracker/documentation/setup_guide.md)
- 🧪 [System Integration Testing Guide](file:///d:/Loaction_tracker/documentation/testing_guide.md)
- 🌐 [API Endpoint Specifications](file:///d:/Loaction_tracker/documentation/api_docs.md)
- ☁️ [Backend Deployment & APK Build Guide](file:///d:/Loaction_tracker/documentation/deployment_guide.md)

---

## 🔒 Security Auditing

- **Edit Sessions**: Contact list editing is protected by a 5-minute security window verified by a one-time SMS passcode. All changes are logged into the `edit_sessions` table with Parent IP addresses and device browser strings for full audit tracing.
- **Hardware Authorization Lock**: Tracking devices can register a maximum of 2 parental phone numbers (Slot 1 and Slot 2). Any unauthorized device attempting to intercept telemetry triggers SMS warning logs and automatically locks down the tracker.
