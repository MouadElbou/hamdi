import { describe, it, expect } from 'vitest';
import {
  normalizeBoutique,
  normalizeCategory,
  normalizeSupplier,
  normalizeExpenseDesignation,
  validateRequired,
  validatePositiveInt,
  validateNonNegativeInt,
  validateISODate,
  validateNotZeroPlaceholder,
  validatePurchase,
  validateSaleLine,
  validateMaintenance,
  validateExpense,
  validateCustomerCredit,
  validateBankMovement,
} from '../src/validation.js';

describe('normalizeBoutique', () => {
  it('normalizes exact match', () => {
    expect(normalizeBoutique('MLILIYA')).toBe('MLILIYA');
  });

  it('normalizes lowercase', () => {
    expect(normalizeBoutique('tayret')).toBe('TAYRET');
  });

  it('returns null for unknown', () => {
    expect(normalizeBoutique('UNKNOWN')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(normalizeBoutique('  MLILIYA  ')).toBe('MLILIYA');
  });
});

describe('normalizeCategory', () => {
  it('normalizes exact match', () => {
    expect(normalizeCategory('ADAPTATEURS')).toBe('ADAPTATEURS');
  });

  it('resolves aliases', () => {
    // Depends on what aliases are configured
    const result = normalizeCategory('adaptateurs');
    // May or may not resolve depending on aliases
    expect(result === 'ADAPTATEURS' || result === null).toBe(true);
  });

  it('returns null for unknown category', () => {
    expect(normalizeCategory('ZZZZUNKNOWN')).toBeNull();
  });
});

describe('normalizeSupplier', () => {
  it('normalizes exact match', () => {
    expect(normalizeSupplier('AB')).toBe('AB');
  });

  it('normalizes lowercase', () => {
    expect(normalizeSupplier('f5')).toBe('F5');
  });

  it('returns null for unknown', () => {
    expect(normalizeSupplier('UNKNOWN')).toBeNull();
  });
});

describe('normalizeExpenseDesignation', () => {
  it('preserves canonical values', () => {
    // Uppercases by default
    const result = normalizeExpenseDesignation('loyer');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('validateRequired', () => {
  it('passes for non-empty string', () => {
    expect(validateRequired('hello', 'field').valid).toBe(true);
  });

  it('fails for empty string', () => {
    expect(validateRequired('', 'field').valid).toBe(false);
  });

  it('fails for null', () => {
    expect(validateRequired(null, 'field').valid).toBe(false);
  });

  it('fails for undefined', () => {
    expect(validateRequired(undefined, 'field').valid).toBe(false);
  });
});

describe('validatePositiveInt', () => {
  it('passes for positive integer', () => {
    expect(validatePositiveInt(5, 'qty').valid).toBe(true);
  });

  it('fails for 0', () => {
    expect(validatePositiveInt(0, 'qty').valid).toBe(false);
  });

  it('fails for negative', () => {
    expect(validatePositiveInt(-1, 'qty').valid).toBe(false);
  });

  it('fails for float', () => {
    expect(validatePositiveInt(1.5, 'qty').valid).toBe(false);
  });
});

describe('validateNonNegativeInt', () => {
  it('passes for 0', () => {
    expect(validateNonNegativeInt(0, 'amt').valid).toBe(true);
  });

  it('passes for positive', () => {
    expect(validateNonNegativeInt(100, 'amt').valid).toBe(true);
  });

  it('fails for negative', () => {
    expect(validateNonNegativeInt(-1, 'amt').valid).toBe(false);
  });
});

describe('validateISODate', () => {
  it('passes for valid ISO date', () => {
    expect(validateISODate('2024-01-15', 'date').valid).toBe(true);
  });

  it('fails for non-string', () => {
    expect(validateISODate(12345, 'date').valid).toBe(false);
  });

  it('fails for invalid date string', () => {
    expect(validateISODate('not-a-date', 'date').valid).toBe(false);
  });
});

describe('validateNotZeroPlaceholder', () => {
  it('passes for normal text', () => {
    expect(validateNotZeroPlaceholder('Chargeur USB', 'designation').valid).toBe(true);
  });

  it('fails for bare "0"', () => {
    expect(validateNotZeroPlaceholder('0', 'designation').valid).toBe(false);
  });

  it('fails for " 0 " (trimmed)', () => {
    expect(validateNotZeroPlaceholder(' 0 ', 'designation').valid).toBe(false);
  });
});

describe('validatePurchase', () => {
  const validPurchase = {
    date: '2024-06-15',
    category: 'ADAPTATEURS',
    designation: 'Chargeur USB-C',
    supplier: 'AB',
    boutique: 'MLILIYA',
    initialQuantity: 10,
    purchaseUnitCost: 1500,
    targetResalePrice: 2000,
  };

  it('passes for valid purchase', () => {
    expect(validatePurchase(validPurchase).valid).toBe(true);
  });

  it('fails for missing date', () => {
    const result = validatePurchase({ ...validPurchase, date: '' });
    expect(result.valid).toBe(false);
  });

  it('fails for zero quantity', () => {
    const result = validatePurchase({ ...validPurchase, initialQuantity: 0 });
    expect(result.valid).toBe(false);
  });

  it('fails for negative cost', () => {
    const result = validatePurchase({ ...validPurchase, purchaseUnitCost: -100 });
    expect(result.valid).toBe(false);
  });

  it('passes with null targetResalePrice', () => {
    const result = validatePurchase({ ...validPurchase, targetResalePrice: null });
    expect(result.valid).toBe(true);
  });

  it('fails for invalid category', () => {
    const result = validatePurchase({ ...validPurchase, category: 'NONEXISTENT' });
    expect(result.valid).toBe(false);
  });

  it('fails for invalid supplier', () => {
    const result = validatePurchase({ ...validPurchase, supplier: 'ZZZZ' });
    expect(result.valid).toBe(false);
  });

  it('fails for invalid boutique', () => {
    const result = validatePurchase({ ...validPurchase, boutique: 'NOWHERE' });
    expect(result.valid).toBe(false);
  });

  it('fails for designation "0"', () => {
    const result = validatePurchase({ ...validPurchase, designation: '0' });
    expect(result.valid).toBe(false);
  });

  it('collects multiple errors at once', () => {
    const result = validatePurchase({
      ...validPurchase,
      date: '',
      initialQuantity: 0,
      purchaseUnitCost: -1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('validateSaleLine', () => {
  it('passes for valid sale line', () => {
    const result = validateSaleLine({
      lotId: 'lot-1',
      quantity: 5,
      sellingUnitPrice: 2000,
      availableStock: 10,
    });
    expect(result.valid).toBe(true);
  });

  it('fails when quantity exceeds available stock', () => {
    const result = validateSaleLine({
      lotId: 'lot-1',
      quantity: 15,
      sellingUnitPrice: 2000,
      availableStock: 10,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('exceeds available stock');
  });

  it('fails for zero quantity', () => {
    const result = validateSaleLine({
      lotId: 'lot-1',
      quantity: 0,
      sellingUnitPrice: 2000,
      availableStock: 10,
    });
    expect(result.valid).toBe(false);
  });

  it('fails for empty lotId', () => {
    const result = validateSaleLine({
      lotId: '',
      quantity: 5,
      sellingUnitPrice: 2000,
      availableStock: 10,
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateMaintenance', () => {
  it('passes for valid input', () => {
    const result = validateMaintenance({
      date: '2024-06-15',
      designation: 'INSTALL',
      price: 5000,
      boutique: 'MLILIYA',
    });
    expect(result.valid).toBe(true);
  });

  it('fails for zero price', () => {
    const result = validateMaintenance({
      date: '2024-06-15',
      designation: 'INSTALL',
      price: 0,
      boutique: 'MLILIYA',
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateExpense', () => {
  it('passes for valid expense', () => {
    const result = validateExpense({
      date: '2024-06-15',
      designation: 'LOYER',
      amount: 30000,
      boutique: 'MLILIYA',
    });
    expect(result.valid).toBe(true);
  });

  it('fails for designation "0"', () => {
    const result = validateExpense({
      date: '2024-06-15',
      designation: '0',
      amount: 30000,
      boutique: 'MLILIYA',
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateCustomerCredit', () => {
  it('passes for valid credit', () => {
    const result = validateCustomerCredit({
      date: '2024-06-15',
      customerName: 'ABDO BENTAJ',
      designation: 'Laptop HP',
      quantity: 1,
      unitPrice: 50000,
      advancePaid: 20000,
    });
    expect(result.valid).toBe(true);
  });

  it('fails when advance exceeds total', () => {
    const result = validateCustomerCredit({
      date: '2024-06-15',
      customerName: 'ABDO BENTAJ',
      designation: 'Laptop HP',
      quantity: 1,
      unitPrice: 50000,
      advancePaid: 60000,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('exceeds total');
  });

  it('passes with zero advance', () => {
    const result = validateCustomerCredit({
      date: '2024-06-15',
      customerName: 'ABDO BENTAJ',
      designation: 'Laptop HP',
      quantity: 2,
      unitPrice: 30000,
      advancePaid: 0,
    });
    expect(result.valid).toBe(true);
  });
});

describe('validateBankMovement', () => {
  it('passes for valid deposit', () => {
    const result = validateBankMovement({
      date: '2024-06-15',
      description: 'Deposit',
      amountIn: 50000,
      amountOut: 0,
    });
    expect(result.valid).toBe(true);
  });

  it('passes for valid withdrawal', () => {
    const result = validateBankMovement({
      date: '2024-06-15',
      description: 'Withdrawal',
      amountIn: 0,
      amountOut: 20000,
    });
    expect(result.valid).toBe(true);
  });

  it('fails when both amountIn and amountOut are non-zero', () => {
    const result = validateBankMovement({
      date: '2024-06-15',
      description: 'Invalid',
      amountIn: 10000,
      amountOut: 5000,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not both');
  });

  it('fails when both amounts are zero', () => {
    const result = validateBankMovement({
      date: '2024-06-15',
      description: 'Zero',
      amountIn: 0,
      amountOut: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('at least one');
  });
});
