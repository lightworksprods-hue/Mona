const prisma = require('../config/db');

const money = (value) => Number(value || 0);

async function calculateSession(session) {
  const sales = await prisma.sale.findMany({
    where: {
      cashierId: session.cashierId,
      paymentMethod: 'CASH',
      createdAt: { gte: session.openedAt },
      status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
    },
    select: { id: true, totalAmount: true },
  });

  const saleIds = sales.map((sale) => sale.id);
  const refunds = saleIds.length
    ? await prisma.refund.findMany({
        where: { saleId: { in: saleIds }, createdAt: { gte: session.openedAt } },
        select: { amount: true },
      })
    : [];

  const movements = await prisma.cashMovement.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { fullName: true, username: true } } },
  });

  const cashSales = sales.reduce((sum, sale) => sum + money(sale.totalAmount), 0);
  const refunded = refunds.reduce((sum, refund) => sum + money(refund.amount), 0);
  const withdrawals = movements
    .filter((movement) => movement.type === 'WITHDRAWAL')
    .reduce((sum, movement) => sum + money(movement.amount), 0);
  const cashIns = movements
    .filter((movement) => movement.type === 'CASH_IN')
    .reduce((sum, movement) => sum + money(movement.amount), 0);
  const netCashSales = cashSales - refunded;
  const expectedCash = money(session.openingCash) + netCashSales + cashIns - withdrawals;

  return {
    session,
    cashSales,
    refunded,
    netCashSales,
    withdrawals,
    cashIns,
    expectedCash,
    movements,
  };
}

exports.getCurrent = async (req, res, next) => {
  try {
    const session = await prisma.cashSession.findFirst({
      where: { cashierId: req.user.id, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });

    res.json({
      success: true,
      data: session ? await calculateSession(session) : { session: null },
    });
  } catch (error) {
    next(error);
  }
};

exports.openSession = async (req, res, next) => {
  try {
    const openingCash = Number(req.body.openingCash);
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      return res.status(400).json({ success: false, message: 'Opening cash must be a non-negative amount.' });
    }

    const existing = await prisma.cashSession.findFirst({
      where: { cashierId: req.user.id, status: 'OPEN' },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You already have an open cash drawer.' });
    }

    const session = await prisma.cashSession.create({
      data: {
        cashierId: req.user.id,
        openingCash,
        notes: req.body.notes?.trim() || null,
      },
    });

    res.status(201).json({ success: true, message: 'Cash drawer opened.', data: await calculateSession(session) });
  } catch (error) {
    next(error);
  }
};

exports.addMovement = async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    const type = req.body.type === 'CASH_IN' ? 'CASH_IN' : 'WITHDRAWAL';
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than zero.' });
    }
    if (!req.body.reason?.trim()) {
      return res.status(400).json({ success: false, message: 'A reason is required.' });
    }

    const session = await prisma.cashSession.findFirst({
      where: { cashierId: req.user.id, status: 'OPEN' },
    });
    if (!session) {
      return res.status(409).json({ success: false, message: 'Open a cash drawer before recording movements.' });
    }

    await prisma.cashMovement.create({
      data: {
        sessionId: session.id,
        userId: req.user.id,
        type,
        amount,
        reason: req.body.reason.trim(),
      },
    });

    res.status(201).json({ success: true, message: 'Cash movement recorded.', data: await calculateSession(session) });
  } catch (error) {
    next(error);
  }
};

exports.closeSession = async (req, res, next) => {
  try {
    const closingCash = Number(req.body.closingCash);
    if (!Number.isFinite(closingCash) || closingCash < 0) {
      return res.status(400).json({ success: false, message: 'Closing cash must be a non-negative amount.' });
    }

    const session = await prisma.cashSession.findFirst({
      where: { cashierId: req.user.id, status: 'OPEN' },
    });
    if (!session) {
      return res.status(404).json({ success: false, message: 'No open cash drawer found.' });
    }

    const summary = await calculateSession(session);
    const variance = closingCash - summary.expectedCash;
    const closed = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        closingCash,
        expectedCash: summary.expectedCash,
        variance,
        status: 'CLOSED',
        closedAt: new Date(),
        notes: req.body.notes?.trim() || session.notes,
      },
    });

    res.json({
      success: true,
      message: 'Cash drawer closed.',
      data: { ...summary, session: closed, closingCash, variance },
    });
  } catch (error) {
    next(error);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const where = req.user.role === 'ADMIN' ? {} : { cashierId: req.user.id };
    const sessions = await prisma.cashSession.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      take: 100,
      include: { cashier: { select: { fullName: true, username: true } } },
    });
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
};
