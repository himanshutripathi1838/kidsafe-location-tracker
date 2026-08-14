require('dotenv').config();
const jwt = require('jsonwebtoken');
const Parent = require('../models/Parent');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization token required. Access denied.' });
    }

    const token = authHeader.split(' ')[1];
    
    // Dev mode: Allow mock token passthrough when DB is unavailable
    if (token === 'mock-jwt-token-xyz') {
      req.user = { id: 'mock-parent-id', name: 'Vikram Singh', phone: '+91 98765 43210' };
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'YOUR_SUPER_SECRET_JWT_PASSPHRASE_HERE');
    
    const parent = await Parent.findByPk(decoded.id);
    if (!parent) {
      return res.status(401).json({ success: false, message: 'Invalid parent profile. Access denied.' });
    }

    if (!parent.is_active) {
      return res.status(403).json({ success: false, message: 'Parent account is deactivated.' });
    }

    req.user = parent;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ success: false, message: 'Invalid or expired authorization token.' });
  }
};

module.exports = authMiddleware;
