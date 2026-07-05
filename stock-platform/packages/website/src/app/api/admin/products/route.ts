import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminFromRequest } from '@/lib/auth';
import { toIntOrNull } from '@/lib/validate';

export const dynamic = 'force-dynamic';

interface ProductInput {
  name?: unknown;
  category?: unknown;
  description?: unknown;
  priceCents?: unknown;
  stock?: unknown;
  imageUrl?: unknown;
  published?: unknown;
}

// GET — list ALL products (published or not) for the admin.
export async function GET(req: NextRequest) {
  if (!(await getAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ products });
}

// POST — create a product.
export async function POST(req: NextRequest) {
  if (!(await getAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as ProductInput;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const category = typeof b.category === 'string' ? b.category.trim() : '';
  if (!name || !category) {
    return NextResponse.json({ error: 'Nom et catégorie requis' }, { status: 400 });
  }
  const product = await prisma.product.create({
    data: {
      name,
      category,
      description: typeof b.description === 'string' && b.description.trim() ? b.description.trim() : null,
      priceCents: toIntOrNull(b.priceCents),
      stock: toIntOrNull(b.stock),
      imageUrl: typeof b.imageUrl === 'string' && b.imageUrl.trim() ? b.imageUrl.trim() : null,
      published: b.published !== false,
    },
  });
  return NextResponse.json({ product }, { status: 201 });
}
