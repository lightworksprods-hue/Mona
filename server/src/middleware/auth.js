const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'development-only-pos-secret');

// Middleware to verify JWT token
const authenticate = async (req, res, next) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Server authentication is not configured.' });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role === 'CASHIER') {
      const requestDeviceId = req.headers['x-device-id'];
      if (!requestDeviceId || requestDeviceId !== decoded.deviceId) {
        return res.status(403).json({ success: false, code: 'DEVICE_MISMATCH', message: 'This cashier session is not valid for this device.' });
      }

      const device = await prisma.authorizedDevice.findUnique({
        where: { deviceKey: decoded.deviceId },
        select: { isAuthorized: true },
      });
      if (!device?.isAuthorized) {
        return res.status(403).json({ success: false, code: 'DEVICE_NOT_AUTHORIZED', message: 'This device is no longer authorized for cashier access.' });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User account is invalid or deactivated.' });
    }

    const settings = await prisma.storeSettings.findFirst({ select: { systemActive: true } });
    if (settings && !settings.systemActive && user.role !== 'SUPERADMIN') {
      return res.status(503).json({ success: false, code: 'SYSTEM_DEACTIVATED', message: 'The POS system is currently deactivated. Contact the superadmin.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
};

// Middleware to authorize specific roles (e.g. 'ADMIN')
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const isSuperadminAdminAccess = req.user.role === 'SUPERADMIN' && roles.includes('ADMIN');
    if (!roles.includes(req.user.role) && !isSuperadminAdminAccess) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Requires one of: ${roles.join(', ')}`,
      });
    }
    next();
  };
};

module.exports = {
  authenticate,
  requireRole,
};
