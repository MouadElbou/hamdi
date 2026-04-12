import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1).max(50).trim(),
  password: z.string().min(1).max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain digit'),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/auth/login
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await app.prisma.user.findFirst({
      where: { username: body.username, deletedAt: null },
      include: { permissions: true },
    });

    // Constant-time compare to prevent timing attacks
    const dummyHash = '$2a$12$000000000000000000000uGWDOjVTQJFdbHzFNmUzOxTNKNjEcqna';
    const isValid = await bcrypt.compare(body.password, user?.passwordHash ?? dummyHash);

    if (!user || !isValid || !user.isActive || user.deletedAt) {
      return reply.unauthorized('Identifiants invalides');
    }

    const token = app.jwt.sign(
      {
        sub: user.id,
        role: user.role,
        permissions: user.permissions.map((p) => p.pageKey),
      },
      { expiresIn: '24h' },
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        permissions: user.permissions.map((p) => p.pageKey),
      },
    };
  });

  // GET /api/auth/me — validate token & return current user
  app.get('/me', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.unauthorized('Token invalide');
    }

    const payload = request.user as { sub: string };
    const user = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { permissions: true },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return reply.unauthorized('Utilisateur désactivé');
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      permissions: user.permissions.map((p) => p.pageKey),
    };
  });

  // POST /api/auth/change-password
  app.post('/change-password', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.unauthorized('Token invalide');
    }

    const body = changePasswordSchema.parse(request.body);
    const payload = request.user as { sub: string };

    const user = await app.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return reply.unauthorized('Utilisateur désactivé');
    }

    const isValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!isValid) {
      return reply.badRequest('Mot de passe actuel incorrect');
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await app.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, version: { increment: 1 } },
    });

    return { success: true };
  });
};
