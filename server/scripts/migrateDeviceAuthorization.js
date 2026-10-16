require('dotenv').config();
// Use MIGRATION_DATABASE_URL for schema changes when provided. Supabase's
// Session Pooler URL is the IPv4-compatible option for networks that cannot
// reach the direct IPv6 database hostname.
const migrationUrl = process.env.MIGRATION_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
if (migrationUrl) process.env.DATABASE_URL = migrationUrl;
const prisma = require('../src/config/db');

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "authorized_devices" (
      "id" TEXT NOT NULL,
      "deviceKey" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "isAuthorized" BOOLEAN NOT NULL DEFAULT false,
      "lastSeenAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "authorized_devices_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "authorized_devices_deviceKey_key" ON "authorized_devices" ("deviceKey");');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "authorized_devices_isAuthorized_idx" ON "authorized_devices" ("isAuthorized");');
  console.log('Device authorization table is ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
