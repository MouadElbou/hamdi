import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

const CreateBatteryRepairSchema = z.object({
  date: z.string().date(),
  description: z.string().trim().min(1),
  customerNote: z.string().nullable().optional(),
  amount: z.number().int().positive(),
  costAdjustment: z.number().int().optional().default(0),
});

const UpdateBatteryRepairSchema = z.object({
  date: z.string().date().optional(),
  description: z.string().trim().min(1).optional(),
  customerNote: z.string().nullable().optional(),
  amount: z.number().int().positive().optional(),
  costAdjustment: z.number().int().optional(),
  version: z.number().int(),
});

const UpdateTariffSchema = z.object({
  particuliersPrice: z.number().int().min(0),
  revPrice: z.number().int().min(0),
  version: z.number().int(),
});

export async function batteryRepairRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get('/', async (request) => {
    const { page = '1', limit = '50' } = request.query as Record<string, string | undefined>;
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200);
    const skip = (pageNum - 1) * take;

    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.batteryRepairJob.findMany({ where, orderBy: { date: 'desc' }, skip, take }),
      prisma.batteryRepairJob.count({ where }),
    ]);

    return { items, total, page: pageNum, limit: take };
  });

  app.get('/tariffs', async () => {
    return prisma.batteryTariff.findMany({
      where: { deletedAt: null },
      orderBy: { label: 'asc' },
    });
  });

  app.post('/', async (request, reply) => {
    const body = CreateBatteryRepairSchema.parse(request.body);

    const job = await prisma.batteryRepairJob.create({
      data: {
        id: uuidv7(),
        date: new Date(body.date),
        description: body.description.trim(),
        customerNote: body.customerNote ?? null,
        amount: body.amount,
        costAdjustment: body.costAdjustment,
      },
    });

    return reply.code(201).send(job);
  });

  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = UpdateBatteryRepairSchema.parse(request.body);
    const { id } = request.params;

    const existing = await prisma.batteryRepairJob.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return reply.notFound('Battery repair job not found');

    const job = await prisma.$transaction(async (tx) => {
      const current = await tx.batteryRepairJob.findUnique({ where: { id } });
      if (!current || current.deletedAt || current.version !== body.version) {
        const err = new Error('Version mismatch — pull latest before updating');
        (err as any).statusCode = 409;
        throw err;
      }

      return tx.batteryRepairJob.update({
        where: { id },
        data: {
          ...(body.date !== undefined && { date: new Date(body.date) }),
          ...(body.description !== undefined && { description: body.description.trim() }),
          ...(body.customerNote !== undefined && { customerNote: body.customerNote }),
          ...(body.amount !== undefined && { amount: body.amount }),
          ...(body.costAdjustment !== undefined && { costAdjustment: body.costAdjustment }),
          version: { increment: 1 },
        },
      });
    }, { isolationLevel: 'Serializable' });

    return job;
  });

  // Tariff management
  app.put<{ Params: { id: string } }>('/tariffs/:id', async (request, reply) => {
    const body = UpdateTariffSchema.parse(request.body);
    const { id } = request.params;

    const existing = await prisma.batteryTariff.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return reply.notFound('Tariff not found');

    const tariff = await prisma.$transaction(async (tx) => {
      const current = await tx.batteryTariff.findUnique({ where: { id } });
      if (!current || current.deletedAt || current.version !== body.version) {
        const err = new Error('Version mismatch — pull latest before updating');
        (err as any).statusCode = 409;
        throw err;
      }

      return tx.batteryTariff.update({
        where: { id },
        data: {
          particuliersPrice: body.particuliersPrice,
          revPrice: body.revPrice,
          version: { increment: 1 },
        },
      });
    }, { isolationLevel: 'Serializable' });

    return tariff;
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.batteryRepairJob.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!existing) return null;

      await tx.batteryRepairJob.update({
        where: { id: request.params.id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      return { deleted: true };
    }, { isolationLevel: 'Serializable' });

    if (!result) return reply.notFound('Battery repair job not found');
    return result;
  });
}
