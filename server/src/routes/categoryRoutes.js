const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, categoryController.getCategories);
router.post('/', authenticate, requireRole('ADMIN'), categoryController.createCategory);
router.put('/:id', authenticate, requireRole('ADMIN'), categoryController.updateCategory);
router.delete('/:id', authenticate, requireRole('ADMIN'), categoryController.deleteCategory);

module.exports = router;
