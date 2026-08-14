require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const credPath = process.env.FIREBASE_CREDENTIALS_PATH;

let isFirebaseInitialized = false;
if (credPath && fs.existsSync(path.resolve(credPath))) {
  try {
    const serviceAccount = require(path.resolve(credPath));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isFirebaseInitialized = true;
    console.log('Firebase Admin SDK initialized successfully for FCM.');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err);
  }
} else {
  console.warn('Firebase Service Account JSON file not found or path empty. FCM running in MOCK mode.');
}

const sendPush = async (token, title, body, data = {}) => {
  try {
    const message = {
      notification: { title, body },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      token: token
    };

    if (isFirebaseInitialized) {
      const response = await admin.messaging().send(message);
      console.log(`FCM Push Notification sent successfully. Message ID: ${response}`);
      return response;
    } else {
      console.log(`[MOCK FCM PUSH] Sent to Token: ${token} | Title: "${title}" | Body: "${body}"`);
      return { msgId: 'mock-fcm-id-1234', success: true };
    }
  } catch (err) {
    console.error('Failed to send FCM Push Notification:', err);
    throw err;
  }
};

const sendMulticastPush = async (tokens, title, body, data = {}) => {
  try {
    const validTokens = tokens.filter(t => t && t.trim() !== '');
    if (validTokens.length === 0) return;

    if (isFirebaseInitialized) {
      const response = await admin.messaging().sendEachForMulticast({
        notification: { title, body },
        data: {
          ...data,
          timestamp: new Date().toISOString()
        },
        tokens: validTokens
      });
      console.log(`FCM Multicast sent: ${response.successCount} succeeded, ${response.failureCount} failed.`);
      return response;
    } else {
      console.log(`[MOCK FCM MULTICAST] Sent to ${validTokens.length} Tokens | Title: "${title}" | Body: "${body}"`);
      return { successCount: validTokens.length, failureCount: 0 };
    }
  } catch (err) {
    console.error('Failed to send FCM Multicast notifications:', err);
    throw err;
  }
};

module.exports = {
  sendPush,
  sendMulticastPush
};
