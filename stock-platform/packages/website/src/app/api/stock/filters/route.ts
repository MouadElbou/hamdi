import { NextRequest, NextResponse } from 'next/server';
import { getFilterOptions } from '@/lib/catalog';

// Distinct brands / device types / subcategories available (optionally scoped
// to a category) — drives the catalogue filter sidebar.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') ?? undefined;
  const options = await getFilterOptions(category);
  return NextResponse.json(options);
}
