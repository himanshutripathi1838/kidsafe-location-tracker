const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/update', locationController.updateLocation); // Device ping endpoint
router.get('/live/:childId', authMiddleware, locationController.getLiveLocation);
router.get('/history/:childId', authMiddleware, locationController.getLocationHistory);

module.exports = router;
