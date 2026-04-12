import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const createUserSchema = z.object({
  username: z.string().min(1).max(50).trim(),
  password: z.string().min(8).max(200)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain digit'),
  displayName: z.string().min(1).max(100).trim(),
  role: z.enum(['admin', 'employee']),
  permissions: z.array(z.string().max(50)).default([]),
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).trim().optional(),
  role: z.enum(['admin', 'employee']).optional(),
  isActive: z.boolean().optional(),
  permissions: z.array(z.string().max(50)).optional(),
  resetPassword: z.string().min(6).max(200).optional(),
});

/** Middleware: verify JWT and require admin role */
async function requireAdmin(request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.unauthorized('Token invalide');
  }
  const payload = request.user as { role: string };
  if (payload.role !== 'admin') {
    return reply.forbidden('Accès réservé aux administrateurs');
  }
}

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAdmin);

  // GET /api/users — list all users
  app.get('/', async () => {
    const users = await app.prisma.user.findMany({
      where: { deletedAt: null },
      include: { permissions: { select: { pageKey: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        permissions: u.permissions.map((p) => p.pageKey),
        createdAt: u.createdAt.toISOString(),
      })),
    };
  });

  // POST /api/users — create user
  app.post('/', async (request, reply) => {
    const body = createUserSchema.parse(request.body);

    const passwordHash = await bcrypt.hash(body.password, 12);
    const userId = randomUUID();

    let user;
    try {
      user = await app.prisma.user.create({
        data: {
          id: userId,
          username: body.username,
          passwordHash,
          displayName: body.displayName,
          role: body.role,
          mustChangePassword: true,
          permissions: {
            create: body.permissions.map((pageKey) => ({
              id: randomUUID(),
              pageKey,
            })),
          },
        },
        include: { permissions: { select: { pageKey: true } } },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return reply.conflict('Un utilisateur avec ce nom existe déjà');
      }
      throw err;
    }

    return reply.status(201).send({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      permissions: user.permissions.map((p) => p.pageKey),
    });
  });

  // PUT /api/users/:id — update user
  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const body = updateUserSchema.parse(request.body);

    const existing = await app.prisma.user.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return reply.notFound('Utilisateur introuvable');
    }

    const updateData: Record<string, unknown> = {};
    if (body.displayName !== undefined) updateData.displayName = body.displayName;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.resetPassword) {
      updateData.passwordHash = await bcrypt.hash(body.resetPassword, 12);
      updateData.mustChangePassword = true;
    }
    updateData.version = { increment: 1 };

    const result = await app.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: updateData,
      });

      // Update permissions if provided
      if (body.permissions !== undefined) {
        await tx.userPermission.deleteMany({ where: { userId: id } });
        if (body.permissions.length > 0) {
          await tx.userPermission.createMany({
            data: body.permissions.map((pageKey) => ({
              id: randomUUID(),
              userId: id,
              pageKey,
            })),
          });
        }
      }

      const permissions = await tx.userPermission.findMany({
        where: { userId: id },
        select: { pageKey: true },
      });

      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        permissions: permissions.map((p) => p.pageKey),
      };
    });

    return result;
  });

  // DELETE /api/users/:id — soft-delete user
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    // Prevent self-deletion
    const payload = request.user as { sub: string };
    if (payload.sub === id) {
      return reply.badRequest('Impossible de supprimer votre propre compte');
    }

    const existing = await app.prisma.user.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return reply.notFound('Utilisateur introuvable');
    }

    await app.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, version: { increment: 1 } },
    });

    return { success: true };
  });
};
