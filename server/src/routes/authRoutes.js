const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const { loginValidator, registerValidator, updateUserValidator } = require('../validators');

// Public
router.post('/login', loginValidator, validate, authController.login);

// Protected
router.get('/me', authenticate, authController.getMe);

// Admin-only user management
router.get('/users', authenticate, requireRole('ADMIN'), authController.getUsers);
router.post('/users', authenticate, requireRole('ADMIN'), registerValidator, validate, authController.createUser);
router.put('/users/:id', authenticate, requireRole('ADMIN'), updateUserValidator, validate, authController.updateUser);

module.exports = router;
