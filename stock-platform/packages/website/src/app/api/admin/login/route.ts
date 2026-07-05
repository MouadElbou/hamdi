import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = body.username?.trim();
  const password = body.password;
  if (!username || !password) {
    return NextResponse.json({ error: 'Identifiants requis' }, { status: 400 });
  }

  const user = await prisma.adminUser.findUnique({ where: { username } });
  // Always run a compare (constant-ish time) whether or not the user exists.
  const dummyHash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8./GA0i6r4iP4bXpEXO7uJ4pS3f9Fe';
  const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !ok) {
    return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });
  }

  const token = await signAdminToken({ sub: user.id, username: user.username });
  // The client stores the token in a (JS-readable) cookie via admin-api's
  // setToken; middleware.ts and the /api/admin/* routes both accept that cookie.
  return NextResponse.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.username,
      role: 'admin',
      mustChangePassword: false,
      permissions: [],
    },
  });
}
