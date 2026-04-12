import { describe, it, expect } from 'vitest';
import {
  purchaseTotalAmount,
  remainingQuantity,
  stockValue,
  saleTotalAmount,
  saleMargin,
  customerCreditTotal,
  customerCreditBalance,
  supplierCreditBalance,
  bankBalanceDelta,
  computeMonthlySummary,
  computeZakat,
} from '../src/formulas.js';

describe('purchaseTotalAmount', () => {
  it('multiplies quantity by unit cost', () => {
    expect(purchaseTotalAmount(10, 1500)).toBe(15000);
  });

  it('returns 0 for zero quantity', () => {
    expect(purchaseTotalAmount(0, 1500)).toBe(0);
  });
});

describe('remainingQuantity', () => {
  it('returns difference between initial and sold', () => {
    expect(remainingQuantity(10, 3)).toBe(7);
  });

  it('returns 0 when fully sold', () => {
    expect(remainingQuantity(5, 5)).toBe(0);
  });
});

describe('stockValue', () => {
  it('multiplies remaining by cost', () => {
    expect(stockValue(7, 1500)).toBe(10500);
  });
});

describe('saleTotalAmount', () => {
  it('multiplies quantity by selling price', () => {
    expect(saleTotalAmount(3, 2000)).toBe(6000);
  });
});

describe('saleMargin', () => {
  it('computes margin = (sale - cost) * qty', () => {
    expect(saleMargin(2000, 1500, 3)).toBe(1500);
  });

  it('returns negative margin when sold below cost', () => {
    expect(saleMargin(1000, 1500, 2)).toBe(-1000);
  });
});

describe('customerCreditTotal', () => {
  it('computes total credit amount', () => {
    expect(customerCreditTotal(5, 3000)).toBe(15000);
  });
});

describe('customerCreditBalance', () => {
  it('returns remaining balance after advance', () => {
    expect(customerCreditBalance(15000, 5000)).toBe(10000);
  });
});

describe('supplierCreditBalance', () => {
  it('returns remaining owed to supplier', () => {
    expect(supplierCreditBalance(50000, 20000)).toBe(30000);
  });
});

describe('bankBalanceDelta', () => {
  it('returns net delta', () => {
    expect(bankBalanceDelta(100000, 60000)).toBe(40000);
  });
});

describe('computeMonthlySummary', () => {
  const input = {
    salesTotal: 500000,      // 5000.00 DA
    salesMargin: 100000,     // 1000.00 DA margin
    maintenanceTotal: 30000, // 300.00 DA
    fibreK: 10000,
    fibreS: 5000,
    chargesDivers: 0,
    manualExpenseLines: [
      { label: 'Loyer', amount: 20000 },
      { label: 'Électricité', amount: 5000 },
    ],
    hicham: 40000,
    samir: 30000,
  };

  it('computes purchaseEquivalent as sales - margin', () => {
    const result = computeMonthlySummary(input);
    expect(result.purchaseEquivalent).toBe(400000);
  });

  it('computes totalMargin from sales margin + maintenance + fibre', () => {
    const result = computeMonthlySummary(input);
    // salesTotal - purchaseEquivalent + maintenance + fibreK + fibreS
    // 500000 - 400000 + 30000 + 10000 + 5000 = 145000
    expect(result.totalMargin).toBe(145000);
  });

  it('computes marginRate as fraction', () => {
    const result = computeMonthlySummary(input);
    // (500000 - 400000) / 500000 = 0.2
    expect(result.marginRate).toBe(0.2);
  });

  it('returns null marginRate when salesTotal is 0', () => {
    const zeroSales = { ...input, salesTotal: 0, salesMargin: 0 };
    const result = computeMonthlySummary(zeroSales);
    expect(result.marginRate).toBeNull();
  });

  it('computes totalExpenses from manual lines', () => {
    const result = computeMonthlySummary(input);
    expect(result.totalExpenses).toBe(25000);
  });

  it('computes profit as totalMargin - totalExpenses', () => {
    const result = computeMonthlySummary(input);
    expect(result.profit).toBe(120000); // 145000 - 25000
  });

  it('computes totalSalary', () => {
    const result = computeMonthlySummary(input);
    expect(result.totalSalary).toBe(70000);
  });

  it('computes annualBalance as profit - totalSalary', () => {
    const result = computeMonthlySummary(input);
    expect(result.annualBalance).toBe(50000); // 120000 - 70000
  });
});

describe('computeZakat', () => {
  const input = {
    closingStockValue: 2000000,   // 20,000.00 DA
    closingBankBalance: 500000,   // 5,000.00 DA
    closingCash: 100000,          // 1,000.00 DA
    creditDeduction: 300000,      // 3,000.00 DA
    zakatAdvances: 10000,         // 100.00 DA
  };

  it('computes totalAssets = stock + bank + cash', () => {
    const result = computeZakat(input);
    expect(result.totalAssets).toBe(2600000);
  });

  it('computes zakatBase = totalAssets - creditDeduction', () => {
    const result = computeZakat(input);
    expect(result.zakatBase).toBe(2300000);
  });

  it('computes zakatDue at 2.5% rate', () => {
    const result = computeZakat(input);
    // 2300000 * 0.025 = 57500
    expect(result.zakatDue).toBe(57500);
  });

  it('computes zakatRemaining = due - advances', () => {
    const result = computeZakat(input);
    expect(result.zakatRemaining).toBe(47500); // 57500 - 10000
  });
});
