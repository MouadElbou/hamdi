import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';
import { ZAKAT_RATE } from '@stock/shared';

const CreateZakatSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  closingDate: z.string().date(),
  closingStockValue: z.number().int().min(0),
  closingBankBalance: z.number().int().min(0),
  closingCash: z.number().int().min(0),
  creditDeduction: z.number().int().min(0),
  version: z.number().int().optional(),
});

const CreateAdvanceSchema = z.object({
  date: z.string().date(),
  amount: z.number().int().positive(),
});

const YearParamSchema = z.coerce.number().int().min(2000).max(2100);

export async function zakatRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // Get zakat snapshot for a year
  app.get<{ Params: { year: string } }>('/:year', async (request, reply) => {
    const yearParsed = YearParamSchema.safeParse(request.params.year);
    if (!yearParsed.success) return reply.badRequest('Invalid year (must be 2000-2100)');
    const year = yearParsed.data;
    const snapshot = await prisma.zakatSnapshot.findFirst({
      where: { year, deletedAt: null },
      include: { advances: { where: { deletedAt: null } } },
    });

    if (!snapshot) return reply.notFound(`No zakat snapshot for year ${year}`);

    const totalAssets = snapshot.closingStockValue + snapshot.closingBankBalance + snapshot.closingCash;
    const zakatBase = totalAssets - snapshot.creditDeduction;
    const zakatDue = Math.round(Math.max(0, zakatBase) * ZAKAT_RATE);
    const advanceTotal = snapshot.advances.reduce((s: number, a: { amount: number }) => s + a.amount, 0);

    return {
      ...snapshot,
      totalAssets,
      zakatBase,
      zakatDue,
      advanceTotal,
      zakatRemaining: zakatDue - advanceTotal,
    };
  });

  // Compute closing stock value from current stock (SQL aggregation)
  app.get('/compute-stock-value', async () => {
    const result = await prisma.$queryRaw<[{ total: bigint | null }]>`
      SELECT COALESCE(SUM(
        (pl."initialQuantity" - COALESCE(sold.qty, 0))::bigint * pl."purchaseUnitCost"
      ), 0) AS "total"
      FROM purchase_lots pl
      LEFT JOIN (
        SELECT sl."lotId", SUM(sl."quantity") AS qty
        FROM sale_lines sl
        WHERE sl."deletedAt" IS NULL
        GROUP BY sl."lotId"
      ) sold ON sold."lotId" = pl."id"
      WHERE pl."deletedAt" IS NULL
        AND (pl."initialQuantity" - COALESCE(sold.qty, 0)) > 0
    `;

    return { closingStockValue: Number(result[0]?.total ?? 0) };
  });

  // Create/update zakat snapshot (with optimistic locking on update)
  app.put('/', async (request, reply) => {
    const body = CreateZakatSchema.parse(request.body);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.zakatSnapshot.findFirst({
        where: { year: body.year, deletedAt: null },
      });

      if (existing) {
        // Optimistic locking: require version for updates
        if (body.version === undefined) {
          const err = new Error('version is required when updating an existing snapshot');
          (err as any).statusCode = 400;
          throw err;
        }

        const current = await tx.zakatSnapshot.findUnique({ where: { id: existing.id } });
        if (!current || current.version !== body.version) {
          const err = new Error('Version mismatch — pull latest before updating');
          (err as any).statusCode = 409;
          throw err;
        }

        return { snapshot: await tx.zakatSnapshot.update({
          where: { id: existing.id },
          data: {
            closingDate: new Date(body.closingDate),
            closingStockValue: body.closingStockValue,
            closingBankBalance: body.closingBankBalance,
            closingCash: body.closingCash,
            creditDeduction: body.creditDeduction,
            version: { increment: 1 },
          },
          include: { advances: { where: { deletedAt: null } } },
        }), created: false };
      }

      return { snapshot: await tx.zakatSnapshot.create({
        data: {
          id: uuidv7(),
          year: body.year,
          closingDate: new Date(body.closingDate),
          closingStockValue: body.closingStockValue,
          closingBankBalance: body.closingBankBalance,
          closingCash: body.closingCash,
          creditDeduction: body.creditDeduction,
        },
        include: { advances: true },
      }), created: true };
    }, { isolationLevel: 'Serializable' });

    if (result.created) return reply.code(201).send(result.snapshot);
    return result.snapshot;
  });

  // Record zakat advance
  app.post<{ Params: { year: string } }>('/:year/advances', async (request, reply) => {
    const yearParsed = YearParamSchema.safeParse(request.params.year);
    if (!yearParsed.success) return reply.badRequest('Invalid year (must be 2000-2100)');
    const year = yearParsed.data;
    const body = CreateAdvanceSchema.parse(request.body);

    const snapshot = await prisma.zakatSnapshot.findFirst({
      where: { year, deletedAt: null },
    });
    if (!snapshot) return reply.notFound(`No zakat snapshot for year ${year}`);

    const advance = await prisma.zakatAdvance.create({
      data: {
        id: uuidv7(),
        date: new Date(body.date),
        amount: body.amount,
        year,
        zakatSnapshotId: snapshot.id,
      },
    });

    return reply.code(201).send(advance);
  });
}
