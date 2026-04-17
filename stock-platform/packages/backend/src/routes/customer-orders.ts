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

const FilterQuery = PaginationQuery.extend({
  status: z.string().trim().min(1).optional(),
  clientId: z.string().uuid().optional(),
});

const CreateCustomerOrderSchema = z.object({
  date: z.string().date(),
  observation: z.string().nullable().optional(),
  clientId: z.string().uuid().optional(),
  status: z.string().trim().min(1).optional().default('pending'),
  lines: z.array(z.object({
    lotId: z.string().uuid(),
    quantity: z.number().int().positive(),
    sellingUnitPrice: z.number().int().positive(),
  })).min(1),
});

const UpdateCustomerOrderSchema = z.object({
  observation: z.string().nullable().optional(),
  status: z.string().trim().min(1).optional(),
  version: z.number().int(),
});

export async function customerOrderRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // List customer orders with pagination
  app.get('/', async (request) => {
    const query = FilterQuery.parse(request.query);
    const skip = (query.page - 1) * query.limit;

    const where: Record<string, unknown> = { deletedAt: null };
    if (query.status) where['status'] = query.status;
    if (query.clientId) where['clientId'] = query.clientId;

    const [items, total] = await Promise.all([
      prisma.customerOrder.findMany({
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
        take: query.limit,
      }),
      prisma.customerOrder.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  });

  // Get single customer order
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const order = await prisma.customerOrder.findFirst({
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
    if (!order) return reply.notFound('Customer order not found');
    return order;
  });

  // Create customer order (with stock availability check in transaction)
  app.post('/', async (request, reply) => {
    const body = CreateCustomerOrderSchema.parse(request.body);

    const result = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      // Verify stock availability for every line
      for (const line of body.lines) {
        const lot = await tx.purchaseLot.findFirst({
          where: { id: line.lotId, deletedAt: null },
        });
        if (!lot) {
          throw httpError(404, `Lot ${line.lotId} not found`);
        }

        // Compute sold quantity for this lot (sales + other customer orders)
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

      // Create customer order
      const orderId = uuidv7();
      const refSuffix = uuidv7().replace(/-/g, '').slice(-8).toUpperCase();
      const order = await tx.customerOrder.create({
        data: {
          id: orderId,
          refNumber: `CO-${refSuffix}`,
          date: new Date(body.date),
          observation: body.observation ?? null,
          clientId: body.clientId ?? null,
          status: body.status,
        },
      });

      // Create order lines
      const lines = [];
      for (const line of body.lines) {
        const orderLine = await tx.customerOrderLine.create({
          data: {
            id: uuidv7(),
            customerOrderId: orderId,
            lotId: line.lotId,
            quantity: line.quantity,
            sellingUnitPrice: line.sellingUnitPrice,
          },
          include: {
            lot: { include: { category: true, supplier: true, boutique: true } },
          },
        });
        lines.push(orderLine);
      }

      return { ...order, lines };
    }, { isolationLevel: 'Serializable' });

    return reply.code(201).send(result);
  });

  // Update customer order (observation, status — with version check)
  app.patch<{ Params: { id: string } }>('/:id', async (request, _reply) => {
    const body = UpdateCustomerOrderSchema.parse(request.body);
    const { id } = request.params;

    const order = await prisma.$transaction(async (tx) => {
      const current = await tx.customerOrder.findFirst({
        where: { id, deletedAt: null },
      });
      if (!current) {
        throw httpError(404, 'Customer order not found');
      }
      if (current.version !== body.version) {
        throw httpError(409, 'Version mismatch — pull latest before updating');
      }

      return tx.customerOrder.update({
        where: { id },
        data: {
          ...(body.observation !== undefined && { observation: body.observation }),
          ...(body.status !== undefined && { status: body.status }),
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

    return order;
  });

  // Soft delete customer order
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerOrder.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) return { status: 'not_found' as const };

      const now = new Date();
      await tx.customerOrderLine.updateMany({
        where: { customerOrderId: id, deletedAt: null },
        data: { deletedAt: now, version: { increment: 1 } },
      });
      await tx.customerOrder.update({
        where: { id },
        data: { deletedAt: now, version: { increment: 1 } },
      });
      return { status: 'deleted' as const };
    }, { isolationLevel: 'Serializable' });

    if (result.status === 'not_found') return reply.notFound('Customer order not found');
    return { deleted: true };
  });
}
