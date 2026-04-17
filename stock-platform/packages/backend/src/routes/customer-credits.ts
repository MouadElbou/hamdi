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

const CustomerCreditFilterQuery = PaginationQuery.extend({
  customer: z.string().optional(),
});

// TODO(tech-debt): customerName is a free-text string — should be replaced with clientId FK to Client table.
// See prisma/schema.prisma CustomerCredit model for migration plan.
const CreateCustomerCreditSchema = z.object({
  date: z.string().date(),
  customerName: z.string().trim().min(1),
  designation: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().positive(),
  advancePaid: z.number().int().min(0).optional().default(0),
});

const UpdateCustomerCreditSchema = z.object({
  customerName: z.string().trim().min(1).optional(),
  designation: z.string().trim().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  unitPrice: z.number().int().positive().optional(),
  advancePaid: z.number().int().min(0).optional(),
  dueDate: z.string().date().nullable().optional(),
  version: z.number().int(),
});

const RecordPaymentSchema = z.object({
  date: z.string().date(),
  amount: z.number().int().positive(),
});

export async function customerCreditRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get('/', async (request) => {
    const query = CustomerCreditFilterQuery.parse(request.query);
    const pageNum = query.page;
    const take = query.limit;
    const skip = (pageNum - 1) * take;

    const where: Record<string, unknown> = { deletedAt: null };
    if (query.customer) {
      const customer = query.customer;
      const escaped = customer.replace(/[%_\\]/g, '\\$&');
      where['customerName'] = { contains: escaped, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.customerCredit.findMany({
        where,
        include: { payments: { where: { deletedAt: null } } },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.customerCredit.count({ where }),
    ]);

    // Enhance with computed fields
    const enhanced = items.map((c: typeof items[number]) => {
      const totalAmount = c.quantity * c.unitPrice;
      const totalPayments = c.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
      const remainingBalance = totalAmount - c.advancePaid - totalPayments;
      return { ...c, totalAmount, totalPayments, remainingBalance };
    });

    return { items: enhanced, total, page: pageNum, limit: take };
  });

  app.post('/', async (request, reply) => {
    const body = CreateCustomerCreditSchema.parse(request.body);
    const totalAmount = body.quantity * body.unitPrice;

    if (body.advancePaid > totalAmount) {
      return reply.badRequest(`Advance (${body.advancePaid}) exceeds total (${totalAmount})`);
    }

    const credit = await prisma.customerCredit.create({
      data: {
        id: uuidv7(),
        date: new Date(body.date),
        customerName: body.customerName.trim(),
        designation: body.designation.trim(),
        quantity: body.quantity,
        unitPrice: body.unitPrice,
        advancePaid: body.advancePaid,
      },
    });

    return reply.code(201).send(credit);
  });

  // Record a payment against a customer credit
  app.post<{ Params: { id: string } }>('/:id/payments', async (request, reply) => {
    const body = RecordPaymentSchema.parse(request.body);
    const { id } = request.params;

    const payment = await prisma.$transaction(async (tx) => {
      const credit = await tx.customerCredit.findFirst({
        where: { id, deletedAt: null },
        include: { payments: { where: { deletedAt: null } } },
      });
      if (!credit) {
        throw httpError(404, 'Customer credit not found');
      }

      const totalAmount = credit.quantity * credit.unitPrice;
      const totalPayments = credit.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
      const remainingBalance = totalAmount - credit.advancePaid - totalPayments;

      if (body.amount > remainingBalance) {
        throw httpError(400, `Payment (${body.amount}) exceeds remaining balance (${remainingBalance})`);
      }

      return tx.customerCreditPayment.create({
        data: {
          id: uuidv7(),
          date: new Date(body.date),
          amount: body.amount,
          customerCreditId: id,
        },
      });
    }, { isolationLevel: 'Serializable' });

    return reply.code(201).send(payment);
  });

  // Update customer credit (H7)
  app.patch<{ Params: { id: string } }>('/:id', async (request, _reply) => {
    const body = UpdateCustomerCreditSchema.parse(request.body);
    const { id } = request.params;

    const credit = await prisma.$transaction(async (tx) => {
      const current = await tx.customerCredit.findFirst({
        where: { id, deletedAt: null },
      });
      if (!current) {
        throw httpError(404, 'Customer credit not found');
      }
      if (current.version !== body.version) {
        throw httpError(409, 'Version mismatch — pull latest before updating');
      }

      return tx.customerCredit.update({
        where: { id },
        data: {
          ...(body.customerName !== undefined && { customerName: body.customerName.trim() }),
          ...(body.designation !== undefined && { designation: body.designation.trim() }),
          ...(body.quantity !== undefined && { quantity: body.quantity }),
          ...(body.unitPrice !== undefined && { unitPrice: body.unitPrice }),
          ...(body.advancePaid !== undefined && { advancePaid: body.advancePaid }),
          ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
          version: { increment: 1 },
        },
        include: { payments: { where: { deletedAt: null } } },
      });
    }, { isolationLevel: 'Serializable' });

    return credit;
  });

  // Soft delete customer credit (H7)
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerCredit.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) return { status: 'not_found' as const };

      const now = new Date();
      // Soft-delete related payments
      await tx.customerCreditPayment.updateMany({
        where: { customerCreditId: id, deletedAt: null },
        data: { deletedAt: now, version: { increment: 1 } },
      });
      await tx.customerCredit.update({
        where: { id },
        data: { deletedAt: now, version: { increment: 1 } },
      });
      return { status: 'deleted' as const };
    }, { isolationLevel: 'Serializable' });

    if (result.status === 'not_found') return reply.notFound('Customer credit not found');
    return { deleted: true };
  });
}
