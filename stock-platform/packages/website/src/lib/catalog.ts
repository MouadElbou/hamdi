import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { CatalogItem } from '@/lib/api';

export interface CatalogQuery {
  page?: number;
  limit?: number;
  category?: string; // comma-separated
  subCategory?: string; // comma-separated
  brand?: string; // comma-separated
  deviceType?: string; // comma-separated
  search?: string;
  inStockOnly?: boolean;
}

export interface CatalogResult {
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
}

function splitCsv(v?: string): string[] {
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function buildWhere(q: CatalogQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { published: true };
  const cats = splitCsv(q.category);
  if (cats.length) where.category = { in: cats };
  const subs = splitCsv(q.subCategory);
  if (subs.length) where.subCategory = { in: subs };
  const brands = splitCsv(q.brand);
  if (brands.length) where.brand = { in: brands };
  const devices = splitCsv(q.deviceType);
  if (devices.length) where.deviceType = { in: devices };
  if (q.search) where.name = { contains: q.search, mode: 'insensitive' };
  // stock === null means "not tracked / always available".
  if (q.inStockOnly) where.OR = [{ stock: null }, { stock: { gt: 0 } }];
  return where;
}

export async function getCatalogItems(q: CatalogQuery): Promise<CatalogResult> {
  // Guard against NaN/Infinity reaching Prisma skip/take.
  const page = Number.isFinite(q.page) ? Math.max(1, Math.floor(q.page as number)) : 1;
  const limit = Number.isFinite(q.limit) ? Math.min(200, Math.max(1, Math.floor(q.limit as number))) : 100;
  const where = buildWhere(q);

  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
    prisma.product.count({ where }),
  ]);

  const items: CatalogItem[] = rows.map((p) => ({
    lotId: p.id,
    refNumber: '',
    date: p.createdAt.toISOString(),
    category: p.category,
    subCategory: p.subCategory,
    brand: p.brand,
    deviceType: p.deviceType,
    compatibleModels: p.compatibleModels,
    designation: p.name,
    supplier: '',
    boutique: '',
    remainingQuantity: p.stock ?? 999,
    targetResalePrice: p.priceCents,
    imageUrl: p.imageUrl,
  }));

  return { items, total, page, limit };
}

export async function getCategorySummary(): Promise<Array<{ category: string; count: number }>> {
  const groups = await prisma.product.groupBy({
    by: ['category'],
    where: { published: true },
    _count: { _all: true },
  });
  return groups
    .map((g) => ({ category: g.category, count: g._count._all }))
    .sort((a, b) => a.category.localeCompare(b.category, 'fr'));
}

/** Distinct filter values present in the catalogue (optionally within a category). */
export async function getFilterOptions(category?: string): Promise<{ brands: string[]; deviceTypes: string[]; subCategories: string[] }> {
  const where: Prisma.ProductWhereInput = { published: true };
  const cats = splitCsv(category);
  if (cats.length) where.category = { in: cats };
  const rows = await prisma.product.findMany({ where, select: { brand: true, deviceType: true, subCategory: true } });
  const brands = new Set<string>();
  const devices = new Set<string>();
  const subs = new Set<string>();
  for (const r of rows) {
    if (r.brand) brands.add(r.brand);
    if (r.deviceType) devices.add(r.deviceType);
    if (r.subCategory) subs.add(r.subCategory);
  }
  const sort = (a: string, b: string) => a.localeCompare(b, 'fr');
  return { brands: [...brands].sort(sort), deviceTypes: [...devices].sort(sort), subCategories: [...subs].sort(sort) };
}
