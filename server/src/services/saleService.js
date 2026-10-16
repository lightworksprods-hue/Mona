const prisma = require('../config/db');
const { roundMoney, generateTransactionNumber } = require('../utils/formatters');
const { createAuditLog } = require('./auditService');

function normalizePhone(phone) {
  return String(phone || '').trim().replace(/[\s()-]/g, '');
}

/**
 * Atomic checkout transaction
 * @param {Object} params
 * @param {string} params.cashierId - Cashier user ID
 * @param {string} params.userRole - Authenticated user's role
 * @param {Array<{productId: string, quantity: number, discount?: number, loyaltyRewardId?: string}>} params.items
 * @param {number} params.orderDiscount - Overall sale discount
 * @param {string} params.paymentMethod - CASH | GCASH | MAYA | OTHER
 * @param {number} params.amountTendered - Amount given by customer
 * @param {string} params.paymentReference - Reference for electronic payments
 * @param {string} params.notes - Optional notes
 * @param {string} params.customerPhone - Optional loyalty customer phone
 * @param {string} params.customerName - Optional loyalty customer name
 * @param {string} params.ipAddress - Client IP
 */
async function processCheckout({
  cashierId,
  userRole,
  items,
  orderDiscount = 0,
  paymentMethod = 'CASH',
  amountTendered = 0,
  paymentReference = null,
  notes = null,
  customerPhone = null,
  customerName = null,
  offlineId = null,
  ipAddress = null,
}) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw { status: 400, message: 'Cart cannot be empty for checkout.' };
  }

  if (offlineId) {
    const existingSale = await prisma.sale.findUnique({
      where: { offlineId },
      include: {
        items: true,
        payments: true,
        cashier: { select: { id: true, fullName: true, username: true } },
      },
    });
    if (existingSale) return existingSale;
  }

  if (userRole !== 'ADMIN') {
    const openDrawer = await prisma.cashSession.findFirst({
      where: { cashierId, status: 'OPEN' },
      select: { id: true },
    });

    if (!openDrawer) {
      throw {
        status: 409,
        code: 'CASH_DRAWER_REQUIRED',
        message: 'Open your cash drawer before processing a sale.',
      };
    }
  }

  // 1. Fetch store settings for global taxRate if applicable
  const storeSettings = await prisma.storeSettings.findFirst();
  const globalTaxRate = storeSettings ? Number(storeSettings.taxRate) : 0;
  const loyaltyRate = storeSettings ? Number(storeSettings.loyaltyPointsPerHundred || 0) : 0;
  const normalizedCustomerPhone = customerPhone ? normalizePhone(customerPhone) : null;
  if (normalizedCustomerPhone && normalizedCustomerPhone.length < 7) {
    throw { status: 400, message: 'Customer phone number must contain at least 7 digits.' };
  }

  // 2. Fetch all products in cart with current database pricing & stock
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
    },
  });

  const productMap = new Map();
  products.forEach((p) => productMap.set(p.id, p));

  const rewardIds = items.map((item) => item.loyaltyRewardId).filter(Boolean);
  const rewards = rewardIds.length > 0
    ? await prisma.loyaltyReward.findMany({ where: { id: { in: rewardIds } }, include: { product: true } })
    : [];
  const rewardMap = new Map(rewards.map((reward) => [reward.id, reward]));

  // 3. Pre-validate products: existence, active state, stock availability
  const validatedItems = [];
  let calculatedSubtotal = 0;
  let calculatedItemDiscountTotal = 0;

  for (const cartItem of items) {
    const product = productMap.get(cartItem.productId);
    if (!product) {
      throw { status: 400, message: `Product with ID ${cartItem.productId} does not exist.` };
    }
    if (!product.isActive) {
      throw { status: 400, message: `Product "${product.name}" is currently inactive.` };
    }

    const qty = parseFloat(cartItem.quantity);
    if (isNaN(qty) || qty <= 0) {
      throw { status: 400, message: `Invalid quantity for product "${product.name}". Must be greater than zero.` };
    }

    const reward = cartItem.loyaltyRewardId ? rewardMap.get(cartItem.loyaltyRewardId) : null;
    if (cartItem.loyaltyRewardId && (!reward || !reward.isActive || reward.productId !== product.id)) {
      throw { status: 400, message: `Invalid loyalty reward for "${product.name}".` };
    }
    if (reward && (!normalizedCustomerPhone || qty !== 1)) {
      throw { status: 400, message: 'A loyalty reward requires a customer phone number and quantity of one.' };
    }

    const freeQuantity = reward ? 0 : (product.buyOneTakeOne ? qty : 0);
    const stockQuantity = qty + freeQuantity;
    if (Number(product.stockQuantity) < stockQuantity) {
      throw {
        status: 400,
        message: `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Required: ${stockQuantity}`,
      };
    }

    const unitPrice = reward ? 0 : Number(product.sellingPrice);
    const costPrice = Number(product.costPrice);
    const itemDiscount = reward ? 0 : roundMoney(Number(cartItem.discount || 0));
    const lineTotal = roundMoney(unitPrice * qty - itemDiscount);

    if (lineTotal < 0) {
      throw { status: 400, message: `Discount cannot exceed item price for "${product.name}".` };
    }

    calculatedSubtotal += unitPrice * qty;
    calculatedItemDiscountTotal += itemDiscount;

    validatedItems.push({
      product,
      quantity: qty,
      freeQuantity,
      stockQuantity,
      unitPrice,
      costPrice,
      discount: itemDiscount,
      lineTotal,
      reward,
    });
  }

  calculatedSubtotal = roundMoney(calculatedSubtotal);
  calculatedItemDiscountTotal = roundMoney(calculatedItemDiscountTotal);
  const safeOrderDiscount = roundMoney(Number(orderDiscount || 0));

  if (safeOrderDiscount > calculatedSubtotal - calculatedItemDiscountTotal) {
    throw { status: 400, message: 'Order discount cannot exceed the subtotal after item discounts.' };
  }

  // Calculate tax if configured
  const taxableBase = Math.max(0, calculatedSubtotal - calculatedItemDiscountTotal - safeOrderDiscount);
  const calculatedTax = globalTaxRate > 0 ? roundMoney((taxableBase * globalTaxRate) / 100) : 0.00;
  const calculatedTotal = roundMoney(taxableBase + calculatedTax);
  const loyaltyPoints = normalizedCustomerPhone ? Math.floor((calculatedTotal / 100) * Math.max(0, loyaltyRate)) : 0;

  // Validate Payment
  const safeTendered = roundMoney(Number(amountTendered || 0));
  if (paymentMethod === 'CASH') {
    if (safeTendered < calculatedTotal) {
      throw {
        status: 400,
        message: `Amount tendered (₱${safeTendered.toFixed(2)}) is less than total payable (₱${calculatedTotal.toFixed(2)}).`,
      };
    }
  } else {
    // For electronic payments, default tendered to exact calculated total if not supplied
    if (safeTendered < calculatedTotal) {
      throw {
        status: 400,
        message: `Non-cash payment amount must at least cover the total due (₱${calculatedTotal.toFixed(2)}).`,
      };
    }
  }

  const changeDue = roundMoney(Math.max(0, safeTendered - calculatedTotal));
  const transactionNumber = generateTransactionNumber('POS');

  // 4. ATOMIC DATABASE TRANSACTION
  const result = await prisma.$transaction(async (tx) => {
    let customer = null;
    if (normalizedCustomerPhone) {
      customer = await tx.customer.upsert({
        where: { phone: normalizedCustomerPhone },
        update: customerName ? { fullName: String(customerName).trim().slice(0, 100) } : {},
        create: {
          phone: normalizedCustomerPhone,
          fullName: customerName ? String(customerName).trim().slice(0, 100) : null,
        },
      });
    }

    const rewardItems = validatedItems.filter((item) => item.reward);
    const rewardPoints = rewardItems.reduce((sum, item) => sum + item.reward.pointsCost, 0);
    if (rewardItems.length > 0) {
      if (!customer) throw { status: 400, message: 'A customer phone number is required to redeem points.' };
      const updatedCustomer = await tx.customer.updateMany({
        where: { id: customer.id, pointsBalance: { gte: rewardPoints } },
        data: { pointsBalance: { decrement: rewardPoints } },
      });
      if (updatedCustomer.count !== 1) throw { status: 400, message: 'Customer does not have enough points.' };
      for (const item of rewardItems) {
        await tx.loyaltyTransaction.create({
          data: { customerId: customer.id, type: 'REDEEM', points: -item.reward.pointsCost, note: `Redeemed ${item.product.name}` },
        });
        await tx.loyaltyRedemption.create({
          data: { customerId: customer.id, rewardId: item.reward.id, pointsSpent: item.reward.pointsCost },
        });
      }
    }

    // Re-check and atomically deduct stock for all items
    for (const item of validatedItems) {
      const updatedCount = await tx.product.updateMany({
        where: {
          id: item.product.id,
          stockQuantity: { gte: item.stockQuantity },
        },
        data: { stockQuantity: { decrement: item.stockQuantity } },
      });

      if (updatedCount.count !== 1) {
        const current = await tx.product.findUnique({
          where: { id: item.product.id },
          select: { stockQuantity: true },
        });
        throw new Error(
          `Inventory conflict: "${item.product.name}" stock changed. Current available: ${current ? current.stockQuantity : 0}. Checkout aborted.`
        );
      }

      const updatedProduct = await tx.product.findUnique({
        where: { id: item.product.id },
        select: { stockQuantity: true },
      });

      // Record inventory movement
      await tx.inventoryMovement.create({
        data: {
          productId: item.product.id,
          type: 'SALE',
          quantity: -item.stockQuantity,
          balanceAfter: updatedProduct.stockQuantity,
          reason: `Sale ${transactionNumber}`,
          userId: cashierId,
        },
      });
    }

    // Create Sale record
    const sale = await tx.sale.create({
      data: {
        transactionNumber,
        offlineId,
        cashierId,
        customerId: customer?.id || null,
        subtotal: calculatedSubtotal,
        itemDiscountTotal: calculatedItemDiscountTotal,
        orderDiscountTotal: safeOrderDiscount,
        taxTotal: calculatedTax,
        totalAmount: calculatedTotal,
        amountTendered: safeTendered,
        changeDue,
        paymentMethod,
        paymentReference,
        status: 'COMPLETED',
        notes,
        items: {
          create: validatedItems.map((vi) => ({
            productId: vi.product.id,
            productName: vi.product.name,
            sku: vi.product.sku,
            barcode: vi.product.barcode,
            unitPrice: vi.unitPrice,
            costPrice: vi.costPrice,
            quantity: vi.quantity,
            freeQuantity: vi.freeQuantity,
            stockQuantity: vi.stockQuantity,
            discount: vi.discount,
            lineTotal: vi.lineTotal,
          })),
        },
        payments: {
          create: {
            amount: calculatedTotal,
            method: paymentMethod,
            referenceNo: paymentReference,
          },
        },
      },
      include: {
        items: true,
        payments: true,
        cashier: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        customer: { select: { id: true, phone: true, fullName: true, pointsBalance: true } },
      },
    });

    if (customer) {
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          totalSpent: { increment: calculatedTotal },
          ...(loyaltyPoints > 0 ? { pointsBalance: { increment: loyaltyPoints } } : {}),
        },
      });
      if (loyaltyPoints > 0) {
        await tx.loyaltyTransaction.create({
          data: {
            customerId: customer.id,
            saleId: sale.id,
            type: 'EARN',
            points: loyaltyPoints,
            amount: calculatedTotal,
            note: `Points earned from ${transactionNumber}`,
          },
        });
      }
      sale.loyaltyPointsEarned = loyaltyPoints;
      sale.customer = {
        ...sale.customer,
        pointsBalance: Number(customer.pointsBalance) - rewardPoints + loyaltyPoints,
      };
    }

    // Link inventory movements to sale
    await tx.inventoryMovement.updateMany({
      where: {
        reason: `Sale ${transactionNumber}`,
        userId: cashierId,
      },
      data: {
        saleId: sale.id,
      },
    });

    return sale;
  });

  // 5. Audit log
  await createAuditLog({
    userId: cashierId,
    action: 'CHECKOUT_COMPLETED',
    entity: 'Sale',
    entityId: result.id,
    details: {
      transactionNumber,
      totalAmount: calculatedTotal,
      itemCount: validatedItems.length,
      paymentMethod,
      customerPhone: normalizedCustomerPhone,
      loyaltyPointsEarned: loyaltyPoints,
    },
    ipAddress,
  });

  return result;
}

module.exports = {
  processCheckout,
};
