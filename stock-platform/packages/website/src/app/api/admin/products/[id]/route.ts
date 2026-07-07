import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getAdminFromRequest } from '@/lib/auth';
import { toIntOrNull, trimOrNull, toStringArray } from '@/lib/validate';

export const dynamic = 'force-dynamic';

interface ProductPatch {
  name?: unknown;
  category?: unknown;
  subCategory?: unknown;
  brand?: unknown;
  deviceType?: unknown;
  compatibleModels?: unknown;
  description?: unknown;
  priceCents?: unknown;
  stock?: unknown;
  imageUrl?: unknown;
  published?: unknown;
}

// Only Prisma's "record not found" maps to 404; anything else is a real server error.
function isNotFound(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025';
}

// PUT — update a product.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as ProductPatch;

  const data: Record<string, unknown> = {};
  if (typeof b.name === 'string') data['name'] = b.name.trim();
  if (typeof b.category === 'string') data['category'] = b.category.trim();
  if (b.subCategory !== undefined) data['subCategory'] = trimOrNull(b.subCategory);
  if (b.brand !== undefined) data['brand'] = trimOrNull(b.brand);
  if (b.deviceType !== undefined) data['deviceType'] = trimOrNull(b.deviceType);
  if (b.compatibleModels !== undefined) data['compatibleModels'] = toStringArray(b.compatibleModels);
  if (b.description !== undefined) data['description'] = trimOrNull(b.description);
  if (b.priceCents !== undefined) data['priceCents'] = toIntOrNull(b.priceCents);
  if (b.stock !== undefined) data['stock'] = toIntOrNull(b.stock);
  if (b.imageUrl !== undefined) data['imageUrl'] = typeof b.imageUrl === 'string' && b.imageUrl.trim() ? b.imageUrl.trim() : null;
  if (b.published !== undefined) data['published'] = Boolean(b.published);

  try {
    const product = await prisma.product.update({ where: { id }, data });
    return NextResponse.json({ product });
  } catch (e) {
    if (isNotFound(e)) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    console.error('PUT /api/admin/products/[id] failed:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE — remove a product.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (isNotFound(e)) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    console.error('DELETE /api/admin/products/[id] failed:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
