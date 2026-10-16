require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPERADMIN'; EXCEPTION WHEN undefined_object THEN NULL; END $$`);
  await prisma.$executeRawUnsafe('ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "systemActive" BOOLEAN NOT NULL DEFAULT true');
  console.log('System control is ready.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
