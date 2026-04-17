import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

function httpError(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode });
}

const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const CreateSupplierCreditSchema = z.object({
  date: z.string().date(),
  supplier: z.string().trim().min(1),
  designation: z.string().trim().min(1),
  totalAmount: z.number().int().positive(),
  advancePaid: z.number().int().min(0).optional().default(0),
});

const UpdateSupplierCreditSchema = z.object({
  designation: z.string().trim().min(1).optional(),
  totalAmount: z.number().int().positive().optional(),
  advancePaid: z.number().int().min(0).optional(),
  version: z.number().int(),
});

const RecordPaymentSchema = z.object({
  date: z.string().date(),
  amount: z.number().int().positive(),
});

export async function supplierCreditRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get('/', async (request) => {
    const query = PaginationQuery.parse(request.query);
    const pageNum = query.page;
    const take = query.limit;
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
        throw httpError(404, 'Supplier credit not found');
      }

      const totalPayments = credit.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
      const remainingBalance = credit.totalAmount - credit.advancePaid - totalPayments;

      if (body.amount > remainingBalance) {
        throw httpError(400, 'Payment exceeds remaining balance');
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

  // Update supplier credit (H8)
  app.patch<{ Params: { id: string } }>('/:id', async (request, _reply) => {
    const body = UpdateSupplierCreditSchema.parse(request.body);
    const { id } = request.params;

    const credit = await prisma.$transaction(async (tx) => {
      const current = await tx.supplierCredit.findFirst({
        where: { id, deletedAt: null },
      });
      if (!current) {
        throw httpError(404, 'Supplier credit not found');
      }
      if (current.version !== body.version) {
        throw httpError(409, 'Version mismatch — pull latest before updating');
      }

      return tx.supplierCredit.update({
        where: { id },
        data: {
          ...(body.designation !== undefined && { designation: body.designation.trim() }),
          ...(body.totalAmount !== undefined && { totalAmount: body.totalAmount }),
          ...(body.advancePaid !== undefined && { advancePaid: body.advancePaid }),
          version: { increment: 1 },
        },
        include: { supplier: true, payments: { where: { deletedAt: null } } },
      });
    }, { isolationLevel: 'Serializable' });

    return credit;
  });

  // Soft delete supplier credit (H8)
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.supplierCredit.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) return { status: 'not_found' as const };

      const now = new Date();
      // Soft-delete related payments
      await tx.supplierCreditPayment.updateMany({
        where: { supplierCreditId: id, deletedAt: null },
        data: { deletedAt: now, version: { increment: 1 } },
      });
      await tx.supplierCredit.update({
        where: { id },
        data: { deletedAt: now, version: { increment: 1 } },
      });
      return { status: 'deleted' as const };
    }, { isolationLevel: 'Serializable' });

    if (result.status === 'not_found') return reply.notFound('Supplier credit not found');
    return { deleted: true };
  });
}
