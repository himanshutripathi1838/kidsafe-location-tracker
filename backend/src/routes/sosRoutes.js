const express = require('express');
const router = express.Router();
const sosController = require('../controllers/sosController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/trigger', sosController.triggerSOS); // SOS device trigger endpoint
router.post('/resolve/:alertId', authMiddleware, sosController.resolveSOS);
router.get('/history/:childId', authMiddleware, sosController.getSOSHistory);

module.exports = router;
