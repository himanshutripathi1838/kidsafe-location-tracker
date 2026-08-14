const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/list/:childId', authMiddleware, contactController.listContacts);
router.post('/edit-session/start', authMiddleware, contactController.startEditSession);
router.post('/edit-session/verify', authMiddleware, contactController.verifyEditSession);
router.post('/add', authMiddleware, contactController.addContact);
router.put('/update/:id', authMiddleware, contactController.updateContact);
router.delete('/delete/:id', authMiddleware, contactController.deleteContact);
router.post('/edit-session/save', authMiddleware, contactController.saveReorderedContacts);

module.exports = router;
