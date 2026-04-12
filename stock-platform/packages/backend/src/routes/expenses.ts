import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

const CreateExpenseSchema = z.object({
  date: z.string().date(),
  designation: z.string().trim().min(1).refine((v) => v.trim() !== '0', 'designation cannot be 0'),
  amount: z.number().int().positive(),
  boutique: z.string().trim().min(1),
});

const UpdateExpenseSchema = z.object({
  date: z.string().date().optional(),
  designation: z.string().trim().min(1).optional(),
  amount: z.number().int().positive().optional(),
  boutique: z.string().trim().min(1).optional(),
  version: z.number().int(),
});

export async function expenseRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get('/', async (request) => {
    const { page = '1', limit = '50', month, year } = request.query as Record<string, string | undefined>;
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200);
    const skip = (pageNum - 1) * take;

    const where: Record<string, unknown> = { deletedAt: null };
    if (year && month) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      if (isNaN(y) || isNaN(m) || m < 1 || m > 12 || y < 2000 || y > 2100) {
        return { items: [], total: 0, page: pageNum, limit: take };
      }
      const startDate = new Date(`${year}-${month.padStart(2, '0')}-01`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      where['date'] = { gte: startDate, lt: endDate };
    }

    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: { boutique: true },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.expense.count({ where }),
    ]);

    return { items, total, page: pageNum, limit: take };
  });

  app.post('/', async (request, reply) => {
    const body = CreateExpenseSchema.parse(request.body);

    const boutique = await prisma.boutique.findFirst({ where: { name: body.boutique, deletedAt: null } });
    if (!boutique) return reply.badRequest(`Boutique '${body.boutique}' not found`);

    const expense = await prisma.expense.create({
      data: {
        id: uuidv7(),
        date: new Date(body.date),
        designation: body.designation.trim(),
        amount: body.amount,
        boutiqueId: boutique.id,
      },
      include: { boutique: true },
    });

    return reply.code(201).send(expense);
  });

  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = UpdateExpenseSchema.parse(request.body);
    const { id } = request.params;

    const existing = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return reply.notFound('Expense not found');

    const expense = await prisma.$transaction(async (tx) => {
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

      const current = await tx.expense.findUnique({ where: { id } });
      if (!current || current.version !== body.version) {
        const err = new Error('Version mismatch — pull latest before updating');
        (err as any).statusCode = 409;
        throw err;
      }

      return tx.expense.update({
        where: { id },
        data: {
          ...(body.date !== undefined && { date: new Date(body.date) }),
          ...(body.designation !== undefined && { designation: body.designation.trim() }),
          ...(body.amount !== undefined && { amount: body.amount }),
          ...(body.boutique !== undefined && { boutiqueId }),
          version: { increment: 1 },
        },
        include: { boutique: true },
      });
    }, { isolationLevel: 'Serializable' });

    return expense;
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.expense.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!existing) return null;

      await tx.expense.update({
        where: { id: request.params.id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      return { deleted: true };
    }, { isolationLevel: 'Serializable' });

    if (!result) return reply.notFound('Expense not found');
    return result;
  });
}
