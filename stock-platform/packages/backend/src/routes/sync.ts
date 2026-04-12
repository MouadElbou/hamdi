import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

/**
 * Sync endpoints for desktop ↔ server synchronization.
 * Push: desktop sends outbox entries to server.
 * Pull: desktop fetches updates since last cursor.
 */

const SyncPushItemSchema = z.object({
  id: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  payload: z.string(),
  version: z.number().int(),
  createdAt: z.string(),
});

const SyncPushSchema = z.object({
  desktopId: z.string().min(1),
  operations: z.array(SyncPushItemSchema).min(1).max(500),
});

// Map entity type strings to Prisma model delegates
const ENTITY_TYPE_MAP: Record<string, string> = {
  purchase_lot: 'purchaseLot',
  sale_order: 'saleOrder',
  sale_line: 'saleLine',
  sale_return: 'saleReturn',
  sale_return_line: 'saleReturnLine',
  customer_order: 'customerOrder',
  customer_order_line: 'customerOrderLine',
  maintenance_job: 'maintenanceJob',
  battery_repair_job: 'batteryRepairJob',
  battery_tariff: 'batteryTariff',
  expense: 'expense',
  customer_credit: 'customerCredit',
  customer_credit_payment: 'customerCreditPayment',
  supplier_credit: 'supplierCredit',
  supplier_credit_payment: 'supplierCreditPayment',
  bank_movement: 'bankMovement',
  monthly_summary: 'monthlySummary',
  monthly_summary_line: 'monthlySummaryLine',
  zakat_snapshot: 'zakatSnapshot',
  zakat_advance: 'zakatAdvance',
  employee: 'employee',
  salary_payment: 'salaryPayment',
  client: 'client',
  supplier: 'supplier',
  boutique: 'boutique',
  category: 'category',
  sub_category: 'subCategory',
  category_alias: 'categoryAlias',
  user: 'user',
};

// Per-entity field allowlists to prevent payload injection
const ENTITY_ALLOWED_FIELDS: Record<string, Set<string>> = {
  purchase_lot: new Set(['refNumber', 'date', 'designation', 'initialQuantity', 'purchaseUnitCost', 'targetResalePrice', 'blockPrice', 'sellingPrice', 'categoryId', 'supplierId', 'boutiqueId', 'subCategoryId', 'barcode']),
  sale_order: new Set(['refNumber', 'date', 'observation', 'clientId']),
  sale_line: new Set(['sellingUnitPrice', 'quantity', 'saleOrderId', 'lotId']),
  sale_return: new Set(['refNumber', 'date', 'observation', 'saleOrderId']),
  sale_return_line: new Set(['sellingUnitPrice', 'quantity', 'saleReturnId', 'saleLineId', 'lotId']),
  customer_order: new Set(['refNumber', 'date', 'observation', 'clientId', 'status']),
  customer_order_line: new Set(['customerOrderId', 'lotId', 'quantity', 'sellingUnitPrice']),
  maintenance_job: new Set(['date', 'designation', 'price', 'boutiqueId']),
  battery_repair_job: new Set(['date', 'description', 'customerNote', 'amount', 'costAdjustment']),
  battery_tariff: new Set(['label', 'particuliersPrice', 'revPrice']),
  expense: new Set(['date', 'designation', 'amount', 'boutiqueId']),
  customer_credit: new Set(['date', 'customerName', 'designation', 'quantity', 'unitPrice', 'advancePaid', 'dueDate', 'saleOrderId']),
  customer_credit_payment: new Set(['date', 'amount', 'customerCreditId']),
  supplier_credit: new Set(['date', 'designation', 'totalAmount', 'advancePaid', 'supplierId']),
  supplier_credit_payment: new Set(['date', 'amount', 'supplierCreditId']),
  bank_movement: new Set(['date', 'description', 'amountIn', 'amountOut']),
  monthly_summary: new Set(['year', 'month']),
  monthly_summary_line: new Set(['section', 'label', 'amount', 'isAutoComputed', 'monthlySummaryId']),
  zakat_snapshot: new Set(['year', 'closingDate', 'closingStockValue', 'closingBankBalance', 'closingCash', 'creditDeduction']),
  zakat_advance: new Set(['date', 'amount', 'year', 'note', 'zakatSnapshotId']),
  employee: new Set(['name', 'monthlySalary', 'startDate', 'isActive']),
  salary_payment: new Set(['date', 'amount', 'note', 'employeeId']),
  client: new Set(['name', 'phone']),
  supplier: new Set(['code']),
  boutique: new Set(['name']),
  category: new Set(['name']),
  sub_category: new Set(['name', 'categoryId']),
  category_alias: new Set(['rawValue', 'categoryId']),
  user: new Set(['username', 'passwordHash', 'displayName', 'role', 'isActive', 'mustChangePassword']),
};

// C5: All entities now use soft-delete (deletedAt added to Supplier, Boutique, Category)
const NO_SOFT_DELETE_ENTITIES = new Set<string>();

// Fields that are DateTime @db.Date in Prisma and need string → Date conversion
const DATE_FIELDS = new Set(['date', 'startDate', 'closingDate', 'dueDate']);

function sanitizePayload(entityType: string, payload: Record<string, unknown>): Record<string, unknown> {
  const allowed = ENTITY_ALLOWED_FIELDS[entityType];
  if (!allowed) return {};
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(payload)) {
    if (allowed.has(key)) {
      let value = payload[key];
      // Convert date strings to Date objects for Prisma DateTime fields
      if (DATE_FIELDS.has(key) && typeof value === 'string') {
        value = new Date(value);
      }
      result[key] = value;
    }
  }
  return result;
}

// Entity processing priority: lower = processed first.
// Reference data first, then parent entities, then child/payment entities.
const ENTITY_PRIORITY: Record<string, number> = {
  category: 0, sub_category: 0, supplier: 0, boutique: 0, client: 0, employee: 0, battery_tariff: 0, user: 0,
  category_alias: 0,
  purchase_lot: 1, sale_order: 1, maintenance_job: 1, battery_repair_job: 1,
  expense: 1, customer_credit: 1, supplier_credit: 1, bank_movement: 1,
  monthly_summary: 1, zakat_snapshot: 1, customer_order: 1,
  sale_line: 2, sale_return: 2, monthly_summary_line: 2, customer_order_line: 2,
  customer_credit_payment: 3, supplier_credit_payment: 3, salary_payment: 3, zakat_advance: 3, sale_return_line: 3,
};

function getOperationPriority(op: { entityType: string; operation: string }): number {
  const base = ENTITY_PRIORITY[op.entityType] ?? 1;
  // For DELETEs, reverse the order: children first, then parents
  return op.operation === 'DELETE' ? (3 - base) : base;
}

export async function syncRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // Push: desktop sends operations to server
  app.post('/push', async (request) => {
    const body = SyncPushSchema.parse(request.body);
    const results: Array<{ operationId: string; result: string; detail?: string }> = [];

    // Sort operations: for CREATEs/UPDATEs process parents before children;
    // for DELETEs process children before parents.
    const sortedOps = [...body.operations].sort((a, b) =>
      getOperationPriority(a) - getOperationPriority(b)
    );

    for (const op of sortedOps) {
      // Idempotency: check if already processed successfully
      const existing = await prisma.syncProcessedOperation.findUnique({
        where: { id: op.id },
      });
      if (existing && existing.result === 'accepted') {
        results.push({ operationId: op.id, result: existing.result });
        continue;
      }
      // If previously rejected/conflict, delete the record so we can retry
      if (existing) {
        await prisma.syncProcessedOperation.delete({ where: { id: op.id } });
      }

      const modelName = ENTITY_TYPE_MAP[op.entityType];
      if (!modelName) {
        results.push({ operationId: op.id, result: 'rejected', detail: `Unknown entity type: ${op.entityType}` });
        await prisma.syncProcessedOperation.create({
          data: {
            id: op.id,
            entityType: op.entityType,
            entityId: op.entityId,
            operation: op.operation,
            result: 'rejected',
          },
        });
        continue;
      }

      try {
        const rawPayload = JSON.parse(op.payload);
        const payload = sanitizePayload(op.entityType, rawPayload);

        // C1: Set originDesktopId server-side (not client-controlled)
        if (op.operation === 'CREATE' || op.operation === 'UPDATE') {
          payload.originDesktopId = body.desktopId;
        }

        // Wrap entity write + processed op recording in a transaction
        await prisma.$transaction(async (tx) => {
          const txModel = (tx as Record<string, any>)[modelName];

          if (op.operation === 'CREATE') {
            // C2: Don't blindly upsert — check if record exists with newer version
            const existing = await txModel.findUnique({ where: { id: op.entityId } });
            if (existing) {
              if (existing.version != null && existing.version > 1) {
                // Record already exists with edits from another desktop — report conflict
                throw Object.assign(
                  new Error(`Record ${op.entityId} already exists with version ${existing.version}`),
                  { isConflict: true },
                );
              } else {
                // Record exists at version 1 (initial create) — safe to update
                await txModel.update({
                  where: { id: op.entityId },
                  data: { ...payload },
                });
              }
            } else {
              try {
                await txModel.create({
                  data: { ...payload, id: op.entityId },
                });
              } catch (createErr: any) {
                // M2: Handle unique constraint violations (e.g., duplicate supplier code, category name)
                if (createErr?.code === 'P2002') {
                  const fields = (createErr?.meta?.target as string[]) ?? [];
                  // Build where clause from the conflicting unique fields
                  const conflictWhere: Record<string, unknown> = { deletedAt: { not: null } };
                  for (const field of fields) {
                    if (field in payload) conflictWhere[field] = payload[field];
                  }
                  const hasConflictFields = fields.some(f => f in payload);
                  const conflicting = hasConflictFields
                    ? await txModel.findFirst({ where: conflictWhere })
                    : null;
                  if (conflicting) {
                    // Restore soft-deleted record: update its ID to match the new entity
                    // to prevent ID divergence between desktop and server
                    await txModel.update({
                      where: { id: conflicting.id },
                      data: { ...payload, id: op.entityId, deletedAt: null, version: 1 },
                    });
                  } else {
                    // Active record conflict — report as conflict
                    throw Object.assign(
                      new Error(`Unique constraint violation on [${fields.join(', ')}] for ${op.entityType}`),
                      { isConflict: true },
                    );
                  }
                } else {
                  throw createErr;
                }
              }
            }
          } else if (op.operation === 'UPDATE') {
            // C3: Atomic version check — prevents TOCTOU race between concurrent pushes
            const updated = await txModel.updateMany({
              where: { id: op.entityId, version: { lte: op.version } },
              data: { ...payload, version: { increment: 1 } },
            });
            if (updated.count === 0) {
              // Either record doesn't exist or version conflict
              const exists = await txModel.findUnique({ where: { id: op.entityId } });
              if (!exists) {
                // Record doesn't exist yet — accept silently (CREATE will handle it)
                await (tx as any).syncProcessedOperation.create({
                  data: { id: op.id, entityType: op.entityType, entityId: op.entityId, operation: op.operation, result: 'accepted' },
                });
                return;
              }
              throw Object.assign(
                new Error(`Server version ${exists.version} > client version ${op.version}`),
                { isConflict: true },
              );
            }
          } else if (op.operation === 'DELETE') {
            const existing = await txModel.findUnique({ where: { id: op.entityId } });
            if (!existing) {
              // Record doesn't exist — nothing to delete
              await (tx as any).syncProcessedOperation.create({
                data: { id: op.id, entityType: op.entityType, entityId: op.entityId, operation: op.operation, result: 'accepted' },
              });
              return;
            }
            if (NO_SOFT_DELETE_ENTITIES.has(op.entityType)) {
              await txModel.delete({ where: { id: op.entityId } }).catch(() => { /* already deleted */ });
            } else {
              await txModel.update({
                where: { id: op.entityId },
                data: { deletedAt: new Date(), version: { increment: 1 } },
              });
            }
          }

          await (tx as any).syncProcessedOperation.create({
            data: { id: op.id, entityType: op.entityType, entityId: op.entityId, operation: op.operation, result: 'accepted' },
          });
        });

        results.push({ operationId: op.id, result: 'accepted' });

        // Sync user permissions if this is a user entity CREATE/UPDATE
        if (op.entityType === 'user' && (op.operation === 'CREATE' || op.operation === 'UPDATE')) {
          try {
            const rawPayload = JSON.parse(op.payload);
            const perms = rawPayload.permissions as string[] | undefined;
            if (Array.isArray(perms)) {
              await prisma.userPermission.deleteMany({ where: { userId: op.entityId } });
              if (perms.length > 0) {
                const { randomUUID } = await import('crypto');
                await prisma.userPermission.createMany({
                  data: perms.map((pageKey: string) => ({
                    id: randomUUID(),
                    userId: op.entityId,
                    pageKey,
                  })),
                });
              }
            }
          } catch { /* permission sync failure is non-fatal */ }
        }

        // Audit log (non-critical, outside transaction)
        await prisma.syncAuditLog.create({
          data: {
            direction: 'push',
            entityType: op.entityType,
            entityId: op.entityId,
            operation: op.operation,
            result: 'accepted',
            desktopId: body.desktopId,
          },
        }).catch(() => { /* audit log failure is non-fatal */ });
      } catch (err: unknown) {
        const isConflict = err && typeof err === 'object' && 'isConflict' in err;
        const rawDetail = err instanceof Error ? err.message : 'Unknown error';
        // Log the real error server-side for debugging
        request.log.warn({ entityType: op.entityType, entityId: op.entityId, operation: op.operation, error: rawDetail }, 'Sync operation failed');
        // Sanitize error details — only expose safe known messages
        const detail = isConflict ? rawDetail : 'Operation rejected';
        const result = isConflict ? 'conflict' : 'rejected';
        results.push({ operationId: op.id, result, detail });
        // M7: Best-effort processed op recording on error path
        try {
          await prisma.syncProcessedOperation.create({
            data: { id: op.id, entityType: op.entityType, entityId: op.entityId, operation: op.operation, result },
          });
        } catch { /* idempotency record may already exist */ }

        // Audit log for failures too
        await prisma.syncAuditLog.create({
          data: {
            direction: 'push',
            entityType: op.entityType,
            entityId: op.entityId,
            operation: op.operation,
            result,
            detail,
            desktopId: body.desktopId,
          },
        }).catch(() => { /* non-fatal */ });
      }
    }

    return { results };
  });

  // Pull: desktop fetches updates since a cursor
  app.get('/pull', async (request) => {
    const { since, limit = '500' } = request.query as Record<string, string | undefined>;
    const take = Math.min(parseInt(limit ?? '500', 10) || 500, 1000);
    const sinceDate = since ? new Date(since) : new Date(0);

    // Collect updated entities with a global budget across all types
    const entities: Array<{ entityType: string; data: unknown; updatedAt: Date }> = [];
    let remaining = take;

    for (const [entityType, modelName] of Object.entries(ENTITY_TYPE_MAP)) {
      if (remaining <= 0) break;
      const model = (prisma as Record<string, any>)[modelName];
      if (!model?.findMany) continue;

      try {
        // Include permissions when pulling user entities
        const findArgs: Record<string, unknown> = {
          where: { updatedAt: { gt: sinceDate } },
          orderBy: { updatedAt: 'asc' },
          take: remaining,
        };
        if (entityType === 'user') {
          findArgs.include = { permissions: { select: { pageKey: true } } };
        }
        const rows = await model.findMany(findArgs);
        for (const row of rows) {
          // Flatten user permissions into a simple array for the desktop
          if (entityType === 'user' && row.permissions) {
            row.permissions = (row.permissions as Array<{ pageKey: string }>).map((p: { pageKey: string }) => p.pageKey);
          }
          entities.push({ entityType, data: row, updatedAt: row.updatedAt });
        }
        remaining -= rows.length;
      } catch {
        // Some models might not have updatedAt — skip
      }
    }

    // Sort by timestamp and trim to limit
    entities.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
    const result = entities.slice(0, take);
    const newCursor = result.length > 0
      ? result[result.length - 1]!.updatedAt.toISOString()
      : (since ?? new Date(0).toISOString());

    return { entities: result, cursor: newCursor, hasMore: result.length >= take };
  });

  // Bootstrap: paginated full pull for new desktop installations
  app.get('/bootstrap', async (request) => {
    const { entityType, limit = '500', cursor } = request.query as Record<string, string | undefined>;
    const take = Math.min(parseInt(limit ?? '500', 10) || 500, 1000);
    const types = entityType ? [entityType] : Object.keys(ENTITY_TYPE_MAP);
    const entities: Array<{ entityType: string; data: unknown }> = [];
    let remaining = take;

    // Cursor format: "entityType:lastId" or undefined for start
    let startType = types[0];
    let afterId: string | undefined;
    if (cursor) {
      const sep = cursor.indexOf(':');
      if (sep > 0) {
        startType = cursor.substring(0, sep);
        afterId = cursor.substring(sep + 1);
      }
    }

    let started = !cursor;
    for (const type of types) {
      if (remaining <= 0) break;
      if (!started) {
        if (type !== startType) continue;
        started = true;
      }

      const modelName = ENTITY_TYPE_MAP[type];
      if (!modelName) continue;
      const model = (prisma as Record<string, any>)[modelName];
      if (!model?.findMany) continue;

      try {
        const where: Record<string, unknown> = afterId && type === startType
          ? { id: { gt: afterId }, deletedAt: null }
          : { deletedAt: null };
        const findArgs: Record<string, unknown> = {
          where,
          orderBy: { id: 'asc' },
          take: remaining,
        };
        if (type === 'user') {
          findArgs.include = { permissions: { select: { pageKey: true } } };
        }
        const rows = await model.findMany(findArgs);
        for (const row of rows) {
          if (type === 'user' && row.permissions) {
            row.permissions = (row.permissions as Array<{ pageKey: string }>).map((p: { pageKey: string }) => p.pageKey);
          }
          entities.push({ entityType: type, data: row });
        }
        remaining -= rows.length;
        afterId = undefined; // Only applies to the first (cursor) type
      } catch {
        // Skip
      }
    }

    const lastEntity = entities[entities.length - 1] as { entityType: string; data: { id: string } } | undefined;
    const newCursor = lastEntity ? `${lastEntity.entityType}:${lastEntity.data.id}` : undefined;
    return { entities, cursor: newCursor, hasMore: entities.length >= take };
  });
}
