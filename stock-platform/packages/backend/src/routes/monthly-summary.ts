import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';
import { StockService } from '../services/stock-service.js';

const UpsertSummaryLineSchema = z.object({
  section: z.enum(['revenue', 'expense', 'salary']),
  label: z.string().trim().min(1),
  amount: z.number().int(),
  isAutoComputed: z.boolean().optional().default(false),
});

const UpsertSummarySchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  version: z.number().int().optional(),
  lines: z.array(UpsertSummaryLineSchema),
});

export async function monthlySummaryRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // Get summary for a year
  app.get<{ Params: { year: string } }>('/:year', async (request, reply) => {
    const year = parseInt(request.params.year);
    if (isNaN(year) || year < 2000 || year > 2100) return reply.badRequest('Invalid year');
    const summaries = await prisma.monthlySummary.findMany({
      where: { year, deletedAt: null },
      include: { lines: { where: { deletedAt: null } } },
      orderBy: { month: 'asc' },
    });
    return summaries;
  });

  // Get summary for a specific month
  app.get<{ Params: { year: string; month: string } }>('/:year/:month', async (request, reply) => {
    const year = parseInt(request.params.year);
    const month = parseInt(request.params.month);
    if (isNaN(year) || year < 2000 || year > 2100) return reply.badRequest('Invalid year');
    if (isNaN(month) || month < 1 || month > 12) return reply.badRequest('Invalid month');

    const summary = await prisma.monthlySummary.findFirst({
      where: { year, month, deletedAt: null },
      include: { lines: { where: { deletedAt: null } } },
    });

    if (!summary) return reply.notFound(`No summary for ${year}-${month}`);
    return summary;
  });

  // Compute auto-fed values for a month from transaction tables
  app.get<{ Params: { year: string; month: string } }>('/:year/:month/computed', async (request, reply) => {
    const year = parseInt(request.params.year);
    const month = parseInt(request.params.month);
    if (isNaN(year) || year < 2000 || year > 2100) return reply.badRequest('Invalid year');
    if (isNaN(month) || month < 1 || month > 12) return reply.badRequest('Invalid month');
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const dateRange = { gte: startDate, lt: endDate };

    // Sales totals — use SQL aggregation to avoid loading all sale lines
    const stockService = new StockService(prisma);
    const { salesTotal, salesMargin } = await stockService.computeSalesTotals(startDate, endDate);

    // Maintenance total
    const maintenanceAgg = await prisma.maintenanceJob.aggregate({
      where: { date: dateRange, deletedAt: null },
      _sum: { price: true },
    });
    const maintenanceTotal = maintenanceAgg._sum.price ?? 0;

    // Expenses (Charges divers)
    const expenseAgg = await prisma.expense.aggregate({
      where: { date: dateRange, deletedAt: null },
      _sum: { amount: true },
    });
    const chargesDivers = expenseAgg._sum.amount ?? 0;

    return {
      year,
      month,
      salesTotal,
      salesMargin,
      purchaseEquivalent: salesTotal - salesMargin,
      maintenanceTotal,
      chargesDivers,
    };
  });

  // Upsert summary (manual + auto lines)
  app.put('/', async (request, reply) => {
    const body = UpsertSummarySchema.parse(request.body);

    const result = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      let summary = await tx.monthlySummary.findFirst({
        where: { year: body.year, month: body.month, deletedAt: null },
      });

      if (!summary) {
        summary = await tx.monthlySummary.create({
          data: {
            id: uuidv7(),
            year: body.year,
            month: body.month,
          },
        });
      } else {
        if (body.version === undefined) {
          const err = new Error('version is required when updating an existing summary');
          (err as any).statusCode = 400;
          throw err;
        }
        if (summary.version !== body.version) {
          const err = new Error('Version mismatch — pull latest before updating');
          (err as any).statusCode = 409;
          throw err;
        }
        summary = await tx.monthlySummary.update({
          where: { id: summary.id },
          data: { version: { increment: 1 } },
        });
      }

      // Soft-delete existing lines and recreate
      await tx.monthlySummaryLine.updateMany({
        where: { monthlySummaryId: summary.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      const lines = [];
      for (const line of body.lines) {
        const created = await tx.monthlySummaryLine.create({
          data: {
            id: uuidv7(),
            monthlySummaryId: summary.id,
            section: line.section,
            label: line.label,
            amount: line.amount,
            isAutoComputed: line.isAutoComputed,
          },
        });
        lines.push(created);
      }

      return { ...summary, lines };
    }, { isolationLevel: 'Serializable' });

    return reply.code(200).send(result);
  });
}
