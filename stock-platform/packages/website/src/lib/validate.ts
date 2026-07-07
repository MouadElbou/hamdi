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

/** Trimmed non-empty string, or null. */
export function trimOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Accepts an array or a comma-separated string → clean string array. */
export function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}
