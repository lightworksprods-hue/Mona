const prisma = require('../config/db');

function normalizePhone(phone) {
  return String(phone || '').trim().replace(/[\s()-]/g, '');
}

exports.lookup = async (req, res, next) => {
  try {
    const phone = normalizePhone(req.query.phone);
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required.' });
    const customer = await prisma.customer.findUnique({ where: { phone } });
    res.json({ success: true, data: customer || null });
  } catch (error) {
    next(error);
  }
};

exports.list = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const customers = await prisma.customer.findMany({
      where: search ? { OR: [{ phone: { contains: search } }, { fullName: { contains: search, mode: 'insensitive' } }] } : undefined,
      orderBy: [{ pointsBalance: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        phone: true,
        fullName: true,
        pointsBalance: true,
        totalSpent: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { sales: true, loyaltyTransactions: true } },
      },
    });
    res.json({ success: true, data: customers });
  } catch (error) {
    next(error);
  }
};
