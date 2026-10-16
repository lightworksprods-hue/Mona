require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "loyalty_rewards" (
      "id" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "pointsCost" INTEGER NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_rewards_productId_key" ON "loyalty_rewards" ("productId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "loyalty_rewards_isActive_idx" ON "loyalty_rewards" ("isActive")');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "loyalty_redemptions" (
      "id" TEXT NOT NULL,
      "customerId" TEXT NOT NULL,
      "rewardId" TEXT NOT NULL,
      "pointsSpent" INTEGER NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "loyalty_redemptions_customerId_createdAt_idx" ON "loyalty_redemptions" ("customerId", "createdAt")');
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_customerId_fkey"
        FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_rewardId_fkey"
        FOREIGN KEY ("rewardId") REFERENCES "loyalty_rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  console.log('Loyalty rewards and redemptions are ready.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
