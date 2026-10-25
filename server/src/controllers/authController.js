const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { createAuditLog } = require('../services/auditService');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'development-only-pos-secret');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

// Cashier & Admin Login
exports.login = async (req, res, next) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Server authentication is not configured.' });
    }
    const { username, password, deviceId, deviceName } = req.body;

    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length < 16) {
      return res.status(400).json({ success: false, message: 'This device is missing a valid device ID. Refresh the page and try again.' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or account is deactivated.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    const systemSettings = await prisma.storeSettings.findFirst({ select: { systemActive: true } });
    if (systemSettings && !systemSettings.systemActive && user.role !== 'SUPERADMIN') {
      return res.status(503).json({ success: false, code: 'SYSTEM_DEACTIVATED', message: 'The POS system is currently deactivated. Contact the superadmin.' });
    }

    const deviceKey = deviceId.trim();
    let device = await prisma.authorizedDevice.findUnique({ where: { deviceKey } });
    if (!device) {
      device = await prisma.authorizedDevice.create({
        data: {
          deviceKey,
          name: String(deviceName || 'Unnamed POS device').trim().slice(0, 100) || 'Unnamed POS device',
          lastSeenAt: new Date(),
        },
      });
    } else {
      device = await prisma.authorizedDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });
    }

    if (user.role === 'CASHIER' && !device.isAuthorized) {
      return res.status(403).json({
        success: false,
        code: 'DEVICE_NOT_AUTHORIZED',
        message: 'This device is not authorized for cashier login. Ask an administrator to approve it.',
        data: { deviceId: device.deviceKey, deviceName: device.name },
      });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, deviceId: deviceKey },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await createAuditLog({
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Admin: list devices that have attempted to access the POS.
exports.getDevices = async (req, res, next) => {
  try {
    const devices = await prisma.authorizedDevice.findMany({ orderBy: [{ isAuthorized: 'asc' }, { updatedAt: 'desc' }] });
    res.json({ success: true, data: devices });
  } catch (error) {
    next(error);
  }
};

// Admin: authorize/revoke and rename a POS device.
exports.updateDevice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, isAuthorized } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name).trim().slice(0, 100) || 'Unnamed POS device';
    if (isAuthorized !== undefined) data.isAuthorized = Boolean(isAuthorized);

    const device = await prisma.authorizedDevice.update({ where: { id }, data });
    await createAuditLog({
      userId: req.user.id,
      action: device.isAuthorized ? 'DEVICE_AUTHORIZED' : 'DEVICE_REVOKED',
      entity: 'AuthorizedDevice',
      entityId: device.id,
      details: { name: device.name, deviceKey: device.deviceKey },
      ipAddress: req.ip,
    });
    res.json({ success: true, message: device.isAuthorized ? 'Device authorized.' : 'Device access revoked.', data: device });
  } catch (error) {
    next(error);
  }
};

// Get current profile
exports.getMe = async (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
};

// Admin: List all users
exports.getUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { not: 'SUPERADMIN' } },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

// Admin: Create new user (Cashier or Admin)
exports.createUser = async (req, res, next) => {
  try {
    const { username, fullName, email, password, role = 'CASHIER' } = req.body;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username }, ...(email ? [{ email }] : [])],
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already in use.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        username,
        fullName,
        email: email || null,
        passwordHash,
        role,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user.id,
      details: { username, role },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Toggle active state or update role
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, isActive, password } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, username: true } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (targetUser.role === 'SUPERADMIN' && req.user.role !== 'SUPERADMIN') {
      return res.status(403).json({ success: false, code: 'SUPERADMIN_PROTECTED', message: 'The superadmin account can only be managed by a superadmin.' });
    }

    const dataToUpdate = {};
    if (fullName !== undefined) dataToUpdate.fullName = fullName;
    if (email !== undefined) dataToUpdate.email = email || null;
    if (role !== undefined) dataToUpdate.role = role;
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);

    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.passwordHash = await bcrypt.hash(password, salt);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'User updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
