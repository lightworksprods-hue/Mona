const crypto = require('crypto');
const prisma = require('../config/db');

const bridgeToken = () => String(process.env.HARDWARE_BRIDGE_TOKEN || '').trim();

function requireBridgeToken(req, res) {
  const expected = bridgeToken();
  const supplied = String(req.headers['x-hardware-bridge-token'] || '').trim();
  if (!expected || !supplied) {
    res.status(503).json({ success: false, code: 'HARDWARE_BRIDGE_NOT_CONFIGURED', message: 'The cash drawer bridge is not configured.' });
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    res.status(401).json({ success: false, message: 'Invalid hardware bridge credentials.' });
    return false;
  }
  return true;
}

exports.requestOpenDrawer = async (req, res, next) => {
  try {
    if (!bridgeToken()) {
      return res.status(503).json({ success: false, code: 'HARDWARE_BRIDGE_NOT_CONFIGURED', message: 'The cash drawer bridge is not configured.' });
    }

    const command = await prisma.hardwareCommand.create({
      data: { type: 'OPEN_DRAWER', requestedBy: req.user.id },
    });
    res.status(202).json({ success: true, message: 'Cash drawer command sent to the store computer.', data: { commandId: command.id } });
  } catch (error) {
    next(error);
  }
};

exports.getNextCommand = async (req, res, next) => {
  try {
    if (!requireBridgeToken(req, res)) return;

    const command = await prisma.$transaction(async (tx) => {
      const pending = await tx.hardwareCommand.findFirst({
        where: { status: 'PENDING' },
        orderBy: { requestedAt: 'asc' },
      });
      if (!pending) return null;

      const claimed = await tx.hardwareCommand.updateMany({
        where: { id: pending.id, status: 'PENDING' },
        data: { status: 'CLAIMED', claimedAt: new Date() },
      });
      return claimed.count ? tx.hardwareCommand.findUnique({ where: { id: pending.id } }) : null;
    });

    res.json({ success: true, data: command });
  } catch (error) {
    next(error);
  }
};

exports.completeCommand = async (req, res, next) => {
  try {
    if (!requireBridgeToken(req, res)) return;

    const status = req.body.success === true ? 'COMPLETED' : 'FAILED';
    const command = await prisma.hardwareCommand.updateMany({
      where: { id: req.params.id, status: 'CLAIMED' },
      data: {
        status,
        completedAt: new Date(),
        result: String(req.body.result || '').slice(0, 500) || null,
      },
    });
    if (!command.count) {
      return res.status(404).json({ success: false, message: 'Hardware command was not found or is no longer active.' });
    }
    res.json({ success: true, message: 'Hardware command result recorded.' });
  } catch (error) {
    next(error);
  }
};
