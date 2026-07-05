import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  return NextResponse.json({
    id: admin.sub,
    username: admin.username,
    displayName: admin.username,
    role: 'admin',
    mustChangePassword: false,
    permissions: [],
  });
}
