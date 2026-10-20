const prisma = require('../config/db');
const { createAuditLog } = require('../services/auditService');

// Get inventory summary: low stock, out of stock, valuation
exports.getInventorySummary = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        costPrice: true,
        sellingPrice: true,
        stockQuantity: true,
        minStockLevel: true,
        unit: true,
      },
    });

    let totalValuationCost = 0;
    let totalValuationRetail = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    const lowStockItems = [];

    for (const p of products) {
      const stock = Number(p.stockQuantity);
      const cost = Number(p.costPrice);
      const retail = Number(p.sellingPrice);

      totalValuationCost += stock * cost;
      totalValuationRetail += stock * retail;

      if (stock <= 0) {
        outOfStockCount++;
        lowStockItems.push({ ...p, status: 'OUT_OF_STOCK' });
      } else if (stock <= p.minStockLevel) {
        lowStockCount++;
        lowStockItems.push({ ...p, status: 'LOW_STOCK' });
      }
    }

    res.json({
      success: true,
      data: {
        totalProducts: products.length,
        outOfStockCount,
        lowStockCount,
        totalValuationCost,
        totalValuationRetail,
        potentialProfit: totalValuationRetail - totalValuationCost,
        lowStockItems,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Stock adjustment (Restock, damage, expired, manual correction)
exports.adjustStock = async (req, res, next) => {
  try {
    const { productId, type, quantity, reason } = req.body;
    const movementReason = reason?.trim() || `Stock update: ${type.replace('_', ' ').toLowerCase()}`;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be greater than zero.' });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Determine increment or decrement
    let change = qty;
    if (type === 'DAMAGE' || type === 'EXPIRED') {
      change = -qty;
      if (Number(product.stockQuantity) < qty) {
        return res.status(400).json({
          success: false,
          message: `Cannot deduct ${qty}. Only ${product.stockQuantity} currently in stock.`,
        });
      }
    } else if (type === 'MANUAL_ADJUSTMENT') {
      // A manual adjustment is an absolute stock count, not an amount to add.
      // Example: current stock 50, entered count 70 => change is +20.
      change = qty - Number(product.stockQuantity);
      if (Number(product.stockQuantity) + change < 0) {
        return res.status(400).json({
          success: false,
          message: `Stock balance cannot be negative. Current stock is ${product.stockQuantity}.`,
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.product.updateMany({
        where: {
          id: productId,
          ...(change < 0 ? { stockQuantity: { gte: Math.abs(change) } } : {}),
        },
        data: { stockQuantity: { increment: change } },
      });

      if (updateResult.count !== 1) {
        throw new Error('Inventory changed while this adjustment was being saved. Please try again.');
      }

      const p = await tx.product.findUnique({ where: { id: productId } });

      const movement = await tx.inventoryMovement.create({
        data: {
          productId,
          type,
          quantity: change,
          balanceAfter: p.stockQuantity,
          reason: movementReason,
          userId: req.user.id,
        },
        include: {
          user: { select: { fullName: true, username: true } },
          product: { select: { name: true, sku: true, barcode: true } },
        },
      });

      return { product: p, movement };
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'STOCK_ADJUSTED',
      entity: 'Product',
      entityId: productId,
      details: { type, change, reason: movementReason, newBalance: updated.product.stockQuantity },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Stock adjusted successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Get inventory movements log (Audit trail)
exports.getMovements = async (req, res, next) => {
  try {
    const { productId, type, limit = 100, page = 1 } = req.query;

    const where = {};
    if (productId) where.productId = productId;
    if (type) where.type = type;

    const take = Math.min(parseInt(limit, 10) || 100, 200);
    const skip = ((parseInt(page, 10) || 1) - 1) * take;

    const [movements, count] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true, barcode: true, unit: true } },
          user: { select: { fullName: true, username: true } },
          sale: { select: { transactionNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        movements,
        total: count,
        page: parseInt(page, 10) || 1,
        pages: Math.ceil(count / take),
      },
    });
  } catch (error) {
    next(error);
  }
};
