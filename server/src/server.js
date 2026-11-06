require('dotenv').config();
const app = require('./app');
const prisma = require('./config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Attempt DB connection check
    await prisma.$connect();
    console.log('Connected to PostgreSQL Database (Supabase)');

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
  await prisma.$disconnect();
  console.log('Prisma disconnected gracefully.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  console.log('Prisma disconnected gracefully.');
  process.exit(0);
});

startServer();
