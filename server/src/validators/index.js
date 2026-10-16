const { body, query, param } = require('express-validator');

const loginValidator = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const registerValidator = [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['ADMIN', 'CASHIER']).withMessage('Invalid role'),
];

const updateUserValidator = [
  body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Email must be valid'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['ADMIN', 'CASHIER']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
];

const productValidator = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('barcode').trim().notEmpty().withMessage('Barcode is required'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be a non-negative number'),
  body('costPrice').isFloat({ min: 0 }).withMessage('Cost price must be a non-negative number'),
  body('stockQuantity').optional().isFloat({ min: 0 }).withMessage('Stock quantity must be a non-negative number'),
  body('minStockLevel').optional().isFloat({ min: 0 }).withMessage('Minimum stock level must be a non-negative number'),
  body('unit').optional().trim(),
  body('categoryId').optional({ nullable: true }),
];

const checkoutValidator = [
  body('offlineId').optional().isString().isLength({ min: 8, max: 100 }).withMessage('Invalid offline sale reference'),
  body('items').isArray({ min: 1 }).withMessage('Cart must contain at least 1 item'),
  body('items.*.productId').notEmpty().withMessage('Each item must have a valid productId'),
  body('items.*.quantity').isFloat({ min: 0.001 }).withMessage('Quantity must be greater than zero'),
  body('items.*.discount').optional().isFloat({ min: 0 }).withMessage('Discount cannot be negative'),
  body('paymentMethod').isIn(['CASH', 'GCASH', 'MAYA', 'OTHER']).withMessage('Invalid payment method'),
  body('amountTendered').isFloat({ min: 0 }).withMessage('Amount tendered must be a non-negative number'),
  body('orderDiscount').optional().isFloat({ min: 0 }).withMessage('Order discount must be non-negative'),
];

const stockAdjustmentValidator = [
  body('productId').notEmpty().withMessage('Product ID is required'),
  body('type').isIn(['RESTOCK', 'MANUAL_ADJUSTMENT', 'DAMAGE', 'EXPIRED']).withMessage('Invalid movement type'),
  body('quantity').isFloat({ min: 0.001 }).withMessage('Quantity must be greater than 0'),
  body('reason').trim().notEmpty().withMessage('Adjustment reason is required'),
];

const refundValidator = [
  body('saleId').notEmpty().withMessage('Sale ID is required'),
  body('reason').trim().notEmpty().withMessage('Refund reason is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item must be refunded'),
  body('items.*.productId').notEmpty().withMessage('Each refund item must have a product ID'),
  body('items.*.quantity').isFloat({ min: 0.001 }).withMessage('Refund quantity must be greater than zero'),
  body('restockItems').optional().isBoolean(),
];

module.exports = {
  loginValidator,
  registerValidator,
  updateUserValidator,
  productValidator,
  checkoutValidator,
  stockAdjustmentValidator,
  refundValidator,
};
