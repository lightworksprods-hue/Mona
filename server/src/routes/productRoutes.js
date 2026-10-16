const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const { productValidator } = require('../validators');

// Fast barcode lookup for scanner (Available to Cashier & Admin)
router.get('/barcode/generate', authenticate, requireRole('ADMIN'), productController.generateBarcode);
router.get('/barcode/:code', authenticate, productController.lookupBarcode);

// List products & search
router.get('/', authenticate, productController.getProducts);

// Single product
router.get('/:id', authenticate, productController.getProductById);

// Admin-only CRUD
router.post('/', authenticate, requireRole('ADMIN'), productValidator, validate, productController.createProduct);
router.put('/:id', authenticate, requireRole('ADMIN'), productController.updateProduct);
router.delete('/:id', authenticate, requireRole('ADMIN'), productController.deleteProduct);

module.exports = router;
