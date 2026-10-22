const express = require('express');
const router = express.Router();
const cashController = require('../controllers/cashController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('ADMIN', 'CASHIER'));
router.get('/current', cashController.getCurrent);
router.get('/history', cashController.getHistory);
router.post('/open-hardware', cashController.openHardware);
router.post('/open', cashController.openSession);
router.post('/movement', cashController.addMovement);
router.post('/close', cashController.closeSession);

module.exports = router;
