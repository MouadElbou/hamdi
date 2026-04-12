import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

const CreateCustomerCreditSchema = z.object({
  date: z.string().date(),
  customerName: z.string().trim().min(1),
  designation: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().positive(),
  advancePaid: z.number().int().min(0).optional().default(0),
});

const RecordPaymentSchema = z.object({
  date: z.string().date(),
  amount: z.number().int().positive(),
});

export async function customerCreditRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get('/', async (request) => {
    const { page = '1', limit = '50', customer } = request.query as Record<string, string | undefined>;
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200);
    const skip = (pageNum - 1) * take;

    const where: Record<string, unknown> = { deletedAt: null };
    if (customer) {
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
        const err = new Error('Customer credit not found');
        (err as any).statusCode = 404;
        throw err;
      }

      const totalAmount = credit.quantity * credit.unitPrice;
      const totalPayments = credit.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
      const remainingBalance = totalAmount - credit.advancePaid - totalPayments;

      if (body.amount > remainingBalance) {
        const err = new Error(`Payment (${body.amount}) exceeds remaining balance (${remainingBalance})`);
        (err as any).statusCode = 400;
        throw err;
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
}
