import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // --- Admin user (for the product admin) ---
  const username = process.env['ADMIN_USERNAME'] ?? 'admin';
  const password = process.env['ADMIN_PASSWORD'] ?? 'admin';
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });
  console.log(`✓ Admin user ready: ${username}`);

  // --- Sample products (only if the catalogue is empty) ---
  const count = await prisma.product.count();
  if (count === 0) {
    await prisma.product.createMany({
      data: [
        { name: 'Batterie 12V 70Ah', category: 'Batteries', priceCents: 95000, stock: 10 },
        { name: 'Chargeur batterie automatique', category: 'Accessoires', priceCents: 32000, stock: 5 },
        { name: 'Réparation PC / diagnostic', category: 'Services', priceCents: 20000, stock: null },
      ],
    });
    console.log('✓ Sample products created');
  } else {
    console.log(`• ${count} product(s) already present — skipping samples`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
