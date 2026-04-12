/**
 * Validation helpers for domain inputs.
 * Used in both backend API and desktop app before persisting data.
 */

import {
  SUPPLIERS,
  BOUTIQUES,
  BOUTIQUE_ALIASES,
  CATEGORIES,
  CATEGORY_ALIASES,
  EXPENSE_ALIASES,
  type Supplier,
  type Boutique,
  type Category,
} from './constants.js';

// ─── Result type ─────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

function fail(...errors: string[]): ValidationResult {
  return { valid: false, errors };
}

function merge(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  return { valid: errors.length === 0, errors };
}

// ─── Normalization ───────────────────────────────────────────────────────────

/** Normalize a boutique value: resolve aliases, uppercase, trim. */
export function normalizeBoutique(raw: string): Boutique | null {
  const trimmed = raw.trim();
  const alias = BOUTIQUE_ALIASES[trimmed] ?? BOUTIQUE_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  const upper = trimmed.toUpperCase() as Boutique;
  if ((BOUTIQUES as readonly string[]).includes(upper)) return upper;
  return null;
}

/** Normalize a category value: resolve aliases, trim. */
export function normalizeCategory(raw: string): Category | null {
  // Try exact alias match first (aliases have trailing spaces etc.)
  const alias = CATEGORY_ALIASES[raw];
  if (alias) return alias;
  // Trim and try again
  const trimmed = raw.trim();
  const trimAlias = CATEGORY_ALIASES[trimmed];
  if (trimAlias) return trimAlias;
  // Uppercase and try alias + canonical
  const upper = trimmed.toUpperCase();
  const upperAlias = CATEGORY_ALIASES[upper];
  if (upperAlias) return upperAlias;
  if ((CATEGORIES as readonly string[]).includes(upper)) return upper as Category;
  return null;
}

/** Normalize a supplier value. */
export function normalizeSupplier(raw: string): Supplier | null {
  const trimmed = raw.trim().toUpperCase();
  if ((SUPPLIERS as readonly string[]).includes(trimmed)) return trimmed as Supplier;
  return null;
}

/** Normalize expense designation: resolve aliases, trim, uppercase. */
export function normalizeExpenseDesignation(raw: string): string {
  const trimmed = raw.trim();
  return EXPENSE_ALIASES[trimmed] ?? EXPENSE_ALIASES[trimmed.toLowerCase()] ?? trimmed.toUpperCase();
}

// ─── Field validators ────────────────────────────────────────────────────────

export function validateRequired(value: unknown, field: string): ValidationResult {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return fail(`${field} is required`);
  }
  return ok();
}

export function validatePositiveInt(value: unknown, field: string): ValidationResult {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return fail(`${field} must be a positive integer`);
  }
  return ok();
}

export function validateNonNegativeInt(value: unknown, field: string): ValidationResult {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return fail(`${field} must be a non-negative integer`);
  }
  return ok();
}

export function validateISODate(value: unknown, field: string): ValidationResult {
  if (typeof value !== 'string') return fail(`${field} must be a date string`);
  const d = new Date(value);
  if (isNaN(d.getTime())) return fail(`${field} is not a valid date`);
  return ok();
}

export function validateNotZeroPlaceholder(value: unknown, field: string): ValidationResult {
  if (typeof value === 'string' && value.trim() === '0') {
    return fail(`${field} cannot be '0'`);
  }
  return ok();
}

// ─── Composite validators ────────────────────────────────────────────────────

export interface PurchaseInput {
  date: string;
  category: string;
  designation: string;
  supplier: string;
  boutique: string;
  initialQuantity: number;
  purchaseUnitCost: number;
  targetResalePrice: number | null;
}

export function validatePurchase(input: PurchaseInput): ValidationResult {
  return merge(
    validateISODate(input.date, 'date'),
    validateRequired(input.category, 'category'),
    normalizeCategory(input.category) === null
      ? fail(`category '${input.category}' is not a valid canonical category`)
      : ok(),
    validateRequired(input.designation, 'designation'),
    validateNotZeroPlaceholder(input.designation, 'designation'),
    validateRequired(input.supplier, 'supplier'),
    normalizeSupplier(input.supplier) === null
      ? fail(`supplier '${input.supplier}' is not valid`)
      : ok(),
    validateRequired(input.boutique, 'boutique'),
    normalizeBoutique(input.boutique) === null
      ? fail(`boutique '${input.boutique}' is not valid`)
      : ok(),
    validatePositiveInt(input.initialQuantity, 'initialQuantity'),
    validatePositiveInt(input.purchaseUnitCost, 'purchaseUnitCost'),
    input.targetResalePrice !== null
      ? validatePositiveInt(input.targetResalePrice, 'targetResalePrice')
      : ok(),
  );
}

export interface SaleLineInput {
  lotId: string;
  quantity: number;
  sellingUnitPrice: number;
  availableStock: number;
}

export function validateSaleLine(input: SaleLineInput): ValidationResult {
  return merge(
    validateRequired(input.lotId, 'lotId'),
    validatePositiveInt(input.quantity, 'quantity'),
    validatePositiveInt(input.sellingUnitPrice, 'sellingUnitPrice'),
    input.quantity > input.availableStock
      ? fail(`quantity ${input.quantity} exceeds available stock ${input.availableStock}`)
      : ok(),
  );
}

export interface MaintenanceInput {
  date: string;
  designation: string;
  price: number;
  boutique: string;
}

export function validateMaintenance(input: MaintenanceInput): ValidationResult {
  return merge(
    validateISODate(input.date, 'date'),
    validateRequired(input.designation, 'designation'),
    validateNotZeroPlaceholder(input.designation, 'designation'),
    validatePositiveInt(input.price, 'price'),
    validateRequired(input.boutique, 'boutique'),
  );
}

export interface ExpenseInput {
  date: string;
  designation: string;
  amount: number;
  boutique: string;
}

export function validateExpense(input: ExpenseInput): ValidationResult {
  return merge(
    validateISODate(input.date, 'date'),
    validateRequired(input.designation, 'designation'),
    validateNotZeroPlaceholder(input.designation, 'designation'),
    validatePositiveInt(input.amount, 'amount'),
    validateRequired(input.boutique, 'boutique'),
  );
}

export interface CustomerCreditInput {
  date: string;
  customerName: string;
  designation: string;
  quantity: number;
  unitPrice: number;
  advancePaid: number;
}

export function validateCustomerCredit(input: CustomerCreditInput): ValidationResult {
  const total = input.quantity * input.unitPrice;
  return merge(
    validateISODate(input.date, 'date'),
    validateRequired(input.customerName, 'customerName'),
    validateRequired(input.designation, 'designation'),
    validatePositiveInt(input.quantity, 'quantity'),
    validatePositiveInt(input.unitPrice, 'unitPrice'),
    validateNonNegativeInt(input.advancePaid, 'advancePaid'),
    input.advancePaid > total
      ? fail(`advancePaid (${input.advancePaid}) exceeds total amount (${total})`)
      : ok(),
  );
}

export interface BankMovementInput {
  date: string;
  description: string;
  amountIn: number;
  amountOut: number;
}

export function validateBankMovement(input: BankMovementInput): ValidationResult {
  return merge(
    validateISODate(input.date, 'date'),
    validateRequired(input.description, 'description'),
    validateNonNegativeInt(input.amountIn, 'amountIn'),
    validateNonNegativeInt(input.amountOut, 'amountOut'),
    input.amountIn > 0 && input.amountOut > 0
      ? fail('a bank movement should have either amountIn or amountOut, not both')
      : ok(),
    input.amountIn === 0 && input.amountOut === 0
      ? fail('a bank movement must have at least one non-zero amount')
      : ok(),
  );
}
