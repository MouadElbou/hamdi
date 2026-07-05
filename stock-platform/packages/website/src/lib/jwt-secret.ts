// Single source of truth for the admin JWT secret, shared by lib/auth.ts and
// middleware.ts so the two can never drift (a mismatch caused an /admin login
// loop). Resolved LAZILY (at request time) so `next build` — which runs with
// NODE_ENV=production and no secret — never throws at module load.
export function getJwtSecret(): Uint8Array {
  const secret = process.env['JWT_SECRET'];
  if (secret) return new TextEncoder().encode(secret);
  // Fail closed everywhere except real local development.
  if (process.env['NODE_ENV'] !== 'development') {
    throw new Error('FATAL: JWT_SECRET environment variable is required outside development');
  }
  // Dev-only fixed fallback: identical in both consumers so tokens verify.
  return new TextEncoder().encode('dev-jwt-secret-change-me');
}
