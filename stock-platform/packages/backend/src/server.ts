import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import fastifyJwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { purchaseRoutes } from './routes/purchases.js';
import { saleRoutes } from './routes/sales.js';
import { stockRoutes } from './routes/stock.js';
import { maintenanceRoutes } from './routes/maintenance.js';
import { batteryRepairRoutes } from './routes/battery-repair.js';
import { expenseRoutes } from './routes/expenses.js';
import { customerCreditRoutes } from './routes/customer-credits.js';
import { supplierCreditRoutes } from './routes/supplier-credits.js';
import { bankMovementRoutes } from './routes/bank-movements.js';
import { monthlySummaryRoutes } from './routes/monthly-summary.js';
import { zakatRoutes } from './routes/zakat.js';
import { syncRoutes } from './routes/sync.js';
import { clientRoutes } from './routes/clients.js';
import { employeeRoutes } from './routes/employees.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { referenceDataRoutes } from './routes/reference-data.js';

// ─── Environment validation ────────────────────────────────────────
if (!process.env['DATABASE_URL']) {
  console.error('FATAL: DATABASE_URL environment variable is required');
  process.exit(1);
}

const API_KEY = process.env['API_KEY'] ?? '';
const JWT_SECRET = process.env['JWT_SECRET'] ?? '';
const CORS_ORIGINS = process.env['CORS_ORIGINS']
  ? process.env['CORS_ORIGINS'].split(',')
  : (process.env['NODE_ENV'] === 'production' ? [] : true);

const prisma = new PrismaClient();

const app = Fastify({ logger: true });

// ─── CORS (B-C2) — whitelist in production ─────────────────────────
await app.register(cors, {
  origin: CORS_ORIGINS as string[] | true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
});
await app.register(sensible);

// ─── JWT authentication plugin ─────────────────────────────────────
if (!JWT_SECRET && process.env['NODE_ENV'] === 'production') {
  console.error('FATAL: JWT_SECRET environment variable is required in production');
  process.exit(1);
}
if (!API_KEY && process.env['NODE_ENV'] === 'production') {
  console.error('FATAL: API_KEY environment variable is required in production');
  process.exit(1);
}
await app.register(fastifyJwt, {
  secret: JWT_SECRET || 'dev-jwt-secret-change-in-production',
});

// ─── Rate limiting (B-C4) ──────────────────────────────────────────
const RATE_LIMIT_MAX = parseInt(process.env['RATE_LIMIT_MAX'] ?? '100', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env['RATE_LIMIT_WINDOW_MS'] ?? '60000', 10);

const rateLimitState = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAP_MAX = 10_000;
const rateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, state] of rateLimitState) {
    if (state.resetAt <= now) rateLimitState.delete(ip);
  }
}, 60_000);

app.addHook('onRequest', async (request, reply) => {
  const ip = request.ip;
  const now = Date.now();
  const state = rateLimitState.get(ip);
  if (!state || state.resetAt <= now) {
    if (rateLimitState.size >= RATE_LIMIT_MAP_MAX) {
      // Prevent memory exhaustion under DDoS — reject new IPs
      return reply.tooManyRequests('Rate limit exceeded');
    }
    rateLimitState.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    state.count++;
    if (state.count > RATE_LIMIT_MAX) {
      reply.header('Retry-After', Math.ceil((state.resetAt - now) / 1000));
      return reply.tooManyRequests('Rate limit exceeded');
    }
  }
});

// ─── API key / JWT authentication (B-C1) ───────────────────────────
app.addHook('onRequest', async (request, reply) => {
  // Skip auth for health check
  if (request.url === '/api/health') return;
  // Public stock catalog (GET only): try JWT but don't require it
  if (request.method === 'GET' && request.url.startsWith('/api/stock')) {
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (token.includes('.')) {
        try { await request.jwtVerify(); } catch { /* unauthenticated access is fine */ }
      }
    }
    return;
  }
  // Skip auth for login endpoint
  if (request.method === 'POST' && request.url === '/api/auth/login') return;

  // Try JWT first (for admin panel)
  const authHeader = request.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Check if it's a JWT (contains dots) vs API key
    if (token.includes('.')) {
      try {
        await request.jwtVerify();
        return; // JWT valid
      } catch {
        return reply.unauthorized('Token invalide ou expiré');
      }
    }
    // Otherwise treat as API key — timing-safe comparison
    if (API_KEY && token.length === API_KEY.length) {
      const a = Buffer.from(token);
      const b = Buffer.from(API_KEY);
      const { timingSafeEqual } = await import('node:crypto');
      if (timingSafeEqual(a, b)) return;
    }
  }

  if (!API_KEY) {
    if (process.env['NODE_ENV'] === 'production') {
      app.log.error('API_KEY environment variable is required in production');
      return reply.unauthorized('Server misconfigured: authentication not set up');
    }
    return; // Allow unauthenticated in dev
  }

  return reply.unauthorized('Invalid or missing authentication');
});

// ─── Global error handler (B-C3) ───────────────────────────────────
app.setErrorHandler((error: Error & { statusCode?: number; issues?: unknown }, request, reply) => {
  app.log.error({ err: error, url: request.url, method: request.method });
  // Zod validation errors → 400
  if (error.name === 'ZodError') {
    return reply.status(400).send({ error: 'Validation error', details: error.issues });
  }
  // Hide internal details in production
  const statusCode = error.statusCode ?? 500;
  if (statusCode >= 500) {
    return reply.status(statusCode).send({ error: 'Internal server error' });
  }
  return reply.status(statusCode).send({ error: error.message });
});

// Decorate with prisma
app.decorate('prisma', prisma);

// Register domain routes
await app.register(purchaseRoutes, { prefix: '/api/purchases' });
await app.register(saleRoutes, { prefix: '/api/sales' });
await app.register(stockRoutes, { prefix: '/api/stock' });
await app.register(maintenanceRoutes, { prefix: '/api/maintenance' });
await app.register(batteryRepairRoutes, { prefix: '/api/battery-repair' });
await app.register(expenseRoutes, { prefix: '/api/expenses' });
await app.register(customerCreditRoutes, { prefix: '/api/customer-credits' });
await app.register(supplierCreditRoutes, { prefix: '/api/supplier-credits' });
await app.register(bankMovementRoutes, { prefix: '/api/bank-movements' });
await app.register(monthlySummaryRoutes, { prefix: '/api/monthly-summary' });
await app.register(zakatRoutes, { prefix: '/api/zakat' });
await app.register(syncRoutes, { prefix: '/api/sync' });
await app.register(clientRoutes, { prefix: '/api/clients' });
await app.register(employeeRoutes, { prefix: '/api/employees' });
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(userRoutes, { prefix: '/api/users' });
await app.register(referenceDataRoutes, { prefix: '/api/reference' });

// Health check — verifies DB connectivity
app.get('/api/health', async (_request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', timestamp: new Date().toISOString() };
  } catch {
    return reply.status(503).send({ status: 'error', message: 'Database unreachable' });
  }
});

// Graceful shutdown
let syncCleanup: ReturnType<typeof setInterval> | undefined;
const shutdown = async () => {
  clearInterval(rateLimitCleanup);
  if (syncCleanup) clearInterval(syncCleanup);
  await app.close();
  await prisma.$disconnect();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

const port = parseInt(process.env['PORT'] ?? '3001', 10);

try {
  await app.listen({ port, host: process.env['HOST'] ?? '127.0.0.1' });
  console.log(`Server listening on http://localhost:${port}`);

  // H4: Periodic cleanup of old SyncProcessedOperation entries (every 24h)
  const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  syncCleanup = setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      const { count } = await prisma.syncProcessedOperation.deleteMany({
        where: { processedAt: { lt: cutoff } },
      });
      if (count > 0) app.log.info(`Cleaned up ${count} old SyncProcessedOperation entries`);
    } catch (err) {
      app.log.error(err, 'SyncProcessedOperation cleanup failed');
    }
  }, CLEANUP_INTERVAL_MS);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export { app, prisma };
