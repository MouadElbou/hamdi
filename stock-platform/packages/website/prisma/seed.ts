import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));

interface SeedProduct {
  name: string;
  category: string;
  categoryKey: string;
  subCategory: string | null;
  brand: string | null;
  deviceType: string | null;
  compatibleModels: string[];
  description: string | null;
  priceCents: number | null;
  stock: number | null;
}

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

  // --- Catalog seed (idempotent by name) ---
  // seed-data.json is the base catalog; scraped-data.json (optional) holds
  // products harvested from supplier sites. Both share the same shape.
  let created = 0;
  let skipped = 0;
  for (const file of ['seed-data.json', 'scraped-data.json']) {
    let data: SeedProduct[];
    try {
      data = JSON.parse(readFileSync(join(__dirname, file), 'utf8')) as SeedProduct[];
    } catch {
      continue; // optional file absent
    }
    if (!Array.isArray(data)) continue;
    for (const p of data) {
      if (!p || !p.name) continue;
      const existing = await prisma.product.findFirst({ where: { name: p.name }, select: { id: true } });
      if (existing) { skipped++; continue; }
      await prisma.product.create({
        data: {
          name: p.name,
          category: p.category,
          subCategory: p.subCategory,
          brand: p.brand,
          deviceType: p.deviceType,
          compatibleModels: p.compatibleModels ?? [],
          description: p.description,
          priceCents: p.priceCents,
          stock: p.stock,
          published: true,
        },
      });
      created++;
    }
  }
  console.log(`✓ Catalog: ${created} products created, ${skipped} skipped (already present)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
