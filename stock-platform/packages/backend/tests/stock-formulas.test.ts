/**
 * Tests for shared formulas used in the stock service layer.
 * These test the pure computation logic without database access.
 */

import { describe, it, expect } from 'vitest';
import {
  purchaseTotalAmount,
  remainingQuantity,
  stockValue,
  saleTotalAmount,
  saleMargin,
  customerCreditBalance,
  supplierCreditBalance,
} from '@stock/shared';

describe('Stock computation formulas', () => {
  it('computes lot-based stock correctly', () => {
    // Lot: 20 units at 1500 centimes each
    const initial = 20;
    const cost = 1500;
    const sold = 8;

    const remaining = remainingQuantity(initial, sold);
    expect(remaining).toBe(12);

    const value = stockValue(remaining, cost);
    expect(value).toBe(18000); // 12 * 1500
  });

  it('computes sale margin correctly', () => {
    // Sell 5 units: bought at 1500, sell at 2000
    const margin = saleMargin(2000, 1500, 5);
    expect(margin).toBe(2500); // (2000-1500) * 5
  });

  it('computes sale total amount', () => {
    expect(saleTotalAmount(5, 2000)).toBe(10000);
  });

  it('computes purchase total', () => {
    expect(purchaseTotalAmount(20, 1500)).toBe(30000);
  });
});

describe('Credit balance formulas', () => {
  it('computes customer credit balance', () => {
    // Total 10000, paid 3000
    expect(customerCreditBalance(10000, 3000)).toBe(7000);
  });

  it('computes supplier credit balance', () => {
    // Owed 50000, paid 20000
    expect(supplierCreditBalance(50000, 20000)).toBe(30000);
  });
});

describe('Multi-lot stock scenario', () => {
  it('aggregates value across multiple lots', () => {
    const lots = [
      { initial: 20, sold: 8, cost: 1500 },
      { initial: 10, sold: 10, cost: 2000 }, // fully sold
      { initial: 50, sold: 5, cost: 800 },
    ];

    const totalValue = lots.reduce((total, lot) => {
      const rem = remainingQuantity(lot.initial, lot.sold);
      return total + (rem > 0 ? stockValue(rem, lot.cost) : 0);
    }, 0);

    // Lot 1: 12 * 1500 = 18000
    // Lot 2: 0 (fully sold)
    // Lot 3: 45 * 800 = 36000
    expect(totalValue).toBe(54000);
  });
});
