const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const { stockAdjustmentValidator } = require('../validators');

// Inventory valuation & low-stock alerts
router.get('/summary', authenticate, inventoryController.getInventorySummary);

// Stock adjustment (Restock, damage, expired, manual count)
router.post('/adjust', authenticate, requireRole('ADMIN'), stockAdjustmentValidator, validate, inventoryController.adjustStock);

// Inventory movement history log
router.get('/movements', authenticate, inventoryController.getMovements);

module.exports = router;
