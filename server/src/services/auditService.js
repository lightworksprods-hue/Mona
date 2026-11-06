// Audit logging has been disabled. Kept as a compatibility no-op for existing
// controllers until their historical calls are removed.
async function createAuditLog() {}

module.exports = {
  createAuditLog,
};
