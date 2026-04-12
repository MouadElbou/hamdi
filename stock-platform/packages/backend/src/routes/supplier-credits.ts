import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

const CreateSupplierCreditSchema = z.object({
  date: z.string().date(),
  supplier: z.string().trim().min(1),
  designation: z.string().trim().min(1),
  totalAmount: z.number().int().positive(),
  advancePaid: z.number().int().min(0).optional().default(0),
});

const RecordPaymentSchema = z.object({
  date: z.string().date(),
  amount: z.number().int().positive(),
});

export async function supplierCreditRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get('/', async (request) => {
    const { page = '1', limit = '50' } = request.query as Record<string, string | undefined>;
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200);
    const skip = (pageNum - 1) * take;

    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.supplierCredit.findMany({
        where,
        include: {
          supplier: true,
          payments: { where: { deletedAt: null } },
        },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.supplierCredit.count({ where }),
    ]);

    const enhanced = items.map((c: typeof items[number]) => {
      const totalPayments = c.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
      const remainingBalance = c.totalAmount - c.advancePaid - totalPayments;
      return { ...c, totalPayments, remainingBalance };
    });

    return { items: enhanced, total, page: pageNum, limit: take };
  });

  app.post('/', async (request, reply) => {
    const body = CreateSupplierCreditSchema.parse(request.body);

    const supplier = await prisma.supplier.findFirst({ where: { code: body.supplier, deletedAt: null } });
    if (!supplier) return reply.badRequest(`Supplier '${body.supplier}' not found`);

    if (body.advancePaid > body.totalAmount) {
      return reply.badRequest(`Advance exceeds total amount`);
    }

    const credit = await prisma.supplierCredit.create({
      data: {
        id: uuidv7(),
        date: new Date(body.date),
        designation: body.designation.trim(),
        totalAmount: body.totalAmount,
        advancePaid: body.advancePaid,
        supplierId: supplier.id,
      },
      include: { supplier: true },
    });

    return reply.code(201).send(credit);
  });

  app.post<{ Params: { id: string } }>('/:id/payments', async (request, reply) => {
    const body = RecordPaymentSchema.parse(request.body);
    const { id } = request.params;

    const payment = await prisma.$transaction(async (tx) => {
      const credit = await tx.supplierCredit.findFirst({
        where: { id, deletedAt: null },
        include: { payments: { where: { deletedAt: null } } },
      });
      if (!credit) {
        const err = new Error('Supplier credit not found');
        (err as any).statusCode = 404;
        throw err;
      }

      const totalPayments = credit.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
      const remainingBalance = credit.totalAmount - credit.advancePaid - totalPayments;

      if (body.amount > remainingBalance) {
        const err = new Error('Payment exceeds remaining balance');
        (err as any).statusCode = 400;
        throw err;
      }

      return tx.supplierCreditPayment.create({
        data: {
          id: uuidv7(),
          date: new Date(body.date),
          amount: body.amount,
          supplierCreditId: id,
        },
      });
    }, { isolationLevel: 'Serializable' });

    return reply.code(201).send(payment);
  });
}
