/**
 * Tests for StockService — mocked Prisma, testing computation logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StockService } from '../src/services/stock-service.js';

// Minimal Prisma mock factory
function createMockPrisma() {
  return {
    purchaseLot: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    saleLine: {
      aggregate: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  } as any;
}

describe('StockService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: StockService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new StockService(prisma);
  });

  describe('getLotStock', () => {
    it('returns null when lot not found', async () => {
      prisma.purchaseLot.findFirst.mockResolvedValue(null);
      const result = await service.getLotStock('nonexistent-id');
      expect(result).toBeNull();
    });

    it('computes stock detail correctly for a lot with sales', async () => {
      prisma.purchaseLot.findFirst.mockResolvedValue({
        id: 'lot-1',
        refNumber: 'REF001',
        date: new Date('2024-06-15'),
        category: { name: 'ADAPTATEURS' },
        supplier: { code: 'AB' },
        boutique: { name: 'MLILIYA' },
        designation: 'Chargeur USB-C',
        initialQuantity: 20,
        purchaseUnitCost: 1500,
        targetResalePrice: 2500,
        saleLines: [{ quantity: 5 }, { quantity: 3 }],
      });

      const result = await service.getLotStock('lot-1');

      expect(result).not.toBeNull();
      expect(result!.lotId).toBe('lot-1');
      expect(result!.initialQuantity).toBe(20);
      expect(result!.soldQuantity).toBe(8);
      expect(result!.remainingQuantity).toBe(12);
      expect(result!.currentStockValue).toBe(18000); // 12 * 1500
      expect(result!.category).toBe('ADAPTATEURS');
      expect(result!.supplier).toBe('AB');
      expect(result!.boutique).toBe('MLILIYA');
    });

    it('handles lot with zero sales', async () => {
      prisma.purchaseLot.findFirst.mockResolvedValue({
        id: 'lot-2',
        refNumber: 'REF002',
        date: new Date('2024-07-01'),
        category: { name: 'CASQUES' },
        supplier: { code: 'F5' },
        boutique: { name: 'TAYRET' },
        designation: 'Casque Bluetooth',
        initialQuantity: 10,
        purchaseUnitCost: 3000,
        targetResalePrice: 5000,
        saleLines: [],
      });

      const result = await service.getLotStock('lot-2');

      expect(result!.soldQuantity).toBe(0);
      expect(result!.remainingQuantity).toBe(10);
      expect(result!.currentStockValue).toBe(30000);
    });

    it('handles fully sold lot', async () => {
      prisma.purchaseLot.findFirst.mockResolvedValue({
        id: 'lot-3',
        refNumber: 'REF003',
        date: new Date('2024-01-01'),
        category: { name: 'PILES' },
        supplier: { code: 'MAG' },
        boutique: { name: 'MLILIYA' },
        designation: 'Piles AA',
        initialQuantity: 50,
        purchaseUnitCost: 200,
        targetResalePrice: 400,
        saleLines: [{ quantity: 30 }, { quantity: 20 }],
      });

      const result = await service.getLotStock('lot-3');

      expect(result!.soldQuantity).toBe(50);
      expect(result!.remainingQuantity).toBe(0);
      expect(result!.currentStockValue).toBe(0);
    });
  });

  describe('getAvailableQuantity', () => {
    it('returns 0 when lot not found', async () => {
      prisma.purchaseLot.findFirst.mockResolvedValue(null);
      const qty = await service.getAvailableQuantity('nonexistent');
      expect(qty).toBe(0);
    });

    it('returns remaining quantity', async () => {
      prisma.purchaseLot.findFirst.mockResolvedValue({
        id: 'lot-1',
        initialQuantity: 20,
      });
      prisma.saleLine.aggregate.mockResolvedValue({
        _sum: { quantity: 8 },
      });

      const qty = await service.getAvailableQuantity('lot-1');
      expect(qty).toBe(12);
    });

    it('handles null aggregate (no sales)', async () => {
      prisma.purchaseLot.findFirst.mockResolvedValue({
        id: 'lot-1',
        initialQuantity: 20,
      });
      prisma.saleLine.aggregate.mockResolvedValue({
        _sum: { quantity: null },
      });

      const qty = await service.getAvailableQuantity('lot-1');
      expect(qty).toBe(20);
    });
  });

  describe('computeClosingStockValue', () => {
    it('returns aggregated total from SQL query', async () => {
      prisma.$queryRaw.mockResolvedValue([{ total: BigInt(54000) }]);

      const total = await service.computeClosingStockValue();
      expect(total).toBe(54000);
    });

    it('returns 0 when no stock exists', async () => {
      prisma.$queryRaw.mockResolvedValue([{ total: BigInt(0) }]);

      const total = await service.computeClosingStockValue();
      expect(total).toBe(0);
    });

    it('handles null total gracefully', async () => {
      prisma.$queryRaw.mockResolvedValue([{ total: null }]);

      const total = await service.computeClosingStockValue();
      expect(total).toBe(0);
    });
  });

  describe('computeSalesTotals', () => {
    it('returns aggregated sales total and margin', async () => {
      prisma.$queryRaw.mockResolvedValue([{
        salesTotal: BigInt(100000),
        salesMargin: BigInt(25000),
      }]);

      const start = new Date('2024-01-01');
      const end = new Date('2024-02-01');
      const result = await service.computeSalesTotals(start, end);

      expect(result.salesTotal).toBe(100000);
      expect(result.salesMargin).toBe(25000);
    });

    it('returns zeros when no sales in range', async () => {
      prisma.$queryRaw.mockResolvedValue([{
        salesTotal: BigInt(0),
        salesMargin: BigInt(0),
      }]);

      const result = await service.computeSalesTotals(new Date(), new Date());
      expect(result.salesTotal).toBe(0);
      expect(result.salesMargin).toBe(0);
    });

    it('handles null values gracefully', async () => {
      prisma.$queryRaw.mockResolvedValue([{
        salesTotal: null,
        salesMargin: null,
      }]);

      const result = await service.computeSalesTotals(new Date(), new Date());
      expect(result.salesTotal).toBe(0);
      expect(result.salesMargin).toBe(0);
    });
  });

  describe('computeSummaryByCategory', () => {
    it('returns summary grouped by category with grand total', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { category: 'ADAPTATEURS', totalLots: BigInt(5), totalRemaining: BigInt(30), totalValue: BigInt(45000) },
        { category: 'CASQUES', totalLots: BigInt(3), totalRemaining: BigInt(15), totalValue: BigInt(30000) },
      ]);

      const result = await service.computeSummaryByCategory();

      expect(result.summary).toHaveLength(2);
      expect(result.summary[0]).toEqual({
        category: 'ADAPTATEURS',
        totalLots: 5,
        totalRemaining: 30,
        totalValue: 45000,
      });
      expect(result.summary[1]).toEqual({
        category: 'CASQUES',
        totalLots: 3,
        totalRemaining: 15,
        totalValue: 30000,
      });
      expect(result.grandTotal).toBe(75000);
    });

    it('returns empty summary when no stock', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.computeSummaryByCategory();

      expect(result.summary).toHaveLength(0);
      expect(result.grandTotal).toBe(0);
    });

    it('handles single category', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { category: 'PILES', totalLots: BigInt(1), totalRemaining: BigInt(100), totalValue: BigInt(20000) },
      ]);

      const result = await service.computeSummaryByCategory();

      expect(result.summary).toHaveLength(1);
      expect(result.grandTotal).toBe(20000);
    });
  });
});
