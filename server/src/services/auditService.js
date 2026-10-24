const prisma = require('../config/db');

const AUDIT_RETENTION_DAYS = 7;

async function createAuditLog({ userId, action, entity, entityId = null, details = null, ipAddress = null }) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details,
        ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error.message);
  }
}

async function purgeExpiredAuditLogs() {
  const cutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}

module.exports = {
  createAuditLog,
  purgeExpiredAuditLogs,
};
