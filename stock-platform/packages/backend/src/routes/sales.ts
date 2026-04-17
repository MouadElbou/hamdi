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

const CreateSaleSchema = z.object({
  date: z.string().date(),
  observation: z.string().nullable().optional(),
  clientName: z.string().trim().min(1).optional(),
  paymentType: z.enum(['comptant', 'credit']).optional().default('comptant'),
  advancePaid: z.number().int().nonnegative().optional(),
  dueDate: z.string().date().optional(),
  lines: z.array(z.object({
    lotId: z.string().uuid(),
    quantity: z.number().int().positive(),
    sellingUnitPrice: z.number().int().positive(),
  })).min(1),
});

const UpdateSaleSchema = z.object({
  date: z.string().date().optional(),
  observation: z.string().nullable().optional(),
  clientName: z.string().trim().min(1).optional(),
  version: z.number().int(),
});

export async function saleRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // List sales
  app.get('/', async (request) => {
    const query = PaginationQuery.parse(request.query);
    const pageNum = query.page;
    const take = query.limit;
    const skip = (pageNum - 1) * take;

    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.saleOrder.findMany({
        where,
        include: {
          client: true,
          lines: {
            where: { deletedAt: null },
            include: {
              lot: { include: { category: true, supplier: true, boutique: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.saleOrder.count({ where }),
    ]);

    return { items, total, page: pageNum, limit: take };
  });

  // Get single sale
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const sale = await prisma.saleOrder.findFirst({
      where: { id: request.params.id, deletedAt: null },
      include: {
        client: true,
        lines: {
          where: { deletedAt: null },
          include: {
            lot: { include: { category: true, supplier: true, boutique: true } },
          },
        },
      },
    });
    if (!sale) return reply.notFound('Sale not found');
    return sale;
  });

  // Create sale (with stock availability check in transaction)
  app.post('/', async (request, reply) => {
    const body = CreateSaleSchema.parse(request.body);

    const result = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      // Verify stock availability for every line
      for (const line of body.lines) {
        const lot = await tx.purchaseLot.findFirst({
          where: { id: line.lotId, deletedAt: null },
        });
        if (!lot) {
          throw httpError(404, `Lot ${line.lotId} not found`);
        }

        // Compute sold quantity for this lot
        const soldAgg = await tx.saleLine.aggregate({
          where: { lotId: line.lotId, deletedAt: null },
          _sum: { quantity: true },
        });
        const soldQty = soldAgg._sum.quantity ?? 0;
        const available = lot.initialQuantity - soldQty;

        if (line.quantity > available) {
          throw httpError(400, `Insufficient stock for lot ${line.lotId}: requested ${line.quantity}, available ${available}`);
        }
      }

      // Auto-create client if provided
      let clientId: string | null = null;
      if (body.clientName) {
        const trimmed = body.clientName.trim().toUpperCase();
        let client = await tx.client.findFirst({ where: { name: trimmed, deletedAt: null } });
        if (!client) {
          client = await tx.client.create({ data: { id: uuidv7(), name: trimmed } });
        }
        clientId = client.id;
      }

      // Create sale order
      const saleId = uuidv7();
      const order = await tx.saleOrder.create({
        data: {
          id: saleId,
          refNumber: `SAL-${uuidv7().replace(/-/g, '').slice(-8).toUpperCase()}`,
          date: new Date(body.date),
          observation: body.observation ?? null,
          clientId,
        },
      });

      // Create sale lines
      const lines = [];
      for (const line of body.lines) {
        const saleLine = await tx.saleLine.create({
          data: {
            id: uuidv7(),
            saleOrderId: saleId,
            lotId: line.lotId,
            quantity: line.quantity,
            sellingUnitPrice: line.sellingUnitPrice,
          },
          include: {
            lot: { include: { category: true, supplier: true, boutique: true } },
          },
        });
        lines.push(saleLine);
      }

      // Auto-create customer credit for credit sales
      if (body.paymentType === 'credit' && clientId) {
        const totalAmount = body.lines.reduce((sum, l) => sum + l.quantity * l.sellingUnitPrice, 0);
        await tx.customerCredit.create({
          data: {
            id: uuidv7(),
            date: new Date(body.date),
            customerName: body.clientName?.trim().toUpperCase() ?? '', // TODO(tech-debt): replace with clientId FK
            designation: `Vente ${order.refNumber}`,
            quantity: 1,
            unitPrice: totalAmount,
            advancePaid: body.advancePaid ?? 0,
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            saleOrderId: saleId,
          },
        });
      }

      return { ...order, lines };
    }, { isolationLevel: 'Serializable' });

    return reply.code(201).send(result);
  });

  // Update sale (H6 — non-line fields, with version check)
  app.patch<{ Params: { id: string } }>('/:id', async (request, _reply) => {
    const body = UpdateSaleSchema.parse(request.body);
    const { id } = request.params;

    const sale = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const current = await tx.saleOrder.findFirst({
        where: { id, deletedAt: null },
      });
      if (!current) {
        throw httpError(404, 'Sale not found');
      }
      if (current.version !== body.version) {
        throw httpError(409, 'Version mismatch — pull latest before updating');
      }

      // Auto-create/find client if clientName changes
      let clientId = current.clientId;
      if (body.clientName !== undefined) {
        if (body.clientName) {
          const trimmed = body.clientName.trim().toUpperCase();
          let client = await tx.client.findFirst({ where: { name: trimmed, deletedAt: null } });
          if (!client) {
            client = await tx.client.create({ data: { id: uuidv7(), name: trimmed } });
          }
          clientId = client.id;
        } else {
          clientId = null;
        }
      }

      return tx.saleOrder.update({
        where: { id },
        data: {
          ...(body.date !== undefined && { date: new Date(body.date) }),
          ...(body.observation !== undefined && { observation: body.observation }),
          clientId,
          version: { increment: 1 },
        },
        include: {
          client: true,
          lines: {
            where: { deletedAt: null },
            include: {
              lot: { include: { category: true, supplier: true, boutique: true } },
            },
          },
        },
      });
    }, { isolationLevel: 'Serializable' });

    return sale;
  });

  // Soft delete sale (returns stock)
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.saleOrder.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) return { status: 'not_found' as const };

      const now = new Date();
      await tx.saleLine.updateMany({
        where: { saleOrderId: id, deletedAt: null },
        data: { deletedAt: now, version: { increment: 1 } },
      });
      await tx.saleOrder.update({
        where: { id },
        data: { deletedAt: now, version: { increment: 1 } },
      });
      return { status: 'deleted' as const };
    }, { isolationLevel: 'Serializable' });

    if (result.status === 'not_found') return reply.notFound('Sale not found');
    return { deleted: true };
  });
}
