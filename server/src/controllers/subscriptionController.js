const prisma = require('../config/db');

const DEFAULT_AMOUNT = 650;

function currentBillingPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

async function getPeriodStatus() {
  const period = currentBillingPeriod();
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true, username: true, fullName: true },
    orderBy: { fullName: 'asc' },
  });
  const payments = admins.length ? await prisma.subscriptionPayment.findMany({
    where: { adminId: { in: admins.map((admin) => admin.id) }, billingYear: period.year, billingMonth: period.month },
    orderBy: { paidAt: 'desc' },
  }) : [];
  const records = admins.map((admin) => ({
    ...admin,
    payment: payments.find((payment) => payment.adminId === admin.id) || null,
  }));
  const overdue = period.day > 20 && records.some((record) => !record.payment);
  return { billingYear: period.year, billingMonth: period.month, dueDay: 20, amountDue: DEFAULT_AMOUNT, overdue, records };
}

exports.getStatus = async (req, res, next) => {
  try {
    res.json({ success: true, data: await getPeriodStatus() });
  } catch (error) { next(error); }
};

exports.getPayments = async (req, res, next) => {
  try {
    const payments = await prisma.subscriptionPayment.findMany({
      include: { admin: { select: { username: true, fullName: true } }, recordedBy: { select: { username: true, fullName: true } } },
      orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }, { paidAt: 'desc' }],
    });
    res.json({ success: true, data: payments });
  } catch (error) { next(error); }
};

exports.recordPayment = async (req, res, next) => {
  try {
    const { adminId, amount, paidAt, billingYear, billingMonth, notes } = req.body;
    const admin = await prisma.user.findFirst({ where: { id: adminId, role: 'ADMIN' }, select: { id: true } });
    if (!admin) return res.status(400).json({ success: false, message: 'Select a valid administrator account.' });
    const numericAmount = Number(amount);
    const year = Number(billingYear);
    const month = Number(billingMonth);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ success: false, message: 'Invalid billing month.' });
    const payment = await prisma.subscriptionPayment.create({
      data: { adminId, recordedById: req.user.id, amount: numericAmount, paidAt: paidAt ? new Date(paidAt) : new Date(), billingYear: year, billingMonth: month, notes: notes ? String(notes).trim().slice(0, 500) : null },
      include: { admin: { select: { username: true, fullName: true } }, recordedBy: { select: { username: true, fullName: true } } },
    });
    res.status(201).json({ success: true, message: 'Subscription payment recorded.', data: payment });
  } catch (error) { next(error); }
};

exports.DEFAULT_AMOUNT = DEFAULT_AMOUNT;
