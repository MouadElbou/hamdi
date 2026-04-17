import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const secret = process.env['JWT_SECRET'];
if (!secret && process.env['NODE_ENV'] !== 'development') {
  throw new Error('FATAL: JWT_SECRET environment variable is required in non-development environments');
}
const JWT_SECRET = new TextEncoder().encode(secret ?? 'dev-jwt-secret-' + Math.random().toString(36));

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow admin login page and its assets
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return NextResponse.next();
  }

  // Get token from cookie or Authorization header
  const token =
    request.cookies.get('admin_token')?.value ??
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Restrict /admin/users to admin role only
    if (pathname.startsWith('/admin/users')) {
      const role = (payload as Record<string, unknown>).role;
      if (role !== 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
    }

    return NextResponse.next();
  } catch {
    // Token invalid or expired — redirect to login
    const response = NextResponse.redirect(new URL('/admin/login', request.url));
    response.cookies.delete('admin_token');
    return response;
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};
