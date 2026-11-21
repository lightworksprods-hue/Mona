const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const settingController = require('../controllers/settingController');
const { authenticate, requireRole } = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');

// Dashboard metrics (All logged-in staff can view quick counter metrics)
router.get('/dashboard', authenticate, reportController.getDashboardStats);

// Comprehensive financial & sales reports (Admin only)
router.get('/reports', authenticate, requireRole('ADMIN'), reportController.getReports);

// Store settings
router.get('/settings', authenticate, settingController.getSettings);
router.put('/settings', authenticate, requireRole('ADMIN'), settingController.updateSettings);
router.put('/system/status', authenticate, requireRole('SUPERADMIN'), settingController.updateSystemStatus);
router.put('/settings/limits', authenticate, requireRole('SUPERADMIN'), settingController.updateLimits);
router.get('/subscription/status', authenticate, subscriptionController.getStatus);
router.get('/subscription/payments', authenticate, requireRole('SUPERADMIN'), subscriptionController.getPayments);
router.post('/subscription/payments', authenticate, requireRole('SUPERADMIN'), subscriptionController.recordPayment);

module.exports = router;
