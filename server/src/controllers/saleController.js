const prisma = require('../config/db');
const { processCheckout } = require('../services/saleService');
const { createAuditLog } = require('../services/auditService');
const { generateRefundNumber } = require('../utils/formatters');

// Process new POS checkout
exports.checkout = async (req, res, next) => {
  try {
    const { items, orderDiscount, paymentMethod, amountTendered, paymentReference, notes, offlineId } = req.body;

    const sale = await processCheckout({
      cashierId: req.user.id,
      userRole: req.user.role,
      items,
      orderDiscount,
      paymentMethod,
      amountTendered,
      paymentReference,
      notes,
      offlineId,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Transaction completed successfully.',
      data: sale,
    });
  } catch (error) {
    next(error);
  }
};

// Get sales transactions list with pagination and filters
exports.getSales = async (req, res, next) => {
  try {
    const { search, paymentMethod, status, startDate, endDate, limit = 50, page = 1 } = req.query;

    const where = {};

    if (search && search.trim()) {
      where.transactionNumber = { contains: search.trim(), mode: 'insensitive' };
    }
    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }
    if (status) {
      where.status = status;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid start date.' });
        }
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid end date.' });
        }
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const take = Math.min(parseInt(limit, 10) || 50, 100);
    const skip = ((parseInt(page, 10) || 1) - 1) * take;

    const [sales, totalCount] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          cashier: {
            select: { id: true, fullName: true, username: true },
          },
          items: true,
          payments: true,
          refunds: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.sale.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        sales,
        total: totalCount,
        page: parseInt(page, 10) || 1,
        pages: Math.ceil(totalCount / take),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single sale by ID or Transaction Number (for receipt print / view)
exports.getSaleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findFirst({
      where: {
        OR: [{ id }, { transactionNumber: id }],
      },
      include: {
        cashier: {
          select: { id: true, fullName: true, username: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, unit: true },
            },
          },
        },
        payments: true,
        refunds: true,
      },
    });

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale transaction not found.' });
    }

    const settings = await prisma.storeSettings.findFirst();

    res.json({
      success: true,
      data: {
        sale,
        store: settings,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Process Refund or Return
exports.processRefund = async (req, res, next) => {
  try {
    const { saleId, reason, items, restockItems = true } = req.body;

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true, refunds: { select: { amount: true, itemsJson: true } } },
    });

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found.' });
    }

    if (sale.status === 'REFUNDED') {
      return res.status(400).json({ success: false, message: 'This sale has already been fully refunded.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item must be refunded.' });
    }

    const previouslyRefunded = new Map();
    let previouslyRefundedTotal = 0;
    for (const refund of sale.refunds) {
      previouslyRefundedTotal += Number(refund.amount);
      const refundedItems = Array.isArray(refund.itemsJson) ? refund.itemsJson : [];
      for (const refundedItem of refundedItems) {
        const quantity = parseFloat(refundedItem.quantity);
        if (Number.isFinite(quantity)) {
          previouslyRefunded.set(
            refundedItem.productId,
            (previouslyRefunded.get(refundedItem.productId) || 0) + quantity
          );
        }
      }
    }

    const requested = new Map();
    for (const returnItem of items) {
      const quantity = parseFloat(returnItem.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Refund quantities must be greater than zero.' });
      }
      requested.set(returnItem.productId, (requested.get(returnItem.productId) || 0) + quantity);
    }

    // Calculate refund amount and prevent cumulative over-refunds.
    let refundTotal = 0;
    const saleItemMap = new Map();
    sale.items.forEach((item) => saleItemMap.set(item.productId, item));

    for (const [productId, qty] of requested) {
      const orig = saleItemMap.get(productId);
      if (!orig) {
        return res.status(400).json({
          success: false,
          message: `Product was not part of this sale.`,
        });
      }
      const alreadyRefunded = previouslyRefunded.get(productId) || 0;
      if (alreadyRefunded + qty > Number(orig.quantity) + 0.000001) {
        return res.status(400).json({
          success: false,
          message: `Invalid refund quantity for ${orig.productName}. Remaining refundable quantity: ${Math.max(0, Number(orig.quantity) - alreadyRefunded)}`,
        });
      }

      const itemRefundAmount = (Number(orig.lineTotal) / Number(orig.quantity)) * qty;
      refundTotal += itemRefundAmount;
    }

    refundTotal = Math.round((refundTotal + Number.EPSILON) * 100) / 100;
    if (previouslyRefundedTotal + refundTotal > Number(sale.totalAmount) + 0.01) {
      return res.status(400).json({ success: false, message: 'Refund amount exceeds the remaining refundable balance.' });
    }

    const normalizedItems = Array.from(requested, ([productId, quantity]) => ({ productId, quantity }));

    const refundNumber = generateRefundNumber();

    const refundRecord = await prisma.$transaction(async (tx) => {
      // 1. Restock items if selected
      if (restockItems) {
        for (const item of normalizedItems) {
          const quantity = item.quantity;
          const updated = await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: quantity } },
          });

          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: 'RETURN',
              quantity,
              balanceAfter: updated.stockQuantity,
              reason: `Refund ${refundNumber} for Sale ${sale.transactionNumber}`,
              userId: req.user.id,
              saleId: sale.id,
            },
          });
        }
      }

      // 2. Create Refund record
      const createdRefund = await tx.refund.create({
        data: {
          refundNumber,
          saleId: sale.id,
          userId: req.user.id,
          amount: refundTotal,
          reason,
          restockItems,
          itemsJson: normalizedItems,
        },
      });

      // 3. Mark sale status
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: previouslyRefundedTotal + refundTotal >= Number(sale.totalAmount) - 0.01 ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });

      return createdRefund;
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'SALE_REFUNDED',
      entity: 'Refund',
      entityId: refundRecord.id,
      details: { saleTransactionNumber: sale.transactionNumber, refundTotal },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Refund processed successfully.',
      data: refundRecord,
    });
  } catch (error) {
    next(error);
  }
};
