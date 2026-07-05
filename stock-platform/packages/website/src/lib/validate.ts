/**
 * Parse a client-supplied numeric field (priceCents / stock) into a
 * non-negative integer, or null. Whitespace-only strings become null (so the
 * storefront shows "Sur demande" rather than a free 0,00), and negatives are
 * clamped to 0 (never store a negative price or stock).
 */
export function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
}
