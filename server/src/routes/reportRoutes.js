const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const settingController = require('../controllers/settingController');
const { authenticate, requireRole } = require('../middleware/auth');

// Dashboard metrics (All logged-in staff can view quick counter metrics)
router.get('/dashboard', authenticate, reportController.getDashboardStats);

// Comprehensive financial & sales reports (Admin only)
router.get('/reports', authenticate, requireRole('ADMIN'), reportController.getReports);

// Store settings
router.get('/settings', authenticate, settingController.getSettings);
router.put('/settings', authenticate, requireRole('ADMIN'), settingController.updateSettings);
router.put('/system/status', authenticate, requireRole('SUPERADMIN'), settingController.updateSystemStatus);
router.put('/settings/limits', authenticate, requireRole('SUPERADMIN'), settingController.updateLimits);

// Audit logs (Admin only)
router.get('/audit-logs', authenticate, requireRole('ADMIN'), settingController.getAuditLogs);

module.exports = router;
