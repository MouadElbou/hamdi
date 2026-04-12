/**
 * Pure business formulas. All monetary inputs/outputs are in centimes (integers).
 * No side effects, no database access.
 */

// ─── Purchase ────────────────────────────────────────────────────────────────

/** Total cost of a purchase lot = qty * unit cost */
export function purchaseTotalAmount(quantity: number, unitCost: number): number {
  return quantity * unitCost;
}

// ─── Stock ───────────────────────────────────────────────────────────────────

/** Remaining quantity in a lot after all sales */
export function remainingQuantity(initialQty: number, soldQty: number): number {
  return initialQty - soldQty;
}

/** Current stock value = remaining qty * unit purchase cost */
export function stockValue(remainingQty: number, purchaseUnitCost: number): number {
  return remainingQty * purchaseUnitCost;
}

// ─── Sale ────────────────────────────────────────────────────────────────────

/** Total sale amount for a sale line */
export function saleTotalAmount(quantity: number, sellingUnitPrice: number): number {
  return quantity * sellingUnitPrice;
}

/** Margin for a sale line = (sale price - lot cost) * qty */
export function saleMargin(
  sellingUnitPrice: number,
  purchaseUnitCost: number,
  quantity: number,
): number {
  return (sellingUnitPrice - purchaseUnitCost) * quantity;
}

// ─── Customer Credit ─────────────────────────────────────────────────────────

/** Total credit amount = qty * unit price */
export function customerCreditTotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

/** Remaining balance on a customer credit */
export function customerCreditBalance(totalAmount: number, advancePaid: number): number {
  return totalAmount - advancePaid;
}

// ─── Supplier Credit ─────────────────────────────────────────────────────────

/** Remaining balance owed to supplier */
export function supplierCreditBalance(totalAmount: number, advancePaid: number): number {
  return totalAmount - advancePaid;
}

// ─── Bank ────────────────────────────────────────────────────────────────────

/** Net bank balance delta */
export function bankBalanceDelta(totalIn: number, totalOut: number): number {
  return totalIn - totalOut;
}

// ─── Monthly Summary ─────────────────────────────────────────────────────────

export interface MonthlySummaryInputs {
  salesTotal: number;
  salesMargin: number;
  maintenanceTotal: number;
  fibreK: number;
  fibreS: number;
  chargesDivers: number;
  manualExpenseLines: { label: string; amount: number }[];
  hicham: number;
  samir: number;
}

export interface MonthlySummaryComputed {
  purchaseEquivalent: number;
  totalMargin: number;
  marginRate: number | null;
  totalExpenses: number;
  profit: number;
  totalSalary: number;
  annualBalance: number;
}

export function computeMonthlySummary(input: MonthlySummaryInputs): MonthlySummaryComputed {
  const purchaseEquivalent = input.salesTotal - input.salesMargin;
  const totalMargin =
    input.salesTotal - purchaseEquivalent + input.maintenanceTotal + input.fibreK + input.fibreS;
  const marginRate =
    input.salesTotal === 0
      ? null
      : Math.round(
          ((input.salesTotal - purchaseEquivalent) / input.salesTotal) * 10000,
        ) / 10000;
  const totalExpenses = input.chargesDivers + input.manualExpenseLines.reduce((sum, l) => sum + l.amount, 0);
  const profit = totalMargin - totalExpenses;
  const totalSalary = input.hicham + input.samir;
  const annualBalance = profit - totalSalary;

  return {
    purchaseEquivalent,
    totalMargin,
    marginRate,
    totalExpenses,
    profit,
    totalSalary,
    annualBalance,
  };
}

// ─── Zakat ───────────────────────────────────────────────────────────────────

import { ZAKAT_RATE } from './constants.js';

export interface ZakatInputs {
  closingStockValue: number;
  closingBankBalance: number;
  closingCash: number;
  creditDeduction: number;
  zakatAdvances: number;
}

export interface ZakatComputed {
  totalAssets: number;
  zakatBase: number;
  zakatDue: number;
  zakatRemaining: number;
}

export function computeZakat(input: ZakatInputs): ZakatComputed {
  const totalAssets = input.closingStockValue + input.closingBankBalance + input.closingCash;
  const zakatBase = totalAssets - input.creditDeduction;
  const zakatDue = Math.round(Math.max(0, zakatBase) * ZAKAT_RATE);
  const zakatRemaining = zakatDue - input.zakatAdvances;

  return { totalAssets, zakatBase, zakatDue, zakatRemaining };
}
