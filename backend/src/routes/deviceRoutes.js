const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/pair', authMiddleware, deviceController.pairDevice);
router.post('/authorize', authMiddleware, deviceController.authorizePhone);
router.get('/status/:deviceId', authMiddleware, deviceController.getDeviceStatus);
router.post('/lock', authMiddleware, deviceController.lockDevice);
router.post('/unlock', authMiddleware, deviceController.unlockDevice);

module.exports = router;
