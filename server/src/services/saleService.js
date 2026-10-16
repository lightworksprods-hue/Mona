const prisma = require('../config/db');
const { roundMoney, generateTransactionNumber } = require('../utils/formatters');
const { createAuditLog } = require('./auditService');

/**
 * Atomic checkout transaction
 * @param {Object} params
 * @param {string} params.cashierId - Cashier user ID
 * @param {Array<{productId: string, quantity: number, discount?: number}>} params.items
 * @param {number} params.orderDiscount - Overall sale discount
 * @param {string} params.paymentMethod - CASH | GCASH | MAYA | OTHER
 * @param {number} params.amountTendered - Amount given by customer
 * @param {string} params.paymentReference - Reference for electronic payments
 * @param {string} params.notes - Optional notes
 * @param {string} params.ipAddress - Client IP
 */
async function processCheckout({
  cashierId,
  items,
  orderDiscount = 0,
  paymentMethod = 'CASH',
  amountTendered = 0,
  paymentReference = null,
  notes = null,
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

  // 1. Fetch store settings for global taxRate if applicable
  const storeSettings = await prisma.storeSettings.findFirst();
  const globalTaxRate = storeSettings ? Number(storeSettings.taxRate) : 0;

  // 2. Fetch all products in cart with current database pricing & stock
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
    },
  });

  const productMap = new Map();
  products.forEach((p) => productMap.set(p.id, p));

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

    if (Number(product.stockQuantity) < qty) {
      throw {
        status: 400,
        message: `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Requested: ${qty}`,
      };
    }

    const unitPrice = Number(product.sellingPrice);
    const costPrice = Number(product.costPrice);
    const itemDiscount = roundMoney(Number(cartItem.discount || 0));
    const lineTotal = roundMoney(unitPrice * qty - itemDiscount);

    if (lineTotal < 0) {
      throw { status: 400, message: `Discount cannot exceed item price for "${product.name}".` };
    }

    calculatedSubtotal += unitPrice * qty;
    calculatedItemDiscountTotal += itemDiscount;

    validatedItems.push({
      product,
      quantity: qty,
      unitPrice,
      costPrice,
      discount: itemDiscount,
      lineTotal,
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
    // Re-check and atomically deduct stock for all items
    for (const item of validatedItems) {
      const updatedCount = await tx.product.updateMany({
        where: {
          id: item.product.id,
          stockQuantity: { gte: item.quantity },
        },
        data: { stockQuantity: { decrement: item.quantity } },
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
          quantity: -item.quantity,
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
      },
    });

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
    },
    ipAddress,
  });

  return result;
}

module.exports = {
  processCheckout,
};
