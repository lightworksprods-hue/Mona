const prisma = require('../config/db');

function normalizePhone(phone) {
  return String(phone || '').trim().replace(/[\s()-]/g, '');
}

exports.create = async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const fullName = String(req.body.fullName || '').trim();
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      return res.status(400).json({ success: false, message: 'A valid phone number with at least 7 digits is required.' });
    }
    if (fullName.length > 100) {
      return res.status(400).json({ success: false, message: 'Customer name must be 100 characters or fewer.' });
    }
    const customer = await prisma.customer.create({
      data: { phone, fullName: fullName || null },
      select: { id: true, phone: true, fullName: true, pointsBalance: true, totalSpent: true, createdAt: true, updatedAt: true },
    });
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'A customer with this phone number already exists.' });
    next(error);
  }
};

function rewardSelect() {
  return {
    id: true,
    productId: true,
    pointsCost: true,
    isActive: true,
    product: { select: { id: true, name: true, sku: true, sellingPrice: true, stockQuantity: true, isActive: true } },
  };
}

exports.lookup = async (req, res, next) => {
  try {
    const phone = normalizePhone(req.query.phone);
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required.' });
    const customer = await prisma.customer.findUnique({ where: { phone } });
    const rewards = await prisma.loyaltyReward.findMany({
      where: { isActive: true, product: { isActive: true } },
      select: rewardSelect(),
      orderBy: { pointsCost: 'asc' },
    });
    res.json({ success: true, data: customer || null, rewards });
  } catch (error) {
    next(error);
  }
};

// Public, limited lookup used by the customer-facing points tracker.
// Do not return the customer's name, phone, or transaction history here.
exports.pointsLookup = async (req, res, next) => {
  try {
    const phone = normalizePhone(req.query.phone);
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required.' });

    const customer = await prisma.customer.findUnique({
      where: { phone },
      select: { pointsBalance: true, updatedAt: true },
    });

    const rewards = await prisma.loyaltyReward.findMany({
      where: { isActive: true, product: { isActive: true } },
      select: rewardSelect(),
      orderBy: { pointsCost: 'asc' },
    });

    res.json({
      success: true,
      data: customer ? { pointsBalance: customer.pointsBalance, updatedAt: customer.updatedAt } : null,
      rewards,
    });
  } catch (error) {
    next(error);
  }
};

exports.listRewards = async (req, res, next) => {
  try {
    const rewards = await prisma.loyaltyReward.findMany({
      select: rewardSelect(),
      orderBy: [{ isActive: 'desc' }, { pointsCost: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: rewards });
  } catch (error) {
    next(error);
  }
};

exports.createReward = async (req, res, next) => {
  try {
    const productId = String(req.body.productId || '').trim();
    const pointsCost = Math.floor(Number(req.body.pointsCost));
    if (!productId || !Number.isFinite(pointsCost) || pointsCost < 1) {
      return res.status(400).json({ success: false, message: 'A product and a points cost of at least 1 are required.' });
    }
    const reward = await prisma.loyaltyReward.create({
      data: { productId, pointsCost, isActive: req.body.isActive !== false },
      select: rewardSelect(),
    });
    res.status(201).json({ success: true, data: reward });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'This product already has a loyalty reward.' });
    next(error);
  }
};

exports.updateReward = async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    const data = {};
    if (req.body.pointsCost !== undefined) {
      const pointsCost = Math.floor(Number(req.body.pointsCost));
      if (!Number.isFinite(pointsCost) || pointsCost < 1) return res.status(400).json({ success: false, message: 'Points cost must be at least 1.' });
      data.pointsCost = pointsCost;
    }
    if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
    const reward = await prisma.loyaltyReward.update({ where: { id }, data, select: rewardSelect() });
    res.json({ success: true, data: reward });
  } catch (error) {
    next(error);
  }
};

exports.deleteReward = async (req, res, next) => {
  try {
    await prisma.loyaltyReward.delete({ where: { id: String(req.params.id || '').trim() } });
    res.json({ success: true, message: 'Reward removed.' });
  } catch (error) {
    if (error.code === 'P2003') return res.status(409).json({ success: false, message: 'This reward has redemption history. Disable it instead.' });
    next(error);
  }
};

exports.redeem = async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const rewardId = String(req.body.rewardId || '').trim();
    if (!phone || !rewardId) return res.status(400).json({ success: false, message: 'Customer phone and reward are required.' });

    const customer = await prisma.customer.findUnique({ where: { phone }, select: { pointsBalance: true } });
    const reward = await prisma.loyaltyReward.findUnique({ where: { id: rewardId }, include: { product: true } });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer was not found.' });
    if (!reward?.isActive || !reward.product.isActive) return res.status(400).json({ success: false, message: 'This reward is no longer available.' });
    if (Number(reward.product.stockQuantity) < 1) return res.status(409).json({ success: false, message: 'This reward is out of stock.' });
    if (customer.pointsBalance < reward.pointsCost) return res.status(400).json({ success: false, message: 'Customer does not have enough points.' });

    // This only validates and prepares the reward. Points and inventory are
    // deducted atomically when the checkout containing this reward completes.
    res.json({
      success: true,
      data: {
        rewardId: reward.id,
        pointsSpent: reward.pointsCost,
        product: reward.product,
      },
      message: 'Reward added to the pending cart.',
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
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
