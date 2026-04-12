import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { hash } from 'bcryptjs';
import {
  SUPPLIERS,
  BOUTIQUES,
  CATEGORIES,
  CATEGORY_ALIASES,
  BATTERY_TARIFF_DEFAULTS,
  type BatteryTariffLabel,
} from '@stock/shared';

const prisma = new PrismaClient();

async function main() {
  // Guard against accidental production seeding
  if (process.env.NODE_ENV === 'production' && !process.env.FORCE_SEED) {
    console.error('Seed is not intended for production. Set FORCE_SEED=1 to override.');
    process.exit(1);
  }

  console.log('Seeding suppliers...');
  for (const code of SUPPLIERS) {
    const existing = await prisma.supplier.findFirst({ where: { code, deletedAt: null } });
    if (!existing) {
      await prisma.supplier.create({ data: { id: randomUUID(), code } });
    }
  }

  console.log('Seeding boutiques...');
  for (const name of BOUTIQUES) {
    const existing = await prisma.boutique.findFirst({ where: { name, deletedAt: null } });
    if (!existing) {
      await prisma.boutique.create({ data: { id: randomUUID(), name } });
    }
  }

  console.log('Seeding categories...');
  for (const name of CATEGORIES) {
    const existing = await prisma.category.findFirst({ where: { name, deletedAt: null } });
    if (!existing) {
      await prisma.category.create({ data: { id: randomUUID(), name } });
    }
  }

  console.log('Seeding category aliases...');
  for (const [rawValue, canonicalName] of Object.entries(CATEGORY_ALIASES)) {
    const category = await prisma.category.findFirst({ where: { name: canonicalName, deletedAt: null } });
    if (!category) {
      console.warn(`  Skipping alias "${rawValue}" — canonical "${canonicalName}" not found`);
      continue;
    }
    const existingAlias = await prisma.categoryAlias.findFirst({ where: { rawValue, deletedAt: null } });
    if (existingAlias) {
      await prisma.categoryAlias.update({ where: { id: existingAlias.id }, data: { categoryId: category.id } });
    } else {
      await prisma.categoryAlias.create({ data: { id: randomUUID(), rawValue, categoryId: category.id } });
    }
  }

  console.log('Seeding battery tariffs...');
  for (const [label, defaults] of Object.entries(BATTERY_TARIFF_DEFAULTS)) {
    const existing = await prisma.batteryTariff.findFirst({ where: { label, deletedAt: null } });
    if (existing) {
      console.log(`  Tariff "${label}" already exists, skipping price update.`);
    } else {
      await prisma.batteryTariff.create({
        data: {
          id: randomUUID(),
          label,
          particuliersPrice: defaults.particuliers,
          revPrice: defaults.rev,
        },
      });
    }
  }

  console.log('Seeding admin users...');
  const ALL_PAGES = [
    'dashboard', 'purchases', 'stock', 'sales', 'maintenance',
    'battery-repair', 'expenses', 'credits', 'bank', 'monthly-summary', 'zakat',
  ];
  const admins = [
    { username: 'hicham', displayName: 'HICHAM' },
    { username: 'samir', displayName: 'SAMIR' },
  ];
  const seedPassword = process.env['ADMIN_SEED_PASSWORD'] ?? 'Admin@123';
  const passwordHash = await hash(seedPassword, 12);
  for (const admin of admins) {
    const existing = await prisma.user.findFirst({ where: { username: admin.username, deletedAt: null } });
    if (!existing) {
      const userId = randomUUID();
      await prisma.user.create({
        data: {
          id: userId,
          username: admin.username,
          passwordHash,
          displayName: admin.displayName,
          role: 'admin',
          isActive: true,
          mustChangePassword: false,
          permissions: {
            create: ALL_PAGES.map((pageKey) => ({ id: randomUUID(), pageKey })),
          },
        },
      });
      console.log(`  Created admin user: ${admin.username}`);
    } else {
      console.log(`  Admin user "${admin.username}" already exists, skipping.`);
    }
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
