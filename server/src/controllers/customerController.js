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
