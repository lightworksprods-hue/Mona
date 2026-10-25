const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const { checkoutValidator, refundValidator } = require('../validators');

// Process Checkout (Cashier & Admin)
router.post('/checkout', authenticate, checkoutValidator, validate, saleController.checkout);

// Soft-archive all transaction and inventory movement history (cashier/admin).
router.delete('/all', authenticate, requireRole('ADMIN', 'CASHIER'), saleController.deleteAllTransactions);
router.get('/archived', authenticate, requireRole('SUPERADMIN'), saleController.getArchivedTransactions);
router.patch('/restore-all', authenticate, requireRole('SUPERADMIN'), saleController.restoreAllTransactions);

// Transaction History
router.get('/', authenticate, requireRole('ADMIN'), saleController.getSales);

// Sale Receipt / Details
router.get('/:id', authenticate, requireRole('ADMIN'), saleController.getSaleById);

// Refunds are an administrator-only action.
router.post(
  '/refund',
  authenticate,
  requireRole('ADMIN'),
  refundValidator,
  validate,
  saleController.processRefund
);

module.exports = router;
