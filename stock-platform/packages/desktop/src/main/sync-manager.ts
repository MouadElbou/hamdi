/**
 * Sync manager — handles outbox push and server pull.
 * Runs periodically when internet is available.
 * Idempotent operations with retry + backoff.
 */

import type Database from 'better-sqlite3';
import { v7 as uuidv7 } from 'uuid';

const SYNC_INTERVAL_MS = 30_000; // 30 seconds
const SERVER_URL = process.env['SYNC_SERVER_URL'] ?? 'http://localhost:3001';
const SYNC_API_KEY = process.env['SYNC_API_KEY'] ?? 'dev-api-key'; // Must match backend API_KEY; change in production

// Enforce HTTPS in production
if (process.env['NODE_ENV'] === 'production' && SERVER_URL.startsWith('http://') && !SERVER_URL.includes('localhost')) {
  console.warn('[SYNC] WARNING: Sync server URL is not HTTPS. Set SYNC_SERVER_URL to an https:// URL for production.');
}

interface SyncStatus {
  connected: boolean;
  pendingOps: number;
  lastSync: string | null;
  errorMessage?: string;
}

// Column mappings for sync upsert: key = server JSON field, col = local DB column
interface ColDef { key: string; col: string; fallback?: unknown }

const ENTITY_COLUMNS: Record<string, ColDef[]> = {
  purchase_lot: [
    { key: 'refNumber', col: 'ref_number' },
    { key: 'date', col: 'date' },
    { key: 'designation', col: 'designation' },
    { key: 'initialQuantity', col: 'initial_quantity' },
    { key: 'purchaseUnitCost', col: 'purchase_unit_cost' },
    { key: 'targetResalePrice', col: 'target_resale_price' },
    { key: 'blockPrice', col: 'block_price' },
    { key: 'sellingPrice', col: 'selling_price' },
    { key: 'categoryId', col: 'category_id' },
    { key: 'supplierId', col: 'supplier_id' },
    { key: 'boutiqueId', col: 'boutique_id' },
    { key: 'subCategoryId', col: 'sub_category_id' },
    { key: 'barcode', col: 'barcode' },
  ],
  sale_order: [
    { key: 'refNumber', col: 'ref_number' },
    { key: 'date', col: 'date' },
    { key: 'observation', col: 'observation' },
    { key: 'clientId', col: 'client_id' },
  ],
  sale_line: [
    { key: 'sellingUnitPrice', col: 'selling_unit_price' },
    { key: 'quantity', col: 'quantity' },
    { key: 'saleOrderId', col: 'sale_order_id' },
    { key: 'lotId', col: 'lot_id' },
  ],
  sale_return: [
    { key: 'refNumber', col: 'ref_number' },
    { key: 'date', col: 'date' },
    { key: 'observation', col: 'observation' },
    { key: 'saleOrderId', col: 'sale_order_id' },
  ],
  sale_return_line: [
    { key: 'sellingUnitPrice', col: 'selling_unit_price' },
    { key: 'quantity', col: 'quantity' },
    { key: 'saleReturnId', col: 'sale_return_id' },
    { key: 'saleLineId', col: 'sale_line_id' },
    { key: 'lotId', col: 'lot_id' },
  ],
  customer_order: [
    { key: 'refNumber', col: 'ref_number' },
    { key: 'date', col: 'date' },
    { key: 'observation', col: 'observation' },
    { key: 'clientId', col: 'client_id' },
    { key: 'status', col: 'status' },
  ],
  customer_order_line: [
    { key: 'customerOrderId', col: 'customer_order_id' },
    { key: 'lotId', col: 'lot_id' },
    { key: 'quantity', col: 'quantity' },
    { key: 'sellingUnitPrice', col: 'selling_unit_price' },
  ],
  maintenance_job: [
    { key: 'date', col: 'date' },
    { key: 'designation', col: 'designation' },
    { key: 'price', col: 'price' },
    { key: 'boutiqueId', col: 'boutique_id' },
  ],
  battery_repair_job: [
    { key: 'date', col: 'date' },
    { key: 'description', col: 'description' },
    { key: 'customerNote', col: 'customer_note' },
    { key: 'amount', col: 'amount' },
    { key: 'costAdjustment', col: 'cost_adjustment', fallback: 0 },
  ],
  battery_tariff: [
    { key: 'label', col: 'label' },
    { key: 'particuliersPrice', col: 'particuliers_price' },
    { key: 'revPrice', col: 'rev_price' },
  ],
  expense: [
    { key: 'date', col: 'date' },
    { key: 'designation', col: 'designation' },
    { key: 'amount', col: 'amount' },
    { key: 'boutiqueId', col: 'boutique_id' },
  ],
  customer_credit: [
    { key: 'customerName', col: 'customer_name' },
    { key: 'date', col: 'date' },
    { key: 'designation', col: 'designation' },
    { key: 'quantity', col: 'quantity' },
    { key: 'unitPrice', col: 'unit_price' },
    { key: 'advancePaid', col: 'advance_paid', fallback: 0 },
    { key: 'dueDate', col: 'due_date' },
    { key: 'saleOrderId', col: 'sale_order_id' },
  ],
  customer_credit_payment: [
    { key: 'customerCreditId', col: 'customer_credit_id' },
    { key: 'date', col: 'date' },
    { key: 'amount', col: 'amount' },
  ],
  supplier_credit: [
    { key: 'date', col: 'date' },
    { key: 'designation', col: 'designation' },
    { key: 'totalAmount', col: 'total_amount' },
    { key: 'advancePaid', col: 'advance_paid', fallback: 0 },
    { key: 'supplierId', col: 'supplier_id' },
  ],
  supplier_credit_payment: [
    { key: 'supplierCreditId', col: 'supplier_credit_id' },
    { key: 'date', col: 'date' },
    { key: 'amount', col: 'amount' },
  ],
  bank_movement: [
    { key: 'date', col: 'date' },
    { key: 'description', col: 'description' },
    { key: 'amountIn', col: 'amount_in', fallback: 0 },
    { key: 'amountOut', col: 'amount_out', fallback: 0 },
  ],
  monthly_summary: [
    { key: 'year', col: 'year' },
    { key: 'month', col: 'month' },
  ],
  monthly_summary_line: [
    { key: 'monthlySummaryId', col: 'monthly_summary_id' },
    { key: 'section', col: 'section' },
    { key: 'label', col: 'label' },
    { key: 'amount', col: 'amount' },
    { key: 'isAutoComputed', col: 'is_auto_computed', fallback: 0 },
  ],
  zakat_snapshot: [
    { key: 'year', col: 'year' },
    { key: 'closingDate', col: 'closing_date' },
    { key: 'closingStockValue', col: 'closing_stock_value' },
    { key: 'closingBankBalance', col: 'closing_bank_balance' },
    { key: 'closingCash', col: 'closing_cash', fallback: 0 },
    { key: 'creditDeduction', col: 'credit_deduction', fallback: 0 },
  ],
  zakat_advance: [
    { key: 'year', col: 'year' },
    { key: 'date', col: 'date' },
    { key: 'amount', col: 'amount' },
    { key: 'note', col: 'note' },
  ],
  employee: [
    { key: 'name', col: 'name' },
    { key: 'monthlySalary', col: 'monthly_salary' },
    { key: 'startDate', col: 'start_date' },
    { key: 'isActive', col: 'is_active', fallback: 1 },
  ],
  salary_payment: [
    { key: 'date', col: 'date' },
    { key: 'amount', col: 'amount' },
    { key: 'note', col: 'note' },
    { key: 'employeeId', col: 'employee_id' },
  ],
  client: [
    { key: 'name', col: 'name' },
    { key: 'phone', col: 'phone' },
  ],
  supplier: [
    { key: 'code', col: 'code' },
  ],
  boutique: [
    { key: 'name', col: 'name' },
  ],
  category: [
    { key: 'name', col: 'name' },
  ],
  sub_category: [
    { key: 'name', col: 'name' },
    { key: 'categoryId', col: 'category_id' },
  ],
  category_alias: [
    { key: 'rawValue', col: 'raw_value' },
    { key: 'categoryId', col: 'category_id' },
  ],
  maintenance_service_type: [
    { key: 'name', col: 'name' },
  ],
  expense_designation: [
    { key: 'name', col: 'name' },
  ],
  user: [
    { key: 'username', col: 'username' },
    { key: 'passwordHash', col: 'password_hash' },
    { key: 'displayName', col: 'display_name' },
    { key: 'role', col: 'role' },
    { key: 'isActive', col: 'is_active', fallback: 1 },
    { key: 'mustChangePassword', col: 'must_change_password', fallback: 0 },
  ],
};

// Map entity type to local SQLite table name
const TABLE_MAP: Record<string, string> = {
  purchase_lot: 'purchase_lots',
  sale_order: 'sale_orders',
  sale_line: 'sale_lines',
  sale_return: 'sale_returns',
  sale_return_line: 'sale_return_lines',
  customer_order: 'customer_orders',
  customer_order_line: 'customer_order_lines',
  maintenance_job: 'maintenance_jobs',
  battery_repair_job: 'battery_repair_jobs',
  battery_tariff: 'battery_tariffs',
  expense: 'expenses',
  customer_credit: 'customer_credits',
  customer_credit_payment: 'customer_credit_payments',
  supplier_credit: 'supplier_credits',
  supplier_credit_payment: 'supplier_credit_payments',
  bank_movement: 'bank_movements',
  monthly_summary: 'monthly_summaries',
  monthly_summary_line: 'monthly_summary_lines',
  zakat_snapshot: 'zakat_snapshots',
  zakat_advance: 'zakat_advances',
  employee: 'employees',
  salary_payment: 'salary_payments',
  client: 'clients',
  supplier: 'suppliers',
  boutique: 'boutiques',
  category: 'categories',
  sub_category: 'sub_categories',
  category_alias: 'category_aliases',
  maintenance_service_type: 'maintenance_service_types',
  expense_designation: 'expense_designations',
  user: 'users',
};

// After database migration, all tables have `version` column
const NO_VERSION_TABLES = new Set<string>();

// Reference tables that do NOT have a `deleted_at` column
const NO_SOFT_DELETE_TABLES = new Set<string>();

// Tables where the natural unique key differs from `id`.
// For these, use INSERT OR IGNORE to skip conflicts (seeded reference data).
// Tables where the natural unique key differs from `id` (seeded reference data).
// Use INSERT OR IGNORE to skip server entities that conflict with existing local data.
// This prevents UNIQUE constraint failures when seeded data has different IDs on backend vs desktop.
const INSERT_OR_IGNORE_TABLES = new Set<string>([
  'category_aliases', 'suppliers', 'boutiques', 'categories', 'sub_categories',
  'battery_tariffs', 'maintenance_service_types', 'expense_designations',
  'users', // admin seeded independently on each end — desktop is auth authority
]);

export class SyncManager {
  private db: Database.Database;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private status: SyncStatus = { connected: false, pendingOps: 0, lastSync: null };
  private pushRetryCount = 0;
  private pullRetryCount = 0;
  private backoffMs = 1000;
  private lastStatusCheck = 0;
  private syncing = false;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureDesktopId();
  }

  start(): void {
    // M5: Use setTimeout chaining instead of setInterval to avoid accumulation during long syncs
    const scheduleNext = () => {
      this.timer = setTimeout(() => {
        this.syncNow()
          .catch(err => console.error('[SYNC] Interval error:', (err as Error).message))
          .finally(() => scheduleNext());
      }, SYNC_INTERVAL_MS);
    };
    // Initial sync attempt, then start the chain
    this.syncNow()
      .catch(err => console.error('[SYNC] Initial sync error:', (err as Error).message))
      .finally(() => scheduleNext());
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  getStatus(): SyncStatus {
    const now = Date.now();
    if (now - this.lastStatusCheck > 5000) {
      const pending = this.db.prepare("SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'pending'").get() as { count: number };
      this.status.pendingOps = pending.count;
      this.lastStatusCheck = now;
    }
    return { ...this.status };
  }

  async syncNow(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      await this.pushOutbox();
      await this.pullUpdates();
      this.status.connected = true;
      this.status.lastSync = new Date().toISOString();
      this.status.errorMessage = undefined;
      this.pushRetryCount = 0;
      this.pullRetryCount = 0;
      this.backoffMs = 1000;
      console.log('[SYNC] connected —', this.status.lastSync);
    } catch (err) {
      const msg = (err as Error).message ?? 'Unknown error';
      this.status.connected = false;
      this.status.errorMessage = msg.includes('fetch failed') || msg.includes('ECONNREFUSED')
        ? 'Serveur injoignable'
        : msg;
      this.pushRetryCount++;
      this.pullRetryCount++;
      console.error('[SYNC] syncNow failed:', msg);
      // Always schedule a retry with exponential backoff (cap at 60s)
      this.backoffMs = Math.min(60_000, this.backoffMs * 2);
      this.retryTimer = setTimeout(() => this.syncNow().catch(e => console.error('[SYNC] Retry error:', (e as Error).message)), this.backoffMs);
    } finally {
      this.syncing = false;
    }
  }

  private ensureDesktopId(): void {
    const existing = this.db.prepare("SELECT value FROM desktop_meta WHERE key = 'desktop_id'").get() as { value: string } | undefined;
    if (!existing) {
      const desktopId = uuidv7();
      this.db.prepare("INSERT INTO desktop_meta (key, value) VALUES ('desktop_id', ?)").run(desktopId);
    }
  }

  private getDesktopId(): string {
    const row = this.db.prepare("SELECT value FROM desktop_meta WHERE key = 'desktop_id'").get() as { value: string };
    return row.value;
  }

  private async pushOutbox(): Promise<void> {
    // Sort by entity priority so reference data (categories, suppliers, boutiques) syncs before entities that reference them
    const pending = this.db.prepare(`
      SELECT *, CASE entity_type
        WHEN 'category' THEN 0 WHEN 'supplier' THEN 0 WHEN 'boutique' THEN 0 WHEN 'client' THEN 0 WHEN 'employee' THEN 0 WHEN 'battery_tariff' THEN 0
        WHEN 'sale_line' THEN 2 WHEN 'monthly_summary_line' THEN 2
        WHEN 'customer_credit_payment' THEN 3 WHEN 'supplier_credit_payment' THEN 3 WHEN 'salary_payment' THEN 3 WHEN 'zakat_advance' THEN 3
        ELSE 1
      END AS priority
      FROM sync_outbox WHERE status = 'pending' ORDER BY priority ASC, created_at ASC LIMIT 50
    `).all() as Array<Record<string, unknown>>;
    if (pending.length === 0) return;

    const desktopId = this.getDesktopId();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Desktop-ID': desktopId };
    if (SYNC_API_KEY) headers['Authorization'] = `Bearer ${SYNC_API_KEY}`;
    const operations = pending.map((op) => ({
      id: op['id'] as string,
      entityType: op['entity_type'] as string,
      entityId: op['entity_id'] as string,
      operation: op['operation'] as string,
      payload: op['payload'] as string,
      version: op['version'] as number,
      createdAt: op['created_at'] as string,
    }));

    const response = await fetch(`${SERVER_URL}/api/sync/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ desktopId, operations }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) throw new Error(`Push failed: ${response.status}`);

    const result = await response.json() as { results: Array<{ operationId: string; result: string }> };

    // M4: Validate response length matches request — detect truncated responses
    if (!result.results || result.results.length !== operations.length) {
      throw new Error(`Push response mismatch: sent ${operations.length} ops, got ${result.results?.length ?? 0} results`);
    }

    const markSynced = this.db.prepare("UPDATE sync_outbox SET status = ?, synced_at = datetime('now') WHERE id = ?");
    for (const r of result.results) {
      markSynced.run(r.result === 'accepted' ? 'synced' : r.result, r.operationId);
    }

    // Cleanup old synced entries (keep last 7 days)
    this.db.prepare("DELETE FROM sync_outbox WHERE status = 'synced' AND synced_at < datetime('now', '-7 days')").run();
    // Cleanup dismissed conflict entries older than 30 days
    this.db.prepare("DELETE FROM sync_outbox WHERE status = 'dismissed' AND created_at < datetime('now', '-30 days')").run();
  }

  private async pullUpdates(): Promise<void> {
    const pullHeaders: Record<string, string> = {};
    if (SYNC_API_KEY) pullHeaders['Authorization'] = `Bearer ${SYNC_API_KEY}`;

    const desktopId = this.getDesktopId();
    const MAX_PULL_ROUNDS = 20; // Safety cap to prevent infinite loops

    for (let round = 0; round < MAX_PULL_ROUNDS; round++) {
      const cursor = this.db.prepare("SELECT last_pull_at FROM sync_cursor WHERE id = 'main'").get() as { last_pull_at: string };

      const response = await fetch(`${SERVER_URL}/api/sync/pull?since=${encodeURIComponent(cursor.last_pull_at)}&limit=500`, {
        headers: pullHeaders,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) throw new Error(`Pull failed: ${response.status}`);

      const data = await response.json() as {
        entities: Array<{ entityType: string; data: Record<string, unknown> }>;
        cursor: string;
        hasMore?: boolean;
      };

      // Validate pulled data structure
      if (!data || !Array.isArray(data.entities) || typeof data.cursor !== 'string') {
        throw new Error('Invalid pull response structure from server');
      }

      if (data.entities.length === 0) return;

      this.db.transaction(() => {
        for (const entity of data.entities) {
          // Skip entities that originated from this desktop to avoid echo
          if ((entity.data['originDesktopId'] ?? entity.data['origin_desktop_id']) === desktopId) continue;

          this.applyServerEntity(entity.entityType, entity.data);
        }

        // Update cursor
        this.db.prepare("UPDATE sync_cursor SET last_pull_at = ? WHERE id = 'main'").run(data.cursor);
      })();

      // H2: Loop if server reports more data available
      if (!data.hasMore) return;
    }
  }

  private applyServerEntity(entityType: string, data: Record<string, unknown>): void {
    const table = TABLE_MAP[entityType];
    if (!table) {
      console.warn(`[SYNC] Unknown entity type: ${entityType}`);
      return;
    }

    const id = data['id'] as string;
    if (!id || typeof id !== 'string') {
      console.warn(`[SYNC] Missing or invalid id for ${entityType}`);
      return;
    }
    const serverVersion = (data['version'] ?? 1) as number;
    const hasVersion = !NO_VERSION_TABLES.has(table);
    const hasSoftDelete = !NO_SOFT_DELETE_TABLES.has(table);

    // Check if local record exists (version check only for tables with version column)
    if (hasVersion) {
      const local = this.db.prepare(`SELECT version FROM ${table} WHERE id = ?`).get(id) as { version: number } | undefined;
      if (local && local.version >= serverVersion) {
        return; // Local is same or newer — skip
      }
    }

    if (data['deletedAt'] || data['deleted_at']) {
      if (hasSoftDelete) {
        // Soft-delete locally
        const existing = this.db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
        if (existing) {
          const delAt = (data['deletedAt'] ?? data['deleted_at']) as string;
          if (hasVersion) {
            this.db.prepare(`UPDATE ${table} SET deleted_at = ?, version = ? WHERE id = ?`).run(delAt, serverVersion, id);
          } else {
            this.db.prepare(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`).run(delAt, id);
          }
        }
      }
      // Tables without soft-delete: skip deletes (reference data)
      return;
    }

    // Build upsert dynamically from the entity column mapping
    const columnDefs = ENTITY_COLUMNS[entityType];
    if (!columnDefs) {
      console.warn(`[SYNC] No column mapping for entity type: ${entityType}`);
      return;
    }

    const now = new Date().toISOString();
    // SQLite only accepts: number, string, bigint, Buffer, null. Convert booleans → 0/1, Dates → ISO string.
    const toSQLite = (v: unknown): string | number | bigint | Buffer | null => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint' || Buffer.isBuffer(v)) return v;
      return String(v);
    };
    const colVal = (c: ColDef) => toSQLite(data[c.key] ?? data[c.col] ?? c.fallback ?? null);

    // Tables with secondary unique natural keys (e.g. category_aliases.raw_value):
    // use INSERT OR IGNORE to skip server entries that conflict with existing local data.
    if (INSERT_OR_IGNORE_TABLES.has(table)) {
      const cols = ['id', ...columnDefs.map(c => c.col), 'version', 'created_at', 'updated_at'];
      const placeholders = cols.map(() => '?').join(', ');
      const values = [
        id,
        ...columnDefs.map(c => colVal(c)),
        serverVersion,
        toSQLite(data['createdAt'] ?? data['created_at'] ?? now),
        toSQLite(data['updatedAt'] ?? data['updated_at'] ?? now),
      ];
      this.db.prepare(
        `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
      ).run(...values);
      return;
    }

    if (hasVersion) {
      const cols = ['id', ...columnDefs.map(c => c.col), 'version', 'created_at', 'updated_at'];
      const placeholders = cols.map(() => '?').join(', ');
      const updateSet = [...columnDefs.map(c => `${c.col} = excluded.${c.col}`), 'version = excluded.version', 'updated_at = excluded.updated_at'].join(', ');
      const values = [
        id,
        ...columnDefs.map(c => colVal(c)),
        serverVersion,
        toSQLite(data['createdAt'] ?? data['created_at'] ?? now),
        toSQLite(data['updatedAt'] ?? data['updated_at'] ?? now),
      ];
      this.db.prepare(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`
      ).run(...values);
    } else {
      // Simple upsert for reference tables without version column
      const cols = ['id', ...columnDefs.map(c => c.col), 'created_at', 'updated_at'];
      const placeholders = cols.map(() => '?').join(', ');
      const updateSet = [...columnDefs.map(c => `${c.col} = excluded.${c.col}`), 'updated_at = excluded.updated_at'].join(', ');
      const values = [
        id,
        ...columnDefs.map(c => colVal(c)),
        toSQLite(data['createdAt'] ?? data['created_at'] ?? now),
        toSQLite(data['updatedAt'] ?? data['updated_at'] ?? now),
      ];
      this.db.prepare(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`
      ).run(...values);
    }

    // Sync user permissions when pulling a user entity
    if (entityType === 'user') {
      const perms = data['permissions'] as string[] | undefined;
      if (Array.isArray(perms)) {
        this.db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(id);
        const insertPerm = this.db.prepare('INSERT INTO user_permissions (id, user_id, page_key, created_at) VALUES (?, ?, ?, ?)');
        for (const pageKey of perms) {
          insertPerm.run(uuidv7(), id, pageKey, now);
        }
      }
    }
  }
}

// Helper to add operations to the outbox
export function addToOutbox(
  db: Database.Database,
  entityType: string,
  entityId: string,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
  payload: unknown,
): void {
  const id = uuidv7();
  let version = 1;
  if (operation !== 'CREATE') {
    const table = TABLE_MAP[entityType];
    if (table && !NO_VERSION_TABLES.has(table)) {
      try {
        // H1: Atomically increment local version before reading — prevents two rapid
        // local edits from carrying the same version (which causes spurious conflicts)
        db.prepare(`UPDATE ${table} SET version = version + 1 WHERE id = ?`).run(entityId);
        const row = db.prepare(`SELECT version FROM ${table} WHERE id = ?`).get(entityId) as { version: number } | undefined;
        if (row) version = row.version;
      } catch (err: unknown) {
        const msg = (err instanceof Error) ? err.message : String(err);
        if (!msg.includes('no such column') && !msg.includes('has no column named')) throw err;
      }
    }
  }
  db.prepare(`INSERT INTO sync_outbox (id, entity_type, entity_id, operation, payload, version) VALUES (?, ?, ?, ?, ?, ?)`).run(id, entityType, entityId, operation, JSON.stringify(payload), version);
}
