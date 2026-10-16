require('dotenv').config();

const prisma = require('../src/config/db');

async function migrate() {
  const statements = [
    'ALTER TABLE "products" ALTER COLUMN "stockQuantity" TYPE DECIMAL(12,3) USING "stockQuantity"::DECIMAL(12,3)',
    'ALTER TABLE "products" ALTER COLUMN "minStockLevel" TYPE DECIMAL(12,3) USING "minStockLevel"::DECIMAL(12,3)',
    'ALTER TABLE "sale_items" ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::DECIMAL(12,3)',
    'ALTER TABLE "inventory_movements" ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::DECIMAL(12,3)',
    'ALTER TABLE "inventory_movements" ALTER COLUMN "balanceAfter" TYPE DECIMAL(12,3) USING "balanceAfter"::DECIMAL(12,3)',
    'ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "offlineId" TEXT',
    'CREATE UNIQUE INDEX IF NOT EXISTS "sales_offlineId_key" ON "sales"("offlineId") WHERE "offlineId" IS NOT NULL',
    `DO $$ BEGIN
      CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      CREATE TYPE "CashMovementType" AS ENUM ('WITHDRAWAL', 'CASH_IN');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "cash_sessions" (
      "id" TEXT NOT NULL,
      "cashierId" TEXT NOT NULL,
      "openingCash" DECIMAL(12,2) NOT NULL,
      "closingCash" DECIMAL(12,2),
      "expectedCash" DECIMAL(12,2),
      "variance" DECIMAL(12,2),
      "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
      "notes" TEXT,
      "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "closedAt" TIMESTAMP(3),
      CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "cash_sessions_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "cash_movements" (
      "id" TEXT NOT NULL,
      "sessionId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "type" "CashMovementType" NOT NULL,
      "amount" DECIMAL(12,2) NOT NULL,
      "reason" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "cash_movements_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cash_sessions"("id") ON DELETE CASCADE,
      CONSTRAINT "cash_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id")
    )`,
    'CREATE INDEX IF NOT EXISTS "cash_sessions_cashierId_status_idx" ON "cash_sessions"("cashierId", "status")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "cash_sessions_one_open_per_cashier_idx" ON "cash_sessions"("cashierId") WHERE "status" = \'OPEN\'',
    'CREATE INDEX IF NOT EXISTS "cash_sessions_openedAt_idx" ON "cash_sessions"("openedAt")',
    'CREATE INDEX IF NOT EXISTS "cash_movements_sessionId_createdAt_idx" ON "cash_movements"("sessionId", "createdAt")',
  ];

  await prisma.$transaction(statements.map((statement) => prisma.$executeRawUnsafe(statement)));
  console.log('Quantity columns migrated to DECIMAL(12,3).');
}

migrate()
  .catch((error) => {
    console.error('Quantity migration failed:', error.code || '', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
