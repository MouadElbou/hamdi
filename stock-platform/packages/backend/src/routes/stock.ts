import type { FastifyInstance } from 'fastify';

export async function stockRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // Computed stock view — lot-based, not product-based
  app.get('/', async (request) => {
    // Check if request is authenticated (JWT verified in onRequest hook)
    const isAuthenticated = !!(request as any).user;
    const {
      page = '1',
      limit = '50',
      category,
      supplier,
      boutique,
      search,
      inStockOnly,
    } = request.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit ?? '50', 10) || 50), 200);
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    // BH-2: When inStockOnly, use raw SQL to filter at DB level instead of loading everything
    if (inStockOnly === 'true') {
      const conditions: string[] = ['pl."deletedAt" IS NULL'];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (category) {
        const cats = category.split(',').map((c: string) => c.trim()).filter(Boolean);
        conditions.push(`c."name" = ANY($${paramIdx++}::text[])`);
        params.push(cats);
      }
      if (supplier) {
        conditions.push(`s."code" = $${paramIdx++}`);
        params.push(supplier);
      }
      if (boutique) {
        conditions.push(`b."name" = $${paramIdx++}`);
        params.push(boutique);
      }
      if (search) {
        const escaped = search.replace(/[%_\\]/g, '\\$&');
        conditions.push(`pl."designation" ILIKE $${paramIdx++}`);
        params.push(`%${escaped}%`);
      }

      const whereClause = conditions.join(' AND ');

      // Count total in-stock lots
      const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM (
          SELECT pl."id"
          FROM purchase_lots pl
          JOIN categories c ON c."id" = pl."categoryId"
          JOIN suppliers s ON s."id" = pl."supplierId"
          JOIN boutiques b ON b."id" = pl."boutiqueId"
          LEFT JOIN (
            SELECT sl."lotId", COALESCE(SUM(sl."quantity"), 0) AS sold
            FROM sale_lines sl WHERE sl."deletedAt" IS NULL
            GROUP BY sl."lotId"
          ) sold ON sold."lotId" = pl."id"
          WHERE ${whereClause}
            AND pl."initialQuantity" - COALESCE(sold.sold, 0) > 0
        ) sub`,
        ...params,
      );
      const total = Number(countResult[0]?.count ?? 0);

      // Fetch paginated in-stock lots
      const rows = await prisma.$queryRawUnsafe<Array<{
        lotId: string; refNumber: string; date: Date; category: string;
        designation: string; supplier: string; boutique: string;
        initialQuantity: number; soldQuantity: number; remainingQuantity: number;
        purchaseUnitCost: number; targetResalePrice: number | null; sellingPrice: number | null;
      }>>(
        `SELECT
          pl."id" AS "lotId", pl."refNumber", pl."date",
          c."name" AS "category", pl."designation",
          s."code" AS "supplier", b."name" AS "boutique",
          pl."initialQuantity",
          COALESCE(sold.sold, 0)::int AS "soldQuantity",
          (pl."initialQuantity" - COALESCE(sold.sold, 0))::int AS "remainingQuantity",
          pl."purchaseUnitCost", pl."targetResalePrice", pl."sellingPrice"
        FROM purchase_lots pl
        JOIN categories c ON c."id" = pl."categoryId"
        JOIN suppliers s ON s."id" = pl."supplierId"
        JOIN boutiques b ON b."id" = pl."boutiqueId"
        LEFT JOIN (
          SELECT sl."lotId", COALESCE(SUM(sl."quantity"), 0) AS sold
          FROM sale_lines sl WHERE sl."deletedAt" IS NULL
          GROUP BY sl."lotId"
        ) sold ON sold."lotId" = pl."id"
        WHERE ${whereClause}
          AND pl."initialQuantity" - COALESCE(sold.sold, 0) > 0
        ORDER BY pl."date" DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        ...params, take, skip,
      );

      const stockItems = rows.map((r) => ({
        lotId: r.lotId,
        refNumber: r.refNumber,
        date: r.date,
        category: r.category,
        designation: r.designation,
        supplier: r.supplier,
        boutique: r.boutique,
        initialQuantity: r.initialQuantity,
        soldQuantity: r.soldQuantity,
        remainingQuantity: r.remainingQuantity,
        targetResalePrice: r.targetResalePrice,
        sellingPrice: r.sellingPrice,
        ...(isAuthenticated && {
          purchaseUnitCost: r.purchaseUnitCost,
          currentStockValue: r.remainingQuantity * r.purchaseUnitCost,
        }),
      }));

      return { items: stockItems, total, page: pageNum, limit: take };
    }

    // Normal path (no inStockOnly) — use Prisma ORM
    const where: Record<string, unknown> = { deletedAt: null };
    if (category) {
      const cats = category.split(',').map((c: string) => c.trim()).filter(Boolean);
      where['category'] = { name: { in: cats } };
    }
    if (supplier) where['supplier'] = { code: supplier };
    if (boutique) where['boutique'] = { name: boutique };
    if (search) {
      const escaped = search.replace(/[%_\\]/g, '\\$&');
      where['designation'] = { contains: escaped, mode: 'insensitive' };
    }

    const [lots, total] = await Promise.all([
      prisma.purchaseLot.findMany({
        where,
        include: {
          category: true,
          supplier: true,
          boutique: true,
          saleLines: {
            where: { deletedAt: null },
            select: { quantity: true },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.purchaseLot.count({ where }),
    ]);

    const stockItems = lots.map((lot: typeof lots[number]) => {
      const soldQuantity = lot.saleLines.reduce((sum: number, l: { quantity: number }) => sum + l.quantity, 0);
      const remainingQuantity = lot.initialQuantity - soldQuantity;
      return {
        lotId: lot.id,
        refNumber: lot.refNumber,
        date: lot.date,
        category: lot.category.name,
        designation: lot.designation,
        supplier: lot.supplier.code,
        boutique: lot.boutique.name,
        initialQuantity: lot.initialQuantity,
        soldQuantity,
        remainingQuantity,
        targetResalePrice: lot.targetResalePrice,
        sellingPrice: lot.sellingPrice,
        ...(isAuthenticated && {
          purchaseUnitCost: lot.purchaseUnitCost,
          currentStockValue: remainingQuantity * lot.purchaseUnitCost,
        }),
      };
    });

    return { items: stockItems, total, page: pageNum, limit: take };
  });

  // Get a single lot stock detail
  app.get<{ Params: { lotId: string } }>('/:lotId', async (request, reply) => {
    const isAuthenticated = !!(request as any).user;
    const lot = await prisma.purchaseLot.findFirst({
      where: { id: request.params.lotId, deletedAt: null },
      include: {
        category: true,
        supplier: true,
        boutique: true,
        saleLines: {
          where: { deletedAt: null },
          select: { id: true, quantity: true, sellingUnitPrice: true, saleOrderId: true, createdAt: true },
        },
      },
    });

    if (!lot) return reply.notFound('Stock lot not found');

    const soldQuantity = lot.saleLines.reduce((sum, l) => sum + l.quantity, 0);
    const remainingQuantity = lot.initialQuantity - soldQuantity;

    return {
      lotId: lot.id,
      refNumber: lot.refNumber,
      date: lot.date,
      category: lot.category.name,
      designation: lot.designation,
      supplier: lot.supplier.code,
      boutique: lot.boutique.name,
      initialQuantity: lot.initialQuantity,
      soldQuantity,
      remainingQuantity,
      targetResalePrice: lot.targetResalePrice,
      ...(isAuthenticated && {
        purchaseUnitCost: lot.purchaseUnitCost,
        currentStockValue: remainingQuantity * lot.purchaseUnitCost,
      }),
      saleHistory: lot.saleLines,
    };
  });

  // Summary: total stock value grouped by category
  app.get('/summary/by-category', async (request) => {
    const isAuthenticated = !!(request as any).user;
    const rows = await prisma.$queryRaw<Array<{
      category: string;
      totalValue: bigint;
      totalLots: bigint;
      totalRemaining: bigint;
    }>>`
      SELECT c."name" AS category,
        SUM((pl."initialQuantity" - COALESCE(sold.sold, 0))::bigint * pl."purchaseUnitCost") AS "totalValue",
        COUNT(pl."id")::bigint AS "totalLots",
        SUM(pl."initialQuantity" - COALESCE(sold.sold, 0))::bigint AS "totalRemaining"
      FROM purchase_lots pl
      JOIN categories c ON c."id" = pl."categoryId"
      LEFT JOIN (
        SELECT sl."lotId", COALESCE(SUM(sl."quantity"), 0) AS sold
        FROM sale_lines sl WHERE sl."deletedAt" IS NULL
        GROUP BY sl."lotId"
      ) sold ON sold."lotId" = pl."id"
      WHERE pl."deletedAt" IS NULL
        AND pl."initialQuantity" - COALESCE(sold.sold, 0) > 0
      GROUP BY c."name"
      ORDER BY SUM((pl."initialQuantity" - COALESCE(sold.sold, 0))::bigint * pl."purchaseUnitCost") DESC
    `;

    const summary = rows.map(r => ({
      category: r.category,
      ...(isAuthenticated && { totalValue: Number(r.totalValue) }),
      totalLots: Number(r.totalLots),
      totalRemaining: Number(r.totalRemaining),
    }));
    const grandTotal = isAuthenticated ? summary.reduce((s, c) => s + ((c as any).totalValue ?? 0), 0) : undefined;

    return { summary, ...(grandTotal !== undefined && { grandTotal }) };
  });

  // Homepage data — latest arrivals, top sellers, deals
  app.get('/homepage', async (request) => {
    const isAuthenticated = !!(request as any).user;

    // Pre-filter: only lots where remaining > 0 (initialQuantity - sold > 0)
    const inStockIds = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT pl.id FROM purchase_lots pl
      WHERE pl."deletedAt" IS NULL
        AND pl."initialQuantity" - COALESCE(
          (SELECT SUM(sl.quantity) FROM sale_lines sl WHERE sl."lotId" = pl.id AND sl."deletedAt" IS NULL), 0
        ) > 0
      ORDER BY pl.date DESC
      LIMIT 200
    `;

    const lots = inStockIds.length === 0 ? [] : await prisma.purchaseLot.findMany({
      where: { id: { in: inStockIds.map(r => r.id) }, deletedAt: null },
      include: {
        category: true,
        supplier: true,
        boutique: true,
        saleLines: { where: { deletedAt: null }, select: { quantity: true } },
      },
      orderBy: { date: 'desc' },
    });

    const withStock = lots.map((lot: typeof lots[number]) => {
      const soldQty = lot.saleLines.reduce((s: number, l: { quantity: number }) => s + l.quantity, 0);
      const remaining = lot.initialQuantity - soldQty;
      return {
        lotId: lot.id,
        refNumber: lot.refNumber,
        date: lot.date,
        category: lot.category.name,
        designation: lot.designation,
        supplier: lot.supplier.code,
        boutique: lot.boutique.name,
        remainingQuantity: remaining,
        targetResalePrice: lot.targetResalePrice,
        ...(isAuthenticated && { purchaseUnitCost: lot.purchaseUnitCost }),
        soldQuantity: soldQty,
      };
    }).filter((s: { remainingQuantity: number }) => s.remainingQuantity > 0);

    // New arrivals: most recent 12
    const newArrivals = withStock.slice(0, 12);

    // Top sellers: sort by soldQuantity descending
    const topSellers = [...withStock]
      .sort((a, b) => b.soldQuantity - a.soldQuantity)
      .slice(0, 12);

    // Deals: items with highest margin (resale vs cost)
    const deals = [...withStock]
      .filter((s) => s.targetResalePrice && s.targetResalePrice > 0)
      .sort((a, b) => {
        const marginA = (a.targetResalePrice ?? 0) - (a.purchaseUnitCost ?? 0);
        const marginB = (b.targetResalePrice ?? 0) - (b.purchaseUnitCost ?? 0);
        return marginB - marginA;
      })
      .slice(0, 12);

    // Featured: random selection
    const featured = [...withStock]
      .sort(() => Math.random() - 0.5)
      .slice(0, 12);

    return { newArrivals, topSellers, deals, featured };
  });
}
