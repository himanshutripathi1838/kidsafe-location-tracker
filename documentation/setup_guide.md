# KidSafe: Setup & Configurations Manual

This guide explains how to configure database systems, Twilio telephony, and Firebase Cloud Messaging (FCM) credentials.

---

## 💾 1. PostgreSQL & PostGIS Database Installation

KidSafe utilizes PostgreSQL with the PostGIS spatial data extension. Follow these instructions:

### For Windows:
1. Download the PostgreSQL installer from the [PostgreSQL Official Website](https://www.postgresql.org/download/windows/).
2. Run the installer. Ensure you check the box to install **pgAdmin** and **Stack Builder**.
3. Once installation completes, launch **Stack Builder**.
4. Select your PostgreSQL installation from the dropdown, expand **Spatial Extensions**, and choose **PostGIS**. Follow the installer prompts to complete installation.
5. Open pgAdmin, connect to your server, and create a database named `kids_location_tracker`.
6. Run the following SQL query to verify the PostGIS installation:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   SELECT PostGIS_Version();
   ```

### For Ubuntu / Linux:
1. Install PostgreSQL and PostGIS:
   ```bash
   sudo apt update
   sudo apt install postgresql postgresql-contrib postgis postgresql-15-postgis-3
   ```
2. Switch to the postgres user and launch psql:
   ```bash
   sudo -i -u postgres psql
   ```
3. Create the database:
   ```sql
   CREATE DATABASE kids_location_tracker;
   \c kids_location_tracker;
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

---

## 🔔 2. Firebase Push Notifications (FCM) Setup

To configure push notifications for the parent mobile app:

1. Open the [Firebase Console](https://console.firebase.google.com/) and click **Add Project**. Follow the prompts to create your project.
2. Once created, click on the **Project Settings** (gear icon) in the sidebar.
3. Go to the **Service Accounts** tab.
4. Click **Generate New Private Key** at the bottom of the page. This downloads a JSON file containing your service account credentials.
5. Move this JSON file to your backend directory under:
   `backend/src/config/firebase-service-account.json`
6. In your backend `.env` file, configure the path to match:
   `FIREBASE_CREDENTIALS_PATH=./src/config/firebase-service-account.json`
7. In the Firebase settings, copy your **Sender ID** (found under the Cloud Messaging tab).
8. Put this Sender ID in your React Native app configuration or `.env` file under `FIREBASE_SENDER_ID`.

---

## 📞 3. Twilio Telephony (SMS & Voice Call) Setup

Twilio processes emergency phone calls and SMS telemetry alerts:

1. Sign up/Log in to the [Twilio Console](https://www.twilio.com/console).
2. Copy your **Account SID** and **Auth Token** from the console dashboard.
3. Paste these values in the backend `.env` file:
   ```env
   TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   TWILIO_AUTH_TOKEN=your_real_auth_token_here
   ```
4. Purchase an SMS & Voice-enabled phone number from the Twilio Console (under Phone Numbers > Manage > Buy a number).
5. Add this number to your backend `.env`:
   ```env
   TWILIO_PHONE_NUMBER=+12345678901
   ```

### Twilio Voice TwiML Explanation:
When a child triggers an SOS alarm, the backend calls the parent phone number. When the parent answers the call, Twilio executes TwiML markup instructions generated dynamically by our backend routes:
```xml
<Response>
  <Say voice="alice" language="en-US">
    Emergency SOS Alert. Your child Aarav Singh has triggered an emergency alarm. Please check your mobile application immediately.
  </Say>
</Response>
```
The caller voice parses child names dynamically and relays it instantly.
