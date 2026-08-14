const express = require('express');
const router = express.Router();
const geofenceController = require('../controllers/geofenceController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/create', authMiddleware, geofenceController.createGeofence);
router.put('/update/:id', authMiddleware, geofenceController.updateGeofence);
router.delete('/delete/:id', authMiddleware, geofenceController.deleteGeofence);
router.get('/list/:childId', authMiddleware, geofenceController.listGeofences);

module.exports = router;
