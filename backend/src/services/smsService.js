require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

let client = null;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
} else {
  console.warn('Twilio SID or Auth Token missing. SMS service running in MOCK mode.');
}

const sendSMS = async (to, message) => {
  try {
    if (client) {
      const response = await client.messages.create({
        body: message,
        from: fromPhone,
        to: to
      });
      console.log(`Twilio SMS successfully dispatched to ${to}. Message SID: ${response.sid}`);
      return response;
    } else {
      console.log(`[MOCK SMS] Dispatching to ${to}: "${message}"`);
      return { sid: 'mock-sms-sid-101', success: true };
    }
  } catch (err) {
    console.error(`Failed to dispatch Twilio SMS to ${to}:`, err);
    throw err;
  }
};

// Localized emergency SMS templates helper
const templates = {
  sos: {
    en: (child, url) => `EMERGENCY ALERT: SOS triggered by child ${child}. Live tracking coordinate link: ${url}`,
    hi: (child, url) => `आपातकालीन चेतावनी: बच्चे ${child} द्वारा एसओएस ट्रिगर किया गया है। लाइव ट्रैकिंग लिंक: ${url}`
  },
  geofence_entry: {
    en: (child, zone) => `SAFETY NOTICE: ${child} has safely entered the geofenced area: ${zone}.`,
    hi: (child, zone) => `सुरक्षा सूचना: ${child} सुरक्षित रूप से जियोफेंस क्षेत्र: ${zone} में प्रवेश कर गया है।`
  },
  geofence_exit: {
    en: (child, zone) => `SAFETY ALERT: ${child} has exited the geofenced area: ${zone}.`,
    hi: (child, zone) => `सुरक्षा चेतावनी: ${child} जियोफेंस क्षेत्र: ${zone} से बाहर चला गया है।`
  },
  speed: {
    en: (child, limit, detected) => `SPEED NOTICE: ${child} has crossed speed threshold of ${limit} km/h (Detected: ${detected} km/h).`,
    hi: (child, limit, detected) => `गति सूचना: ${child} ने गति सीमा ${limit} किमी/घंटा पार कर ली है (दर्ज की गई गति: ${detected} किमी/घंटा)।`
  },
  battery: {
    en: (child, percent) => `BATTERY WARNING: Paired device for ${child} is running extremely low (${percent}% battery left).`,
    hi: (child, percent) => `बैटरी चेतावनी: ${child} का डिवाइस चार्ज बहुत कम है (${percent}% बैटरी बची है)।`
  },
  device_off: {
    en: (child, url) => `DEVICE SHUTDOWN: Paired device for ${child} has shut down. Last known location map link: ${url}`,
    hi: (child, url) => `डिवाइस बंद: ${child} का ट्रैकिंग डिवाइस बंद हो गया है। आखिरी स्थान का लिंक: ${url}`
  },
  tamper: {
    en: (child) => `TAMPER ALERT: Paired tracking device for ${child} case has been opened or the SIM card was modified.`,
    hi: (child) => `छेड़छाड़ चेतावनी: ${child} के ट्रैकिंग डिवाइस के साथ छेड़छाड़ की गई है (सिम कार्ड निकाला गया या केस खोला गया)।`
  }
};

const sendAlertSMS = async ({ to, lang, type, childName, data }) => {
  const selectedLang = lang === 'hindi' ? 'hi' : 'en';
  const getMsg = templates[type]?.[selectedLang];
  if (!getMsg) return;

  let message = '';
  if (type === 'sos' || type === 'device_off') {
    const url = `https://maps.google.com/?q=${data.latitude},${data.longitude}`;
    message = getMsg(childName, url);
  } else if (type === 'geofence_entry' || type === 'geofence_exit') {
    message = getMsg(childName, data.zoneName);
  } else if (type === 'speed') {
    message = getMsg(childName, data.limit, data.detected);
  } else if (type === 'battery') {
    message = getMsg(childName, data.percent);
  } else if (type === 'tamper') {
    message = getMsg(childName);
  }

  return sendSMS(to, message);
};

module.exports = {
  sendSMS,
  sendAlertSMS
};
