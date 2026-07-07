import { NextRequest, NextResponse } from 'next/server';
import { getCatalogItems } from '@/lib/catalog';

// Public catalogue endpoint consumed by the client-side CatalogBrowser.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = await getCatalogItems({
    page: sp.get('page') ? parseInt(sp.get('page')!, 10) : undefined,
    limit: sp.get('limit') ? parseInt(sp.get('limit')!, 10) : undefined,
    category: sp.get('category') ?? undefined,
    subCategory: sp.get('subCategory') ?? undefined,
    brand: sp.get('brand') ?? undefined,
    deviceType: sp.get('deviceType') ?? undefined,
    search: sp.get('search') ?? undefined,
    inStockOnly: sp.get('inStockOnly') === 'true',
  });
  return NextResponse.json(result);
}
