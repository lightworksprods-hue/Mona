const prisma = require('../config/db');
const { createAuditLog } = require('../services/auditService');

// Get current store settings
exports.getSettings = async (req, res, next) => {
  try {
    let settings = await prisma.storeSettings.findFirst();
    if (!settings) {
      settings = await prisma.storeSettings.create({
        data: {
          storeName: 'MONA',
          storeAddress: '123 Market Avenue, Metro Manila',
          phone: '+63 912 345 6789',
          taxRate: 0.00,
          currencySymbol: '₱',
          receiptFooter: 'Thank you for shopping at MONA! Please come again.',
          receiptPaperWidth: '80mm',
          loyaltyPointsPerHundred: 1.00,
        },
      });
    } else if (settings.storeName === 'Metro Pink Supermart') {
      // Migrate databases created with the original demo store name.
      settings = await prisma.storeSettings.update({
        where: { id: settings.id },
        data: {
          storeName: 'MONA',
          receiptFooter: 'Thank you for shopping at MONA! Please come again.',
        },
      });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

// Update store settings (Admin only)
exports.updateSettings = async (req, res, next) => {
  try {
    const { storeName, storeAddress, phone, taxRate, currencySymbol, receiptFooter, receiptPaperWidth, loyaltyPointsPerHundred } = req.body;

    let settings = await prisma.storeSettings.findFirst();
    const data = {};
    if (storeName !== undefined) data.storeName = storeName.trim();
    if (storeAddress !== undefined) data.storeAddress = storeAddress.trim();
    if (phone !== undefined) data.phone = phone.trim();
    if (taxRate !== undefined) data.taxRate = parseFloat(taxRate) || 0;
    if (currencySymbol !== undefined) data.currencySymbol = currencySymbol.trim();
    if (receiptFooter !== undefined) data.receiptFooter = receiptFooter.trim();
    if (receiptPaperWidth !== undefined && ['58mm', '80mm', 'A4'].includes(receiptPaperWidth)) data.receiptPaperWidth = receiptPaperWidth;
    if (loyaltyPointsPerHundred !== undefined) data.loyaltyPointsPerHundred = Math.max(0, parseFloat(loyaltyPointsPerHundred) || 0);

    if (settings) {
      settings = await prisma.storeSettings.update({
        where: { id: settings.id },
        data,
      });
    } else {
      settings = await prisma.storeSettings.create({ data });
    }

    await createAuditLog({
      userId: req.user.id,
      action: 'SETTINGS_UPDATED',
      entity: 'StoreSettings',
      entityId: settings.id,
      details: data,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Store settings saved successfully.', data: settings });
  } catch (error) {
    next(error);
  }
};

// View audit logs (Admin only)
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const take = Math.min(parseInt(limit, 10) || 50, 100);
    const skip = ((parseInt(page, 10) || 1) - 1) * take;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: {
          user: { select: { fullName: true, username: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.auditLog.count(),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        total,
        page: parseInt(page, 10) || 1,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
};
