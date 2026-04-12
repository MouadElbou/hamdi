/**
 * API client for fetching catalog data from the central backend.
 */

export const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? '';

export function getApiBase(): string {
  if (!API_BASE) {
    throw new Error('NEXT_PUBLIC_API_URL environment variable is required');
  }
  return API_BASE;
}

export interface CatalogItem {
  lotId: string;
  refNumber: string;
  date: string;
  category: string;
  designation: string;
  supplier: string;
  boutique: string;
  remainingQuantity: number;
  targetResalePrice: number | null;
}

export interface CatalogResponse {
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchCatalog(params: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  inStockOnly?: boolean;
}): Promise<CatalogResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.category) searchParams.set('category', params.category);
  if (params.search) searchParams.set('search', params.search);
  if (params.inStockOnly !== false) searchParams.set('inStockOnly', 'true');

  const res = await fetch(`${getApiBase()}/stock?${searchParams.toString()}`, {
    next: { revalidate: 60 }, // ISR: revalidate every 60 seconds
  });

  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  return res.json() as Promise<CatalogResponse>;
}

export async function fetchCategories(): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${getApiBase()}/stock/summary/by-category`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const data = await res.json() as { summary: Array<{ category: string }> };
  return data.summary.map((c, i) => ({ id: String(i), name: c.category }));
}

/** Build a WhatsApp URL with order intent text. */
export function buildWhatsAppURL(
  phoneNumber: string,
  items: Array<{ designation: string; quantity: number; price: number | null }>,
): string {
  const lines = items.map((item, i) =>
    `${i + 1}. ${item.designation} x${item.quantity}${item.price ? ` — ${(item.price / 100).toFixed(2)} DH` : ''}`
  );

  const text = [
    'Bonjour, je souhaite commander :',
    '',
    ...lines,
    '',
    'Merci de confirmer la disponibilité et le prix.',
  ].join('\n');

  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`;
}
