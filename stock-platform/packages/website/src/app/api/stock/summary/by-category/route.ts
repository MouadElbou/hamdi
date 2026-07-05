import { NextResponse } from 'next/server';
import { getCategorySummary } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const summary = await getCategorySummary();
  return NextResponse.json({ summary });
}
