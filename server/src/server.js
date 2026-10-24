require('dotenv').config();
const app = require('./app');
const prisma = require('./config/db');
const { purgeExpiredAuditLogs } = require('./services/auditService');

const PORT = process.env.PORT || 5000;
const AUDIT_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
let auditCleanupTimer;

async function startServer() {
  try {
    // Attempt DB connection check
    await prisma.$connect();
    console.log('Connected to PostgreSQL Database (Supabase)');

    try {
      const deletedAuditLogs = await purgeExpiredAuditLogs();
      if (deletedAuditLogs > 0) {
        console.log(`Removed ${deletedAuditLogs} audit log(s) older than 7 days.`);
      }
    } catch (error) {
      console.error('Initial audit log cleanup failed:', error.message);
    }
    auditCleanupTimer = setInterval(async () => {
      try {
        const deleted = await purgeExpiredAuditLogs();
        if (deleted > 0) console.log(`Removed ${deleted} expired audit log(s).`);
      } catch (error) {
        console.error('Audit log cleanup failed:', error.message);
      }
    }, AUDIT_CLEANUP_INTERVAL_MS);

    app.listen(PORT, () => {
      console.log(`Counter POS Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exitCode = 1;
    return;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (auditCleanupTimer) clearInterval(auditCleanupTimer);
  await prisma.$disconnect();
  console.log('Prisma disconnected gracefully.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (auditCleanupTimer) clearInterval(auditCleanupTimer);
  await prisma.$disconnect();
  console.log('Prisma disconnected gracefully.');
  process.exit(0);
});

startServer();
