const prisma = require('../config/db');

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

module.exports = {
  createAuditLog,
};
