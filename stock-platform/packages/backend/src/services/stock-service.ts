/**
 * Stock service — lot-based stock computation.
 * This is the core business service. Stock is NEVER directly edited —
 * it is always derived from purchase lots and sale lines.
 */

import type { PrismaClient } from '@prisma/client';
import { remainingQuantity, stockValue } from '@stock/shared';

export interface StockLotDetail {
  lotId: string;
  refNumber: string;
  date: Date;
  category: string;
  designation: string;
  supplier: string;
  boutique: string;
  initialQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  purchaseUnitCost: number;
  targetResalePrice: number | null;
  currentStockValue: number;
}

export interface StockSummaryByCategory {
  category: string;
  totalLots: number;
  totalRemaining: number;
  totalValue: number;
}

export class StockService {
  constructor(private prisma: PrismaClient) {}

  /** Compute stock view for a single lot */
  async getLotStock(lotId: string): Promise<StockLotDetail | null> {
    const lot = await this.prisma.purchaseLot.findFirst({
      where: { id: lotId, deletedAt: null },
      include: {
        category: true,
        supplier: true,
        boutique: true,
        saleLines: { where: { deletedAt: null }, select: { quantity: true } },
      },
    });

    if (!lot) return null;

    const soldQty = lot.saleLines.reduce((s: number, l: { quantity: number }) => s + l.quantity, 0);
    const remaining = remainingQuantity(lot.initialQuantity, soldQty);

    return {
      lotId: lot.id,
      refNumber: lot.refNumber,
      date: lot.date,
      category: lot.category.name,
      designation: lot.designation,
      supplier: lot.supplier.code,
      boutique: lot.boutique.name,
      initialQuantity: lot.initialQuantity,
      soldQuantity: soldQty,
      remainingQuantity: remaining,
      purchaseUnitCost: lot.purchaseUnitCost,
      targetResalePrice: lot.targetResalePrice,
      currentStockValue: stockValue(remaining, lot.purchaseUnitCost),
    };
  }

  /** Check available quantity for a lot before sale */
  async getAvailableQuantity(lotId: string): Promise<number> {
    const lot = await this.prisma.purchaseLot.findFirst({
      where: { id: lotId, deletedAt: null },
    });
    if (!lot) return 0;

    const soldAgg = await this.prisma.saleLine.aggregate({
      where: { lotId, deletedAt: null },
      _sum: { quantity: true },
    });

    return remainingQuantity(lot.initialQuantity, soldAgg._sum.quantity ?? 0);
  }

  /** Compute total closing stock value (for zakat) — SQL aggregation */
  async computeClosingStockValue(): Promise<number> {
    const result = await this.prisma.$queryRaw<[{ total: bigint | null }]>`
      SELECT COALESCE(SUM(
        (pl."initialQuantity" - COALESCE(sold.qty, 0))::bigint * pl."purchaseUnitCost"
      ), 0) AS "total"
      FROM purchase_lots pl
      LEFT JOIN (
        SELECT sl."lotId", SUM(sl."quantity") AS qty
        FROM sale_lines sl
        WHERE sl."deletedAt" IS NULL
        GROUP BY sl."lotId"
      ) sold ON sold."lotId" = pl."id"
      WHERE pl."deletedAt" IS NULL
        AND (pl."initialQuantity" - COALESCE(sold.qty, 0)) > 0
    `;

    return Number(result[0]?.total ?? 0);
  }

  /** Compute sales totals for a date range (for monthly summary) */
  async computeSalesTotals(startDate: Date, endDate: Date): Promise<{ salesTotal: number; salesMargin: number }> {
    // BH-3: Use SQL aggregation instead of loading all sale lines into memory
    const result = await this.prisma.$queryRaw<
      [{ salesTotal: bigint | null; salesMargin: bigint | null }]
    >`
      SELECT
        COALESCE(SUM(sl."quantity" * sl."sellingUnitPrice"), 0) AS "salesTotal",
        COALESCE(SUM((sl."sellingUnitPrice" - pl."purchaseUnitCost") * sl."quantity"), 0) AS "salesMargin"
      FROM sale_lines sl
      JOIN sale_orders so ON so."id" = sl."saleOrderId"
      JOIN purchase_lots pl ON pl."id" = sl."lotId"
      WHERE sl."deletedAt" IS NULL
        AND so."deletedAt" IS NULL
        AND so."date" >= ${startDate}
        AND so."date" < ${endDate}
    `;

    return {
      salesTotal: Number(result[0]?.salesTotal ?? 0),
      salesMargin: Number(result[0]?.salesMargin ?? 0),
    };
  }

  /** Summary grouped by category */
  async computeSummaryByCategory(): Promise<{ summary: StockSummaryByCategory[]; grandTotal: number }> {
    const lots = await this.prisma.purchaseLot.findMany({
      where: { deletedAt: null },
      include: {
        category: true,
        saleLines: { where: { deletedAt: null }, select: { quantity: true } },
      },
    });

    const map = new Map<string, StockSummaryByCategory>();

    for (const lot of lots) {
      const soldQty = lot.saleLines.reduce((s: number, l: { quantity: number }) => s + l.quantity, 0);
      const remaining = remainingQuantity(lot.initialQuantity, soldQty);
      if (remaining <= 0) continue;

      const key = lot.category.name;
      const entry = map.get(key) ?? { category: key, totalLots: 0, totalRemaining: 0, totalValue: 0 };
      entry.totalLots += 1;
      entry.totalRemaining += remaining;
      entry.totalValue += stockValue(remaining, lot.purchaseUnitCost);
      map.set(key, entry);
    }

    const summary = Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
    const grandTotal = summary.reduce((s, c) => s + c.totalValue, 0);

    return { summary, grandTotal };
  }
}
