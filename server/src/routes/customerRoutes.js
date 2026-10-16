const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/lookup', authenticate, customerController.lookup);
router.get('/points', customerController.pointsLookup);
router.get('/rewards', authenticate, requireRole('ADMIN'), customerController.listRewards);
router.post('/rewards', authenticate, requireRole('ADMIN'), customerController.createReward);
router.put('/rewards/:id', authenticate, requireRole('ADMIN'), customerController.updateReward);
router.delete('/rewards/:id', authenticate, requireRole('ADMIN'), customerController.deleteReward);
router.post('/redeem', authenticate, customerController.redeem);
router.get('/', authenticate, requireRole('ADMIN'), customerController.list);

module.exports = router;
