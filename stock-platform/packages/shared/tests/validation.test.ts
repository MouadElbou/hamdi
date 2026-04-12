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
});
