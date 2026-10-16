require('dotenv').config();
// Prefer the same reachable URL used by the application. Set MIGRATION_DATABASE_URL
// only when a separate direct/session connection is available and reachable.
const migrationUrl = process.env.DATABASE_URL || process.env.MIGRATION_DATABASE_URL || process.env.DIRECT_URL;
if (migrationUrl) process.env.DATABASE_URL = migrationUrl;
const prisma = require('../src/config/db');

async function main() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "customers" (
      "id" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "fullName" TEXT,
      "pointsBalance" INTEGER NOT NULL DEFAULT 0,
      "totalSpent" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "customers_phone_key" ON "customers" ("phone")`,
    `CREATE INDEX IF NOT EXISTS "customers_phone_idx" ON "customers" ("phone")`,
    `ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "loyaltyPointsPerHundred" DECIMAL(8,2) NOT NULL DEFAULT 1.00`,
    `ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "receiptPaperWidth" TEXT NOT NULL DEFAULT '80mm'`,
    `ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "customerId" TEXT`,
    `CREATE INDEX IF NOT EXISTS "sales_customerId_idx" ON "sales" ("customerId")`,
    `CREATE TABLE IF NOT EXISTS "loyalty_transactions" (
      "id" TEXT NOT NULL,
      "customerId" TEXT NOT NULL,
      "saleId" TEXT,
      "type" TEXT NOT NULL,
      "points" INTEGER NOT NULL,
      "amount" DECIMAL(12,2),
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "loyalty_transactions_customerId_createdAt_idx" ON "loyalty_transactions" ("customerId", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "loyalty_transactions_saleId_idx" ON "loyalty_transactions" ("saleId")`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  const foreignKeys = [
    `DO $$ BEGIN
      ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
  ];

  for (const statement of foreignKeys) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log('Customer loyalty tables and settings are ready.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
