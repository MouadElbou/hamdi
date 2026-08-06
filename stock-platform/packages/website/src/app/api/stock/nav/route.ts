import { NextResponse } from 'next/server';
import { getNavTree } from '@/lib/catalog';

// Category → sub-category tree for the header mega-menu. Cached at the edge:
// it changes only when the catalogue does, and every page hits it once.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tree = await getNavTree();
    return NextResponse.json(
      { tree },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' } },
    );
  } catch {
    // Answer 503, not an empty 200: the client must be able to tell "catalogue
    // is empty" (cacheable) from "DB is down" (retry on the next mount).
    return NextResponse.json({ error: 'nav_unavailable' }, { status: 503 });
  }
}
