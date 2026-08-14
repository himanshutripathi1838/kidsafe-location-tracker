require('dotenv').config();
const Parent = require('../models/Parent');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendSMS } = require('../services/smsService');

// In-memory OTP storage for demonstration (can be replaced by Redis cache)
const otpCache = new Map();

// Helper to sign JWT
const generateToken = (id) => {
  return jwt.sign(
    { id }, 
    process.env.JWT_SECRET || 'YOUR_SUPER_SECRET_JWT_PASSPHRASE_HERE',
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
};

exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    // Generate a random 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Save in cache (expires in 5 minutes)
    otpCache.set(phone, {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    });

    const smsMessage = `KidSafe App: Your login OTP is ${otp}. Valid for 5 minutes.`;
    await sendSMS(phone, smsMessage);

    return res.status(200).json({ 
      success: true, 
      message: 'OTP sent successfully.', 
      debugOtp: process.env.NODE_ENV !== 'production' ? otp : undefined // return OTP in debug mode for testing
    });
  } catch (error) {
    console.error('Send OTP Controller Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required.' });
    }

    // Bypass OTP checking for mock testing if code matches 1234 or 123456
    const isMockBypass = otp === '1234' || otp === '123456';
    const cachedData = otpCache.get(phone);

    if (!isMockBypass) {
      if (!cachedData) {
        return res.status(400).json({ success: false, message: 'OTP expired or not requested.' });
      }

      if (Date.now() > cachedData.expires) {
        otpCache.delete(phone);
        return res.status(400).json({ success: false, message: 'OTP expired.' });
      }

      if (cachedData.otp !== otp) {
        return res.status(400).json({ success: false, message: 'Invalid OTP code.' });
      }

      // Valid OTP
      otpCache.delete(phone);
    }

    // Find or create parent
    let parent = await Parent.findOne({ where: { phone } });
    if (!parent) {
      // Return flag to client to register first if number not present
      // In this version, we will auto-register parents to make testing seamless
      parent = await Parent.create({
        name: `Parent ${phone.slice(-4)}`,
        phone: phone,
        is_active: true
      });
    }

    const token = generateToken(parent.id);

    return res.status(200).json({
      success: true,
      token,
      parent: {
        id: parent.id,
        name: parent.name,
        phone: parent.phone,
        email: parent.email,
        is_active: parent.is_active
      }
    });
  } catch (error) {
    console.error('Verify OTP Controller Error:', error);
    return res.status(500).json({ success: false, message: 'OTP verification failed.' });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone number are required.' });
    }

    // Check uniqueness
    const existing = await Parent.findOne({ where: { phone } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Phone number already registered. Please login.' });
    }

    const parent = await Parent.create({
      name,
      phone,
      email: email || null,
      is_active: true
    });

    const token = generateToken(parent.id);

    return res.status(201).json({
      success: true,
      token,
      parent: {
        id: parent.id,
        name: parent.name,
        phone: parent.phone,
        email: parent.email,
        is_active: parent.is_active
      }
    });
  } catch (error) {
    console.error('Register Controller Error:', error);
    return res.status(500).json({ success: false, message: 'Registration failed.' });
  }
};

exports.getMe = async (req, res) => {
  try {
    // req.user is populated by authMiddleware
    return res.status(200).json({
      success: true,
      parent: {
        id: req.user.id,
        name: req.user.name,
        phone: req.user.phone,
        email: req.user.email,
        is_active: req.user.is_active
      }
    });
  } catch (error) {
    console.error('GetMe Controller Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
};
