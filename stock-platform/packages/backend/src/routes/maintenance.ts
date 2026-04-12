import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

const CreateMaintenanceSchema = z.object({
  date: z.string().date(),
  designation: z.string().trim().min(1).refine((v) => v.trim() !== '0', 'designation cannot be 0'),
  price: z.number().int().positive(),
  boutique: z.string().trim().min(1),
});

const UpdateMaintenanceSchema = z.object({
  date: z.string().date().optional(),
  designation: z.string().trim().min(1).optional(),
  price: z.number().int().positive().optional(),
  boutique: z.string().trim().min(1).optional(),
  version: z.number().int(),
});

export async function maintenanceRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get('/', async (request) => {
    const { page = '1', limit = '50' } = request.query as Record<string, string | undefined>;
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200);
    const skip = (pageNum - 1) * take;

    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.maintenanceJob.findMany({
        where,
        include: { boutique: true },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.maintenanceJob.count({ where }),
    ]);

    return { items, total, page: pageNum, limit: take };
  });

  app.post('/', async (request, reply) => {
    const body = CreateMaintenanceSchema.parse(request.body);

    const boutique = await prisma.boutique.findFirst({ where: { name: body.boutique, deletedAt: null } });
    if (!boutique) return reply.badRequest(`Boutique '${body.boutique}' not found`);

    const job = await prisma.maintenanceJob.create({
      data: {
        id: uuidv7(),
        date: new Date(body.date),
        designation: body.designation.trim(),
        price: body.price,
        boutiqueId: boutique.id,
      },
      include: { boutique: true },
    });

    return reply.code(201).send(job);
  });

  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = UpdateMaintenanceSchema.parse(request.body);
    const { id } = request.params;

    const existing = await prisma.maintenanceJob.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return reply.notFound('Maintenance job not found');

    const job = await prisma.$transaction(async (tx) => {
      let boutiqueId = existing.boutiqueId;
      if (body.boutique !== undefined) {
        const boutique = await tx.boutique.findFirst({ where: { name: body.boutique, deletedAt: null } });
        if (!boutique) {
          const err = new Error(`Boutique '${body.boutique}' not found`);
          (err as any).statusCode = 400;
          throw err;
        }
        boutiqueId = boutique.id;
      }

      const current = await tx.maintenanceJob.findUnique({ where: { id } });
      if (!current || current.version !== body.version) {
        const err = new Error('Version mismatch — pull latest before updating');
        (err as any).statusCode = 409;
        throw err;
      }

      return tx.maintenanceJob.update({
        where: { id },
        data: {
          ...(body.date !== undefined && { date: new Date(body.date) }),
          ...(body.designation !== undefined && { designation: body.designation.trim() }),
          ...(body.price !== undefined && { price: body.price }),
          ...(body.boutique !== undefined && { boutiqueId }),
          version: { increment: 1 },
        },
        include: { boutique: true },
      });
    }, { isolationLevel: 'Serializable' });

    return job;
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.maintenanceJob.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!existing) return null;

      await tx.maintenanceJob.update({
        where: { id: request.params.id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      return { deleted: true };
    }, { isolationLevel: 'Serializable' });

    if (!result) return reply.notFound('Maintenance job not found');
    return result;
  });
}
