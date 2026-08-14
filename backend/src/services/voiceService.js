require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

let client = null;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

const triggerEmergencyCall = async (toPhone, childName, language = 'english') => {
  try {
    const isHindi = language.toLowerCase() === 'hindi';
    
    // Construct TwiML speech response (Voice RSS text-to-speech)
    const twimlMessage = isHindi
      ? `<Response><Say voice="alice" language="hi-IN">आपातकालीन एसओएस अलर्ट। आपके बच्चे ${childName} ने मदद के लिए पुकारा है। कृपया तुरंत अपनी मोबाइल एप्लीकेशन देखें।</Say></Response>`
      : `<Response><Say voice="alice" language="en-US">Emergency SOS Alert. Your child ${childName} has triggered an emergency alarm. Please check your mobile application immediately.</Say></Response>`;

    if (client) {
      const call = await client.calls.create({
        twiml: twimlMessage,
        to: toPhone,
        from: fromPhone,
      });
      console.log(`Twilio Emergency Voice Call placed to ${toPhone}. Call SID: ${call.sid}`);
      return call;
    } else {
      console.log(`[MOCK CALL] Auto-calling primary contact ${toPhone}: "Emergency SOS Alert for ${childName} (${language})"`);
      return { sid: 'mock-call-sid-999', success: true };
    }
  } catch (err) {
    console.error(`Failed to place Twilio emergency voice call to ${toPhone}:`, err);
    throw err;
  }
};

module.exports = {
  triggerEmergencyCall
};
