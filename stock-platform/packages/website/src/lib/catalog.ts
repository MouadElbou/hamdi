import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { CatalogItem } from '@/lib/api';

export interface CatalogQuery {
  page?: number;
  limit?: number;
  category?: string; // comma-separated
  search?: string;
  inStockOnly?: boolean;
}

export interface CatalogResult {
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
}

function buildWhere(q: CatalogQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { published: true };
  if (q.category) {
    const cats = q.category.split(',').map(c => c.trim()).filter(Boolean);
    if (cats.length) where.category = { in: cats };
  }
  if (q.search) where.name = { contains: q.search, mode: 'insensitive' };
  // stock === null means "not tracked / always available".
  if (q.inStockOnly) where.OR = [{ stock: null }, { stock: { gt: 0 } }];
  return where;
}

/**
 * Server-side catalog query (used directly by Server Components and by the
 * public /api/stock route). Maps a Product to the CatalogItem shape the
 * existing storefront components already consume.
 */
export async function getCatalogItems(q: CatalogQuery): Promise<CatalogResult> {
  // Guard against NaN/Infinity (e.g. ?page=abc → parseInt → NaN) reaching
  // Prisma skip/take, which would otherwise throw a 500.
  const page = Number.isFinite(q.page) ? Math.max(1, Math.floor(q.page as number)) : 1;
  const limit = Number.isFinite(q.limit) ? Math.min(200, Math.max(1, Math.floor(q.limit as number))) : 100;
  const where = buildWhere(q);

  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.product.count({ where }),
  ]);

  const items: CatalogItem[] = rows.map(p => ({
    lotId: p.id,
    refNumber: '',
    date: p.createdAt.toISOString(),
    category: p.category,
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
    .map(g => ({ category: g.category, count: g._count._all }))
    .sort((a, b) => a.category.localeCompare(b.category, 'fr'));
}
