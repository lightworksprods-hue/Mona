const prisma = require('../config/db');

// Dashboard summary cards & quick stats
exports.getDashboardStats = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const saleWhere = {
      deletedAt: null,
      createdAt: { gte: todayStart, lte: todayEnd },
      status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
    };
    // Keep dashboard totals in the database instead of loading every sale and
    // line item into the Node.js process.
    const [salesSummary, itemSummary, profitSummary, refundSummary] = await Promise.all([
      prisma.sale.aggregate({ where: saleWhere, _sum: { totalAmount: true }, _count: { _all: true } }),
      prisma.saleItem.aggregate({ where: { sale: saleWhere }, _sum: { quantity: true } }),
      prisma.$queryRaw`
        SELECT COALESCE(SUM(si."lineTotal" - (si."costPrice" * si."quantity")), 0) AS "profit"
        FROM "sale_items" si
        INNER JOIN "sales" s ON s."id" = si."saleId"
        WHERE s."createdAt" >= ${todayStart}
          AND s."createdAt" <= ${todayEnd}
          AND s."deletedAt" IS NULL
          AND s."status" IN ('COMPLETED', 'PARTIALLY_REFUNDED')
      `,
      prisma.refund.aggregate({ where: { createdAt: { gte: todayStart, lte: todayEnd } }, _sum: { amount: true } }),
    ]);

    const grossTodaySalesTotal = Number(salesSummary._sum.totalAmount || 0);
    const todayItemsSold = Number(itemSummary._sum.quantity || 0);
    let todayEstimatedProfit = Number(profitSummary[0]?.profit || 0);
    const todayRefundedTotal = Number(refundSummary._sum.amount || 0);
    const todaySalesTotal = Math.max(0, grossTodaySalesTotal - todayRefundedTotal);
    todayEstimatedProfit = Math.max(0, todayEstimatedProfit - todayRefundedTotal);

    const transactionCount = salesSummary._count._all;
    const averageTransactionValue = transactionCount > 0 ? todaySalesTotal / transactionCount : 0;

    // Low stock items count
    const allProducts = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, stockQuantity: true, minStockLevel: true, barcode: true, sku: true },
    });

    const lowStockAlerts = allProducts.filter((p) => p.stockQuantity <= p.minStockLevel);

    // Recent 10 transactions
    const recentTransactions = await prisma.sale.findMany({
      where: { deletedAt: null },
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
          estimatedProfit: todayEstimatedProfit,
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
        deletedAt: null,
        createdAt: { gte: start, lte: end },
        status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
      },
      select: {
        totalAmount: true,
        itemDiscountTotal: true,
        orderDiscountTotal: true,
        taxTotal: true,
        createdAt: true,
        cashier: { select: { id: true, fullName: true, username: true } },
        paymentMethod: true,
        items: {
          select: {
            productId: true,
            productName: true,
            sku: true,
            quantity: true,
            lineTotal: true,
            costPrice: true,
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
      QRPH: 0,
      MAYA: 0,
      CARD: 0,
      OTHER: 0,
    };

    const productSalesMap = new Map();
    const cashierSalesMap = new Map();
    const peakHoursMap = new Map();
    let estimatedGrossProfit = 0;

    sales.forEach((s) => {
      totalRevenue += Number(s.totalAmount);
      totalDiscount += Number(s.itemDiscountTotal) + Number(s.orderDiscountTotal);
      totalTax += Number(s.taxTotal);

      // Payment breakdown
      const method = s.paymentMethod || 'CASH';
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + Number(s.totalAmount);

      const cashierId = s.cashier?.id || 'unknown';
      const cashier = cashierSalesMap.get(cashierId) || {
        cashierId,
        cashierName: s.cashier?.fullName || s.cashier?.username || 'Unknown cashier',
        transactions: 0,
        sales: 0,
        itemsSold: 0,
      };
      cashier.transactions += 1;
      cashier.sales += Number(s.totalAmount);

      const hour = new Date(s.createdAt).getHours();
      const hourBucket = peakHoursMap.get(hour) || { hour, transactions: 0, sales: 0 };
      hourBucket.transactions += 1;
      hourBucket.sales += Number(s.totalAmount);
      peakHoursMap.set(hour, hourBucket);

      // Products breakdown
      s.items.forEach((item) => {
        totalItems += Number(item.quantity);
        cashier.itemsSold += Number(item.quantity);
        estimatedGrossProfit += Number(item.lineTotal) - (Number(item.costPrice) * Number(item.quantity));
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
      estimatedGrossProfit -= Number(s.orderDiscountTotal || 0);
      cashierSalesMap.set(cashierId, cashier);
    });

    const bestSellers = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 15);

    // Refunds in the period
    const refunds = await prisma.refund.findMany({
      where: { createdAt: { gte: start, lte: end }, sale: { deletedAt: null } },
    });
    const totalRefunded = refunds.reduce((sum, r) => sum + Number(r.amount), 0);
    const cashierPerformance = Array.from(cashierSalesMap.values())
      .map((cashier) => ({
        ...cashier,
        averageSale: cashier.transactions ? cashier.sales / cashier.transactions : 0,
      }))
      .sort((a, b) => b.sales - a.sales);
    const peakHours = Array.from(peakHoursMap.values())
      .sort((a, b) => b.transactions - a.transactions || b.sales - a.sales)
      .slice(0, 8);
    const estimatedProfit = Math.max(0, estimatedGrossProfit - totalRefunded);

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
          estimatedProfit,
        },
        paymentBreakdown,
        bestSellers,
        cashierPerformance,
        peakHours,
      },
    });
  } catch (error) {
    next(error);
  }
};
