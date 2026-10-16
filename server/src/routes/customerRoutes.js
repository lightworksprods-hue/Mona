const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate } = require('../middleware/auth');

router.get('/lookup', authenticate, customerController.lookup);

module.exports = router;
