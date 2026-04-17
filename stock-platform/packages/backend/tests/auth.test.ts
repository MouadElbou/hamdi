/**
 * Tests for auth route logic — validates login, refresh, change-password
 * business rules using mocked Prisma and bcrypt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock bcrypt before importing the module under test
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

import bcrypt from 'bcryptjs';

// We test the auth logic by building a minimal Fastify app with the auth routes
import Fastify from 'fastify';
import { authRoutes } from '../src/routes/auth.js';

function createMockPrisma() {
  return {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

function createTestApp(prisma: ReturnType<typeof createMockPrisma>) {
  const app = Fastify({ logger: false });

  // Decorate with prisma mock
  app.decorate('prisma', prisma as any);

  // Register JWT
  app.register(import('@fastify/jwt'), { secret: 'test-secret-key-for-unit-tests' });

  // Register sensible for reply.unauthorized, reply.badRequest, reply.notFound
  app.register(import('@fastify/sensible'));

  // Register auth routes
  app.register(authRoutes, { prefix: '/api/auth' });

  return app;
}

describe('Auth Routes', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    app = createTestApp(prisma);
    await app.ready();
  });

  describe('POST /api/auth/login', () => {
    const validUser = {
      id: 'user-1',
      username: 'admin',
      passwordHash: '$2a$12$hashedpassword',
      displayName: 'Admin User',
      role: 'admin',
      isActive: true,
      deletedAt: null,
      mustChangePassword: false,
      permissions: [{ pageKey: 'stock' }, { pageKey: 'sales' }],
    };

    it('returns token and user on valid login', async () => {
      prisma.user.findFirst.mockResolvedValue(validUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'correctpassword' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.token).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user.id).toBe('user-1');
      expect(body.user.username).toBe('admin');
      expect(body.user.role).toBe('admin');
      expect(body.user.permissions).toEqual(['stock', 'sales']);
    });

    it('returns 401 for wrong password', async () => {
      prisma.user.findFirst.mockResolvedValue(validUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'wrongpassword' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for non-existent user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'nonexistent', password: 'password' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for inactive user', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...validUser, isActive: false });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'correctpassword' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for soft-deleted user', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...validUser, deletedAt: new Date() });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'correctpassword' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects empty username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: '', password: 'password' },
      });

      // Zod validation will throw, resulting in a non-200 response
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('rejects empty password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: '' },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('rejects missing body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {},
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns new access token for valid refresh token', async () => {
      // First, get a valid refresh token by logging in
      const validUser = {
        id: 'user-1',
        username: 'admin',
        passwordHash: '$2a$12$hash',
        displayName: 'Admin',
        role: 'admin',
        isActive: true,
        deletedAt: null,
        mustChangePassword: false,
        permissions: [{ pageKey: 'stock' }],
      };

      prisma.user.findFirst.mockResolvedValue(validUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'pass' },
      });
      const { refreshToken } = loginRes.json();

      // Now use the refresh token
      prisma.user.findUnique.mockResolvedValue(validUser);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.token).toBeDefined();
    });

    it('returns 401 for invalid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: 'invalid-token-string' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for an access token used as refresh token', async () => {
      // Login to get a regular access token (type is not 'refresh')
      const validUser = {
        id: 'user-1',
        username: 'admin',
        passwordHash: '$2a$12$hash',
        displayName: 'Admin',
        role: 'admin',
        isActive: true,
        deletedAt: null,
        mustChangePassword: false,
        permissions: [{ pageKey: 'stock' }],
      };

      prisma.user.findFirst.mockResolvedValue(validUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'pass' },
      });
      const { token } = loginRes.json();

      // Try to use the access token as a refresh token
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: token },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 401 when user is inactive', async () => {
      const validUser = {
        id: 'user-1',
        username: 'admin',
        passwordHash: '$2a$12$hash',
        displayName: 'Admin',
        role: 'admin',
        isActive: true,
        deletedAt: null,
        mustChangePassword: false,
        permissions: [{ pageKey: 'stock' }],
      };

      prisma.user.findFirst.mockResolvedValue(validUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'pass' },
      });
      const { refreshToken } = loginRes.json();

      // User deactivated between login and refresh
      prisma.user.findUnique.mockResolvedValue({ ...validUser, isActive: false });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    const validUser = {
      id: 'user-1',
      username: 'admin',
      passwordHash: '$2a$12$hash',
      displayName: 'Admin',
      role: 'admin',
      isActive: true,
      deletedAt: null,
      mustChangePassword: false,
      permissions: [{ pageKey: 'stock' }],
      version: 1,
    };

    async function getAuthToken() {
      prisma.user.findFirst.mockResolvedValue(validUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'pass' },
      });
      return loginRes.json().token;
    }

    it('changes password with valid current password', async () => {
      const token = await getAuthToken();

      // Reset mock for the change-password flow
      prisma.user.findUnique.mockResolvedValue(validUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('$2a$12$newhash');
      prisma.user.update.mockResolvedValue({ ...validUser, passwordHash: '$2a$12$newhash' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: { authorization: `Bearer ${token}` },
        payload: { currentPassword: 'oldpassword', newPassword: 'NewPass123' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('rejects with wrong current password', async () => {
      const token = await getAuthToken();

      prisma.user.findUnique.mockResolvedValue(validUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: { authorization: `Bearer ${token}` },
        payload: { currentPassword: 'wrong', newPassword: 'NewPass123' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        payload: { currentPassword: 'old', newPassword: 'NewPass123' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects weak new password (no uppercase)', async () => {
      const token = await getAuthToken();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: { authorization: `Bearer ${token}` },
        payload: { currentPassword: 'old', newPassword: 'weakpass1' },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('rejects short new password', async () => {
      const token = await getAuthToken();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: { authorization: `Bearer ${token}` },
        payload: { currentPassword: 'old', newPassword: 'Ab1' },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
});
