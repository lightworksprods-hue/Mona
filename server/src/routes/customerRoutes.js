const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/lookup', authenticate, customerController.lookup);
router.get('/', authenticate, requireRole('ADMIN'), customerController.list);

module.exports = router;
