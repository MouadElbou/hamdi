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

const PurchaseFilterQuery = PaginationQuery.extend({
  category: z.string().optional(),
  supplier: z.string().optional(),
  boutique: z.string().optional(),
});

const CreatePurchaseSchema = z.object({
  date: z.string().date(),
  category: z.string().trim().min(1),
  designation: z.string().trim().min(1).refine((v) => v.trim() !== '0', 'designation cannot be 0'),
  supplier: z.string().trim().min(1).optional(),
  boutique: z.string().trim().min(1),
  initialQuantity: z.number().int().positive(),
  purchaseUnitCost: z.number().int().nonnegative(),
  targetResalePrice: z.number().int().positive().nullable().optional(),
  blockPrice: z.number().int().positive().nullable().optional(),
  sellingPrice: z.number().int().positive().nullable().optional(),
  subCategory: z.string().trim().min(1).nullable().optional(),
});

const UpdatePurchaseSchema = z.object({
  date: z.string().date().optional(),
  designation: z.string().trim().min(1).optional(),
  targetResalePrice: z.number().int().positive().nullable().optional(),
  sellingPrice: z.number().int().positive().nullable().optional(),
  version: z.number().int(),
});

export async function purchaseRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // List purchases with pagination
  app.get('/', async (request) => {
    const query = PurchaseFilterQuery.parse(request.query);
    const pageNum = query.page;
    const take = query.limit;
    const skip = (pageNum - 1) * take;

    const where: Record<string, unknown> = { deletedAt: null };
    if (query.category) where['category'] = { name: query.category };
    if (query.supplier) where['supplier'] = { code: query.supplier };
    if (query.boutique) where['boutique'] = { name: query.boutique };

    const [items, total] = await Promise.all([
      prisma.purchaseLot.findMany({
        where,
        include: { category: true, supplier: true, boutique: true },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.purchaseLot.count({ where }),
    ]);

    return { items, total, page: pageNum, limit: take };
  });

  // Get single purchase
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const lot = await prisma.purchaseLot.findFirst({
      where: { id: request.params.id, deletedAt: null },
      include: { category: true, supplier: true, boutique: true, saleLines: true },
    });
    if (!lot) return reply.notFound('Purchase lot not found');
    return lot;
  });

  // Create purchase (creates a stock lot)
  app.post('/', async (request, reply) => {
    const body = CreatePurchaseSchema.parse(request.body);

    const id = uuidv7();
    const refSuffix = uuidv7().replace(/-/g, '').slice(-8).toUpperCase();
    const refNumber = `PUR-${refSuffix}`;

    // Wrap all FK resolution + lot create in a transaction to prevent race conditions
    const lot = await prisma.$transaction(async (tx) => {
      const [category, boutique] = await Promise.all([
        tx.category.findFirst({ where: { name: body.category, deletedAt: null } }),
        tx.boutique.findFirst({ where: { name: body.boutique, deletedAt: null } }),
      ]);

      if (!category) {
        throw httpError(400, `Category '${body.category}' not found`);
      }
      if (!boutique) {
        throw httpError(400, `Boutique '${body.boutique}' not found`);
      }

      let supplier = body.supplier
        ? await tx.supplier.findFirst({ where: { code: body.supplier, deletedAt: null } })
        : await tx.supplier.findFirst({ where: { code: '—', deletedAt: null } });
      if (!supplier && body.supplier) {
        supplier = await tx.supplier.create({
          data: { id: uuidv7(), code: body.supplier.trim().toUpperCase() },
        });
      }
      if (!supplier) {
        supplier = await tx.supplier.create({
          data: { id: uuidv7(), code: '—' },
        });
      }

      // Resolve sub-category
      let subCategoryId: string | null = null;
      if (body.subCategory) {
        const subCat = await tx.subCategory.findFirst({ where: { name: body.subCategory, categoryId: category.id, deletedAt: null } });
        if (subCat) {
          subCategoryId = subCat.id;
        } else {
          const newSub = await tx.subCategory.create({ data: { id: uuidv7(), name: body.subCategory.trim(), categoryId: category.id } });
          subCategoryId = newSub.id;
        }
      }

      return tx.purchaseLot.create({
        data: {
          id,
          refNumber,
          date: new Date(body.date),
          designation: body.designation.trim(),
          initialQuantity: body.initialQuantity,
          purchaseUnitCost: body.purchaseUnitCost,
          targetResalePrice: body.targetResalePrice ?? null,
          blockPrice: body.blockPrice ?? null,
          sellingPrice: body.sellingPrice ?? null,
          categoryId: category.id,
          supplierId: supplier.id,
          boutiqueId: boutique.id,
          subCategoryId,
        },
        include: { category: true, supplier: true, boutique: true, subCategory: true },
      });
    }, { isolationLevel: 'Serializable' });

    return reply.code(201).send(lot);
  });

  // Update purchase (only non-stock-affecting fields, with version check)
  app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = UpdatePurchaseSchema.parse(request.body);
    const { id } = request.params;

    // Check for downstream sales before allowing edits
    const existing = await prisma.purchaseLot.findFirst({
      where: { id, deletedAt: null },
      include: { saleLines: { where: { deletedAt: null } } },
    });

    if (!existing) return reply.notFound('Purchase lot not found');

    // Atomic version check inside Serializable transaction
    const lot = await prisma.$transaction(async (tx) => {
      const current = await tx.purchaseLot.findUnique({ where: { id } });
      if (!current || current.version !== body.version) {
        throw httpError(409, 'Version mismatch — pull latest before updating');
      }

      return tx.purchaseLot.update({
        where: { id },
        data: {
          ...(body.date !== undefined && { date: new Date(body.date) }),
          ...(body.designation !== undefined && { designation: body.designation.trim() }),
          ...(body.targetResalePrice !== undefined && { targetResalePrice: body.targetResalePrice }),
          ...(body.sellingPrice !== undefined && { sellingPrice: body.sellingPrice }),
          version: { increment: 1 },
        },
        include: { category: true, supplier: true, boutique: true, subCategory: true },
      });
    }, { isolationLevel: 'Serializable' });

    return lot;
  });

  // Soft delete purchase (blocked if has sales) — Serializable to prevent TOCTOU race
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseLot.findFirst({
        where: { id, deletedAt: null },
        include: { saleLines: { where: { deletedAt: null } } },
      });

      if (!existing) return { status: 'not_found' as const };
      if (existing.saleLines.length > 0) return { status: 'has_sales' as const };

      await tx.purchaseLot.update({
        where: { id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });

      return { status: 'deleted' as const };
    }, { isolationLevel: 'Serializable' });

    if (result.status === 'not_found') return reply.notFound('Purchase lot not found');
    if (result.status === 'has_sales') return reply.badRequest('Cannot delete purchase lot with existing sales');
    return { deleted: true };
  });
}
