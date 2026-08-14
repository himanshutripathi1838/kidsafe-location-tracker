const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/daily/:childId', authMiddleware, reportController.getDailyReport);
router.get('/export', reportController.exportPDF); // Direct browser attachment download
router.get('/battery/:childId', authMiddleware, reportController.getBatteryHistory);

module.exports = router;
