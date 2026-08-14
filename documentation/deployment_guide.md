# KidSafe: Deployment & APK Compilation Guide

This guide explains how to compile the React Native Android application into a release APK, deploy the Node.js backend server to production, and resolve common issues.

---

## 📱 1. Android APK Build & Compilation

To build a standalone production APK for low-end Android devices:

### A. Pre-requisites
1. Ensure Java Development Kit (JDK 11 or 17) is installed and `JAVA_HOME` is set.
2. Ensure Android SDK is installed, and the environmental variables `ANDROID_HOME` are configured in your system paths.

### B. Generate a Signing Key
React Native requires a signing key to encrypt the release build:
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore my-upload-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```
Place the generated `my-upload-key.keystore` file inside the `mobile-app/android/app/` folder.

### C. Configure gradle.properties
Open `mobile-app/android/gradle.properties` and add:
```properties
MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=your_keystore_password
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```

### D. Compile Release Build
1. Go to the android directory:
   ```bash
   cd mobile-app/android
   ```
2. Clean gradle cache:
   ```bash
   ./gradlew clean
   ```
3. Assemble the release APK:
   ```bash
   ./gradlew assembleRelease
   ```
4. Once completed, your compiled, production-ready APK is generated under:
   `mobile-app/android/app/build/outputs/apk/release/app-release.apk`

---

## ☁️ 2. Production Backend Deployment

To deploy the Node.js Express server to a hosting instance (AWS EC2 / DigitalOcean Droplet):

### A. Install PM2 globally
PM2 is a production process manager that keeps your server running in the background and restarts it on crash or server reboot:
```bash
sudo npm install pm2 -g
```

### B. Deploy using PM2
1. Clone the project onto the server instance.
2. Create your production `.env` file containing real DB connection URLs and Twilio/FCM keys.
3. Start the application:
   ```bash
   pm2 start src/app.js --name "kidsafe-backend"
   ```
4. Ensure PM2 restarts on system boot:
   ```bash
   pm2 startup
   pm2 save
   ```

### C. Set up Nginx Reverse Proxy
To map incoming port 80/443 (HTTP/HTTPS) calls to your local Express port 5000:
1. Install Nginx:
   ```bash
   sudo apt install nginx
   ```
2. Configure site proxy (/etc/nginx/sites-available/default):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
3. Restart Nginx:
   ```bash
   sudo systemctl restart nginx
   ```

---

## 🛠️ 3. Troubleshooting Common Issues

### Issue A: Map is Blank on Mobile App
- **Cause**: Google Maps API Key is missing or does not have "Maps SDK for Android" enabled in the Google Cloud Console.
- **Fix**: Verify your Google Maps API Key in `AndroidManifest.xml` (or environmental variables) and make sure billing is enabled on Google Cloud.

### Issue B: Coordinates fail to update in the Background
- **Cause**: Android OS battery optimization has terminated the background thread.
- **Fix**: 
  1. Use `react-native-permissions` to request "Allow all the time" location permissions instead of "Only while using the app".
  2. Prompt the user to turn off battery optimization for the KidSafe App in Android System Settings.

### Issue C: PostGIS ST_Distance Errors on Backend
- **Cause**: PostGIS extension was not created inside the PostgreSQL database.
- **Fix**: Connect to the DB using pgAdmin or psql command-line client and execute:
  `CREATE EXTENSION IF NOT EXISTS postgis;`
