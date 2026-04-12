import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

const CreateBankMovementSchema = z.object({
  date: z.string().date(),
  description: z.string().trim().min(1),
  amountIn: z.number().int().min(0).optional().default(0),
  amountOut: z.number().int().min(0).optional().default(0),
}).refine(
  (d) => (d.amountIn > 0) !== (d.amountOut > 0),
  'A bank movement must have either amountIn or amountOut, not both and not neither',
);

const UpdateBankMovementSchema = z.object({
  date: z.string().date(),
  description: z.string().trim().min(1),
  amountIn: z.number().int().min(0).optional().default(0),
  amountOut: z.number().int().min(0).optional().default(0),
  version: z.number().int().min(1),
}).refine(
  (d) => (d.amountIn > 0) !== (d.amountOut > 0),
  'A bank movement must have either amountIn or amountOut, not both and not neither',
);

export async function bankMovementRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get('/', async (request) => {
    const { page = '1', limit = '50' } = request.query as Record<string, string | undefined>;
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200);
    const skip = (pageNum - 1) * take;

    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.bankMovement.findMany({ where, orderBy: { date: 'desc' }, skip, take }),
      prisma.bankMovement.count({ where }),
    ]);

    return { items, total, page: pageNum, limit: take };
  });

  app.get('/summary', async () => {
    const agg = await prisma.bankMovement.aggregate({
      where: { deletedAt: null },
      _sum: { amountIn: true, amountOut: true },
    });
    const totalIn = agg._sum.amountIn ?? 0;
    const totalOut = agg._sum.amountOut ?? 0;
    return { totalIn, totalOut, balanceDelta: totalIn - totalOut };
  });

  app.post('/', async (request, reply) => {
    const body = CreateBankMovementSchema.parse(request.body);

    const movement = await prisma.bankMovement.create({
      data: {
        id: uuidv7(),
        date: new Date(body.date),
        description: body.description.trim(),
        amountIn: body.amountIn,
        amountOut: body.amountOut,
      },
    });

    return reply.code(201).send(movement);
  });

  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = UpdateBankMovementSchema.parse(request.body);
    const { id } = request.params;

    const movement = await prisma.$transaction(async (tx) => {
      const existing = await tx.bankMovement.findFirst({ where: { id, deletedAt: null } });
      if (!existing) return null;
      if (existing.version !== body.version) {
        throw Object.assign(
          new Error(`Version conflict: server=${existing.version}, client=${body.version}`),
          { statusCode: 409 },
        );
      }
      return tx.bankMovement.update({
        where: { id },
        data: {
          date: new Date(body.date),
          description: body.description.trim(),
          amountIn: body.amountIn,
          amountOut: body.amountOut,
          version: { increment: 1 },
        },
      });
    }, { isolationLevel: 'Serializable' });

    if (!movement) return reply.notFound('Bank movement not found');
    return movement;
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.bankMovement.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!existing) return null;

      await tx.bankMovement.update({
        where: { id: request.params.id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      return { deleted: true };
    }, { isolationLevel: 'Serializable' });

    if (!result) return reply.notFound('Bank movement not found');
    return result;
  });
}
