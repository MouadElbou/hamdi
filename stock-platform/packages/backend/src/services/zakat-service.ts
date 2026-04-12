/**
 * Zakat service — computes annual zakat from closing stock
 * value, bank balance, cash, and credit deductions.
 * Uses shared formulas matching the ZakatInputs interface.
 */

import type { PrismaClient } from '@prisma/client';
import { computeZakat, type ZakatInputs } from '@stock/shared';
import { StockService } from './stock-service.js';

export class ZakatService {
  private stockService: StockService;

  constructor(private prisma: PrismaClient) {
    this.stockService = new StockService(prisma);
  }

  /** Compute closing stock value automatically from lots */
  async computeAutoStockValue(): Promise<number> {
    return this.stockService.computeClosingStockValue();
  }

  /** Compute zakat for a snapshot including advances */
  async computeForSnapshot(snapshotId: string) {
    const snapshot = await this.prisma.zakatSnapshot.findFirst({
      where: { id: snapshotId, deletedAt: null },
      include: { advances: { where: { deletedAt: null } } },
    });
    if (!snapshot) return null;

    const zakatAdvances = snapshot.advances.reduce(
      (s: number, a: { amount: number }) => s + a.amount, 0,
    );

    const inputs: ZakatInputs = {
      closingStockValue: snapshot.closingStockValue,
      closingBankBalance: snapshot.closingBankBalance,
      closingCash: snapshot.closingCash,
      creditDeduction: snapshot.creditDeduction,
      zakatAdvances,
    };

    const computed = computeZakat(inputs);

    return { snapshot, ...computed, zakatAdvances };
  }

  /** Record a zakat advance payment */
  async recordAdvance(snapshotId: string, amount: number, date: Date) {
    return this.prisma.zakatAdvance.create({
      data: {
        id: (await import('uuid')).v7(),
        zakatSnapshotId: snapshotId,
        amount,
        date,
      },
    });
  }
}
