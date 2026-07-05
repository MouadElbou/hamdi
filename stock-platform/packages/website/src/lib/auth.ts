import { SignJWT, jwtVerify } from 'jose';
import { getJwtSecret } from './jwt-secret';

// Tokens are signed with the same secret middleware.ts verifies (shared via
// getJwtSecret), so a token from /api/admin/login is accepted for /admin/*.

export interface AdminPayload {
  sub: string;
  username: string;
}

export const ADMIN_COOKIE = 'admin_token';

export async function signAdminToken(payload: AdminPayload): Promise<string> {
  return new SignJWT({ username: payload.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub) return null;
    return { sub: String(payload.sub), username: String(payload['username'] ?? '') };
  } catch {
    return null;
  }
}

/** Extract + verify the admin token from a request (Bearer header or cookie). */
export async function getAdminFromRequest(req: Request): Promise<AdminPayload | null> {
  const authHeader = req.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) {
    const cookie = req.headers.get('cookie') ?? '';
    const match = new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`).exec(cookie);
    if (match?.[1]) token = decodeURIComponent(match[1]);
  }
  if (!token) return null;
  return verifyAdminToken(token);
}
