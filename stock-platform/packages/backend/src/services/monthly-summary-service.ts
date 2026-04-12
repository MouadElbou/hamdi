/**
 * Monthly summary service — auto-computes revenue/expense totals
 * for a given month from transactional data, using shared formulas.
 */

import type { PrismaClient } from '@prisma/client';
import { computeMonthlySummary, type MonthlySummaryInputs } from '@stock/shared';
import { StockService } from './stock-service.js';

/** Auto-computed values derived from transactional tables */
export interface MonthlyAutoValues {
  salesTotal: number;
  salesMargin: number;
  purchaseEquivalent: number;
  maintenanceTotal: number;
  chargesDivers: number;
}

export class MonthlySummaryService {
  private stockService: StockService;

  constructor(private prisma: PrismaClient) {
    this.stockService = new StockService(prisma);
  }

  /** Auto-compute values for a given month from transactional data */
  async computeAutoValues(year: number, month: number): Promise<MonthlyAutoValues> {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));
    const dateRange = { gte: startDate, lt: endDate };

    // Sales totals
    const { salesTotal, salesMargin } = await this.stockService.computeSalesTotals(startDate, endDate);

    // Maintenance revenue
    const maintenanceAgg = await this.prisma.maintenanceJob.aggregate({
      where: { date: dateRange, deletedAt: null },
      _sum: { price: true },
    });
    const maintenanceTotal = maintenanceAgg._sum.price ?? 0;

    // Expenses total (charges divers)
    const expenseAgg = await this.prisma.expense.aggregate({
      where: { date: dateRange, deletedAt: null },
      _sum: { amount: true },
    });
    const chargesDivers = expenseAgg._sum.amount ?? 0;

    return {
      salesTotal,
      salesMargin,
      purchaseEquivalent: salesTotal - salesMargin,
      maintenanceTotal,
      chargesDivers,
    };
  }

  /** Compute full monthly summary from inputs (auto + manual) */
  computeSummary(inputs: MonthlySummaryInputs) {
    return computeMonthlySummary(inputs);
  }
}
