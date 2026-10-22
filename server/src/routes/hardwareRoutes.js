const express = require('express');
const router = express.Router();
const hardwareController = require('../controllers/hardwareController');
const { authenticate, requireRole } = require('../middleware/auth');

router.post('/open-drawer', authenticate, requireRole('ADMIN', 'CASHIER'), hardwareController.requestOpenDrawer);
router.get('/bridge/commands/next', hardwareController.getNextCommand);
router.post('/bridge/commands/:id/result', hardwareController.completeCommand);

module.exports = router;
