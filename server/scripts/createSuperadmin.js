require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const username = String(process.env.SUPERADMIN_USERNAME || '').trim();
  const password = String(process.env.SUPERADMIN_PASSWORD || '');
  const fullName = String(process.env.SUPERADMIN_FULL_NAME || 'System Superadmin').trim();
  if (!username || password.length < 8) {
    throw new Error('Set SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD (minimum 8 characters) before running this command.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { username },
    update: { fullName, passwordHash, role: 'SUPERADMIN', isActive: true },
    create: { username, fullName, passwordHash, role: 'SUPERADMIN' },
    select: { username: true, fullName: true, role: true },
  });
  console.log(`Superadmin ready: ${user.username} (${user.role})`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
