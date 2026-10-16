const prisma = require('../config/db');

// Dashboard summary cards & quick stats
exports.getDashboardStats = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Sales today
    const todaySales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
      },
      select: { totalAmount: true, items: { select: { quantity: true } } },
    });

    let grossTodaySalesTotal = 0;
    let todayItemsSold = 0;
    todaySales.forEach((s) => {
      grossTodaySalesTotal += Number(s.totalAmount);
      s.items.forEach((item) => {
        todayItemsSold += Number(item.quantity);
      });
    });

    const todayRefunds = await prisma.refund.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      select: { amount: true },
    });
    const todayRefundedTotal = todayRefunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
    const todaySalesTotal = Math.max(0, grossTodaySalesTotal - todayRefundedTotal);

    const transactionCount = todaySales.length;
    const averageTransactionValue = transactionCount > 0 ? todaySalesTotal / transactionCount : 0;

    // Low stock items count
    const allProducts = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, stockQuantity: true, minStockLevel: true, barcode: true, sku: true },
    });

    const lowStockAlerts = allProducts.filter((p) => p.stockQuantity <= p.minStockLevel);

    // Recent 10 transactions
    const recentTransactions = await prisma.sale.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        transactionNumber: true,
        totalAmount: true,
        paymentMethod: true,
        status: true,
        createdAt: true,
        cashier: { select: { fullName: true, username: true } },
      },
    });

    res.json({
      success: true,
      data: {
        today: {
          salesTotal: todaySalesTotal,
          grossSalesTotal: grossTodaySalesTotal,
          refundedTotal: todayRefundedTotal,
          transactionCount,
          itemsSold: todayItemsSold,
          averageTransactionValue,
        },
        lowStockCount: lowStockAlerts.length,
        lowStockItems: lowStockAlerts.slice(0, 10),
        recentTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Comprehensive reports (daily, weekly, monthly, by payment, best sellers)
exports.getReports = async (req, res, next) => {
  try {
    const { period = 'daily', startDate, endDate } = req.query;

    let start = new Date();
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (startDate || endDate) {
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'Both startDate and endDate are required.' });
      }
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid report date range.' });
      }
      if (start > end) {
        return res.status(400).json({ success: false, message: 'Report start date cannot be after end date.' });
      }
      end.setHours(23, 59, 59, 999);
    } else {
      if (period === 'daily') {
        start.setHours(0, 0, 0, 0);
      } else if (period === 'weekly') {
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
      } else if (period === 'monthly') {
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
      }
    }

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
      },
      select: {
        totalAmount: true,
        itemDiscountTotal: true,
        orderDiscountTotal: true,
        taxTotal: true,
        paymentMethod: true,
        items: {
          select: {
            productId: true,
            productName: true,
            sku: true,
            quantity: true,
            lineTotal: true,
          },
        },
      },
    });

    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalItems = 0;
    const paymentBreakdown = {
      CASH: 0,
      GCASH: 0,
      MAYA: 0,
      CARD: 0,
      OTHER: 0,
    };

    const productSalesMap = new Map();

    sales.forEach((s) => {
      totalRevenue += Number(s.totalAmount);
      totalDiscount += Number(s.itemDiscountTotal) + Number(s.orderDiscountTotal);
      totalTax += Number(s.taxTotal);

      // Payment breakdown
      const method = s.paymentMethod || 'CASH';
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + Number(s.totalAmount);

      // Products breakdown
      s.items.forEach((item) => {
        totalItems += Number(item.quantity);
        const current = productSalesMap.get(item.productId) || {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: 0,
          revenue: 0,
        };
          current.quantity += Number(item.quantity);
        current.revenue += Number(item.lineTotal);
        productSalesMap.set(item.productId, current);
      });
    });

    const bestSellers = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 15);

    // Refunds in the period
    const refunds = await prisma.refund.findMany({
      where: { createdAt: { gte: start, lte: end } },
    });
    const totalRefunded = refunds.reduce((sum, r) => sum + Number(r.amount), 0);

    res.json({
      success: true,
      data: {
        period,
        startDate: start,
        endDate: end,
        summary: {
          totalSales: totalRevenue,
          netSales: totalRevenue - totalRefunded,
          transactionCount: sales.length,
          totalItemsSold: totalItems,
          totalDiscount,
          totalTax,
          totalRefunded,
          refundCount: refunds.length,
        },
        paymentBreakdown,
        bestSellers,
      },
    });
  } catch (error) {
    next(error);
  }
};
