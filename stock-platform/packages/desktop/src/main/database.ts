/**
 * Local SQLite database for offline-first operation.
 * Mirrors the server schema with additional sync outbox.
 * All monetary values stored as integers in centimes.
 */

import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { join } from 'path';
import { v7 as uuidv7 } from 'uuid';
import {
  SUPPLIERS,
  BOUTIQUES,
  CATEGORIES,
  CATEGORY_ALIASES,
  BATTERY_TARIFF_LABELS,
  BATTERY_TARIFF_DEFAULTS,
  MAINTENANCE_SERVICE_TYPES,
  EXPENSE_DESIGNATIONS,
} from '@stock/shared';

let db: Database.Database;

/** Returns the generated admin password (if a new one was created), or null. */
export function initDatabase(userDataPath: string): string | null {
  const dbPath = join(userDataPath, 'stock-platform.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = FULL');
  db.pragma('cache_size = -20000');
  db.pragma('busy_timeout = 5000');
  db.pragma('temp_store = MEMORY');

  createTables();
  runMigrations();
  const generatedPassword = seedMasterData();

  // Only seed sample/demo data in development
  if (process.env['NODE_ENV'] !== 'production') {
    seedSampleData();
    seedMissingData();
  }

  // Ensure all existing data has outbox entries so it syncs to the server
  backfillOutbox();

  // Diagnostic counts (dev only)
  if (process.env['NODE_ENV'] !== 'production') {
    const counts = {
      suppliers: (db.prepare('SELECT COUNT(*) as c FROM suppliers').get() as { c: number }).c,
      boutiques: (db.prepare('SELECT COUNT(*) as c FROM boutiques').get() as { c: number }).c,
      categories: (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c,
      purchaseLots: (db.prepare('SELECT COUNT(*) as c FROM purchase_lots').get() as { c: number }).c,
    };
    console.log('[DB] Table counts after init:', JSON.stringify(counts));
  }

  return generatedPassword;
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDatabase first');
  return db;
}

function createTables(): void {
  db.exec(`
    -- Master Data
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);

    CREATE TABLE IF NOT EXISTS boutiques (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_boutiques_name ON boutiques(name);

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS category_aliases (
      id TEXT PRIMARY KEY,
      raw_value TEXT NOT NULL UNIQUE,
      category_id TEXT NOT NULL REFERENCES categories(id),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_category_aliases_category ON category_aliases(category_id);

    -- Sub-Categories
    CREATE TABLE IF NOT EXISTS sub_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sub_categories_category ON sub_categories(category_id);
    CREATE INDEX IF NOT EXISTS idx_sub_categories_name ON sub_categories(name);
    CREATE INDEX IF NOT EXISTS idx_sub_categories_deleted ON sub_categories(deleted_at) WHERE deleted_at IS NULL;

    -- Purchase Lots
    CREATE TABLE IF NOT EXISTS purchase_lots (
      id TEXT PRIMARY KEY,
      ref_number TEXT NOT NULL,
      date TEXT NOT NULL,
      designation TEXT NOT NULL,
      initial_quantity INTEGER NOT NULL CHECK(initial_quantity > 0),
      purchase_unit_cost INTEGER NOT NULL CHECK(purchase_unit_cost > 0),
      target_resale_price INTEGER,
      block_price INTEGER,
      category_id TEXT NOT NULL REFERENCES categories(id),
      supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      boutique_id TEXT NOT NULL REFERENCES boutiques(id),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_purchase_lots_date ON purchase_lots(date);
    CREATE INDEX IF NOT EXISTS idx_purchase_lots_category ON purchase_lots(category_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_lots_supplier ON purchase_lots(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_lots_boutique ON purchase_lots(boutique_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_lots_deleted ON purchase_lots(deleted_at) WHERE deleted_at IS NULL;

    -- Clients
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

    -- Employees
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      monthly_salary INTEGER NOT NULL CHECK(monthly_salary > 0),
      start_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    -- Salary Payments
    CREATE TABLE IF NOT EXISTS salary_payments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      note TEXT,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_salary_payments_employee ON salary_payments(employee_id);
    CREATE INDEX IF NOT EXISTS idx_salary_payments_date ON salary_payments(date);
    CREATE INDEX IF NOT EXISTS idx_salary_payments_deleted ON salary_payments(deleted_at) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_employees_deleted ON employees(deleted_at) WHERE deleted_at IS NULL;

    -- Sale Orders
    CREATE TABLE IF NOT EXISTS sale_orders (
      id TEXT PRIMARY KEY,
      ref_number TEXT NOT NULL,
      date TEXT NOT NULL,
      observation TEXT,
      client_id TEXT REFERENCES clients(id),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sale_orders_date ON sale_orders(date);
    CREATE INDEX IF NOT EXISTS idx_sale_orders_client ON sale_orders(client_id);
    CREATE INDEX IF NOT EXISTS idx_sale_orders_deleted ON sale_orders(deleted_at) WHERE deleted_at IS NULL;

    -- Sale Lines
    CREATE TABLE IF NOT EXISTS sale_lines (
      id TEXT PRIMARY KEY,
      selling_unit_price INTEGER NOT NULL CHECK(selling_unit_price > 0),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      sale_order_id TEXT NOT NULL REFERENCES sale_orders(id),
      lot_id TEXT NOT NULL REFERENCES purchase_lots(id),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sale_lines_lot ON sale_lines(lot_id);
    CREATE INDEX IF NOT EXISTS idx_sale_lines_order ON sale_lines(sale_order_id);
    CREATE INDEX IF NOT EXISTS idx_sale_lines_deleted ON sale_lines(deleted_at) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_sale_lines_lot_deleted ON sale_lines(lot_id, deleted_at) WHERE deleted_at IS NULL;

    -- Sale Returns
    CREATE TABLE IF NOT EXISTS sale_returns (
      id TEXT PRIMARY KEY,
      ref_number TEXT NOT NULL,
      date TEXT NOT NULL,
      sale_order_id TEXT NOT NULL REFERENCES sale_orders(id),
      observation TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sale_returns_order ON sale_returns(sale_order_id);
    CREATE INDEX IF NOT EXISTS idx_sale_returns_deleted ON sale_returns(deleted_at) WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS sale_return_lines (
      id TEXT PRIMARY KEY,
      sale_return_id TEXT NOT NULL REFERENCES sale_returns(id),
      sale_line_id TEXT NOT NULL REFERENCES sale_lines(id),
      lot_id TEXT NOT NULL REFERENCES purchase_lots(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      selling_unit_price INTEGER NOT NULL CHECK(selling_unit_price > 0),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sale_return_lines_return ON sale_return_lines(sale_return_id);
    CREATE INDEX IF NOT EXISTS idx_sale_return_lines_sale_line ON sale_return_lines(sale_line_id);
    CREATE INDEX IF NOT EXISTS idx_sale_return_lines_lot ON sale_return_lines(lot_id);
    CREATE INDEX IF NOT EXISTS idx_sale_return_lines_deleted ON sale_return_lines(deleted_at) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_sale_return_lines_lot_deleted ON sale_return_lines(lot_id, deleted_at) WHERE deleted_at IS NULL;

    -- Customer Orders
    CREATE TABLE IF NOT EXISTS customer_orders (
      id TEXT PRIMARY KEY,
      ref_number TEXT NOT NULL,
      date TEXT NOT NULL,
      client_id TEXT REFERENCES clients(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','delivered','cancelled')),
      observation TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_customer_orders_date ON customer_orders(date);
    CREATE INDEX IF NOT EXISTS idx_customer_orders_client ON customer_orders(client_id);
    CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON customer_orders(status);
    CREATE INDEX IF NOT EXISTS idx_customer_orders_deleted ON customer_orders(deleted_at) WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS customer_order_lines (
      id TEXT PRIMARY KEY,
      customer_order_id TEXT NOT NULL REFERENCES customer_orders(id),
      lot_id TEXT NOT NULL REFERENCES purchase_lots(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      selling_unit_price INTEGER NOT NULL CHECK(selling_unit_price > 0),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_customer_order_lines_order ON customer_order_lines(customer_order_id);
    CREATE INDEX IF NOT EXISTS idx_customer_order_lines_lot ON customer_order_lines(lot_id);
    CREATE INDEX IF NOT EXISTS idx_customer_order_lines_deleted ON customer_order_lines(deleted_at) WHERE deleted_at IS NULL;

    -- Maintenance Jobs
    CREATE TABLE IF NOT EXISTS maintenance_jobs (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      designation TEXT NOT NULL,
      price INTEGER NOT NULL CHECK(price > 0),
      boutique_id TEXT NOT NULL REFERENCES boutiques(id),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_boutique ON maintenance_jobs(boutique_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_date ON maintenance_jobs(date);
    CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_deleted ON maintenance_jobs(deleted_at) WHERE deleted_at IS NULL;

    -- Battery Tariffs
    CREATE TABLE IF NOT EXISTS battery_tariffs (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL UNIQUE,
      particuliers_price INTEGER,
      rev_price INTEGER,
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    -- Battery Repair Jobs
    CREATE TABLE IF NOT EXISTS battery_repair_jobs (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      customer_note TEXT,
      amount INTEGER NOT NULL,
      cost_adjustment INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_battery_repair_jobs_date ON battery_repair_jobs(date);
    CREATE INDEX IF NOT EXISTS idx_battery_repair_jobs_deleted ON battery_repair_jobs(deleted_at) WHERE deleted_at IS NULL;

    -- Maintenance Service Types (autocomplete reference)
    CREATE TABLE IF NOT EXISTS maintenance_service_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    -- Expense Designations (autocomplete reference)
    CREATE TABLE IF NOT EXISTS expense_designations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      designation TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      boutique_id TEXT NOT NULL REFERENCES boutiques(id),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_boutique ON expenses(boutique_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON expenses(deleted_at) WHERE deleted_at IS NULL;

    -- Customer Credits
    CREATE TABLE IF NOT EXISTS customer_credits (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      designation TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price INTEGER NOT NULL CHECK(unit_price > 0),
      advance_paid INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_customer_credits_date ON customer_credits(date);
    CREATE INDEX IF NOT EXISTS idx_customer_credits_deleted ON customer_credits(deleted_at) WHERE deleted_at IS NULL;

    -- Customer Credit Payments
    CREATE TABLE IF NOT EXISTS customer_credit_payments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      customer_credit_id TEXT NOT NULL REFERENCES customer_credits(id),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_customer_credit_payments_credit ON customer_credit_payments(customer_credit_id);
    CREATE INDEX IF NOT EXISTS idx_customer_credit_payments_deleted ON customer_credit_payments(deleted_at) WHERE deleted_at IS NULL;

    -- Supplier Credits
    CREATE TABLE IF NOT EXISTS supplier_credits (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      designation TEXT NOT NULL,
      total_amount INTEGER NOT NULL CHECK(total_amount > 0),
      advance_paid INTEGER NOT NULL DEFAULT 0,
      supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    -- Supplier Credit Payments
    CREATE TABLE IF NOT EXISTS supplier_credit_payments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      supplier_credit_id TEXT NOT NULL REFERENCES supplier_credits(id),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_supplier_credits_date ON supplier_credits(date);
    CREATE INDEX IF NOT EXISTS idx_supplier_credits_deleted ON supplier_credits(deleted_at) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_supplier_credit_payments_credit ON supplier_credit_payments(supplier_credit_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_credit_payments_deleted ON supplier_credit_payments(deleted_at) WHERE deleted_at IS NULL;

    -- Bank Movements
    CREATE TABLE IF NOT EXISTS bank_movements (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_in INTEGER NOT NULL DEFAULT 0,
      amount_out INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_bank_movements_date ON bank_movements(date);
    CREATE INDEX IF NOT EXISTS idx_bank_movements_deleted ON bank_movements(deleted_at) WHERE deleted_at IS NULL;

    -- Monthly Summaries
    CREATE TABLE IF NOT EXISTS monthly_summaries (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK(month >= 1 AND month <= 12),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      UNIQUE(year, month)
    );

    -- Monthly Summary Lines
    CREATE TABLE IF NOT EXISTS monthly_summary_lines (
      id TEXT PRIMARY KEY,
      section TEXT NOT NULL CHECK(section IN ('revenue', 'expense', 'salary')),
      label TEXT NOT NULL,
      amount INTEGER NOT NULL,
      is_auto_computed INTEGER NOT NULL DEFAULT 0,
      monthly_summary_id TEXT NOT NULL REFERENCES monthly_summaries(id),
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    -- Zakat Snapshots
    CREATE TABLE IF NOT EXISTS zakat_snapshots (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL UNIQUE,
      closing_date TEXT NOT NULL,
      closing_stock_value INTEGER NOT NULL,
      closing_bank_balance INTEGER NOT NULL,
      closing_cash INTEGER NOT NULL,
      credit_deduction INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    -- Zakat Advances
    CREATE TABLE IF NOT EXISTS zakat_advances (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      date TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      note TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      origin_desktop_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_zakat_advances_year ON zakat_advances(year);
    CREATE INDEX IF NOT EXISTS idx_zakat_advances_deleted ON zakat_advances(deleted_at) WHERE deleted_at IS NULL;

    -- ─── Users & Permissions ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'employee')) DEFAULT 'employee',
      employee_id TEXT REFERENCES employees(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      page_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

    -- ─── Sync Outbox ─────────────────────────────────────────────────
    -- Stores local operations not yet pushed to server.
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE')),
      payload TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'conflict', 'rejected'))
    );

    CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entity_id);

    -- Sync cursor: tracks the last pull timestamp
    CREATE TABLE IF NOT EXISTS sync_cursor (
      id TEXT PRIMARY KEY DEFAULT 'main',
      last_pull_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
    );

    INSERT OR IGNORE INTO sync_cursor (id, last_pull_at) VALUES ('main', '1970-01-01T00:00:00.000Z');

    -- Desktop identity
    CREATE TABLE IF NOT EXISTS desktop_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // ── Migrations for existing databases ──
  // Add block_price column if not present (safe to run multiple times)
  const plCols = db.prepare("PRAGMA table_info(purchase_lots)").all() as Array<{ name: string }>;
  if (!plCols.some(c => c.name === 'block_price')) {
    db.exec('ALTER TABLE purchase_lots ADD COLUMN block_price INTEGER');
  }
  // Add client_id column to sale_orders if not present
  const soCols = db.prepare("PRAGMA table_info(sale_orders)").all() as Array<{ name: string }>;
  if (!soCols.some(c => c.name === 'client_id')) {
    db.exec('ALTER TABLE sale_orders ADD COLUMN client_id TEXT REFERENCES clients(id)');
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Migrations — add columns that weren't in the original schema.
 * Uses try/catch so each ALTER is idempotent (ignored if column exists).
 * ──────────────────────────────────────────────────────────────────────────── */

function runMigrations(): void {
  const addCol = (table: string, col: string, def: string) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    } catch {
      // Column already exists — safe to ignore
    }
  };

  // Add version + origin_desktop_id to ALL synced tables (idempotent — silently ignored if column exists)
  const versionedTables = [
    'purchase_lots', 'employees', 'salary_payments', 'sale_orders', 'sale_lines',
    'maintenance_jobs', 'battery_tariffs', 'battery_repair_jobs', 'maintenance_service_types',
    'expense_designations', 'expenses', 'customer_credits', 'customer_credit_payments',
    'supplier_credits', 'supplier_credit_payments', 'bank_movements', 'monthly_summaries',
    'monthly_summary_lines', 'zakat_snapshots', 'zakat_advances',
    'suppliers', 'boutiques', 'categories', 'category_aliases', 'clients', 'users',
  ];
  // category_aliases also needs updated_at and deleted_at
  // Use plain TEXT (no NOT NULL) — ALTER TABLE ADD COLUMN cannot add NOT NULL with expression defaults
  addCol('category_aliases', 'updated_at', 'TEXT');
  addCol('category_aliases', 'deleted_at', 'TEXT');
  for (const t of versionedTables) {
    addCol(t, 'version', 'INTEGER NOT NULL DEFAULT 1');
    addCol(t, 'origin_desktop_id', 'TEXT');
  }

  // deleted_at migrations for reference tables (added post-launch)
  addCol('suppliers', 'deleted_at', 'TEXT');
  addCol('boutiques', 'deleted_at', 'TEXT');
  addCol('categories', 'deleted_at', 'TEXT');

  // Add sub_category_id and selling_price to purchase_lots
  addCol('purchase_lots', 'sub_category_id', 'TEXT REFERENCES sub_categories(id)');
  addCol('purchase_lots', 'selling_price', 'INTEGER');

  // Add due_date and sale_order_id to customer_credits
  addCol('customer_credits', 'due_date', 'TEXT');
  addCol('customer_credits', 'sale_order_id', 'TEXT REFERENCES sale_orders(id)');

  // Add barcode to purchase_lots
  addCol('purchase_lots', 'barcode', 'TEXT');
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_lots_barcode ON purchase_lots(barcode) WHERE barcode IS NOT NULL AND deleted_at IS NULL`); } catch { /* index may already exist */ }

  // Dismiss stale rejected outbox entries for entity types not supported by the backend
  // (maintenance_service_type and expense_designation are desktop-only reference data)
  try {
    db.exec(`
      UPDATE sync_outbox
      SET status = 'dismissed'
      WHERE entity_type IN ('maintenance_service_type', 'expense_designation')
        AND status IN ('pending', 'rejected')
    `);
  } catch {
    // Table may not exist yet on first run — safe to ignore
  }

  // C4: Recreate sync_outbox to add 'dismissed' to CHECK constraint
  // SQLite doesn't support ALTER CHECK, so we recreate the table
  const outboxCols = db.prepare("PRAGMA table_info(sync_outbox)").all() as Array<{ name: string }>;
  if (outboxCols.length > 0) {
    // Check if 'dismissed' is already supported by trying a test
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS _sync_outbox_new (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE')),
          payload TEXT NOT NULL,
          version INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          synced_at TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'conflict', 'rejected', 'dismissed'))
        );
        INSERT OR IGNORE INTO _sync_outbox_new SELECT * FROM sync_outbox;
        DROP TABLE sync_outbox;
        ALTER TABLE _sync_outbox_new RENAME TO sync_outbox;
        CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status, created_at);
        CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entity_id);
      `);
    } catch {
      // Table already has the right constraint or migration already ran
      db.exec('DROP TABLE IF EXISTS _sync_outbox_new');
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Master data seeding — runs every startup but uses INSERT OR IGNORE
 * so it is idempotent (only inserts if code is not yet present).
 * ──────────────────────────────────────────────────────────────────────────── */

function seedMasterData(): string | null {
  const insertSupplier = db.prepare('INSERT OR IGNORE INTO suppliers (id, code) VALUES (?, ?)');
  const insertBoutique = db.prepare('INSERT OR IGNORE INTO boutiques (id, name) VALUES (?, ?)');
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)');
  const insertAlias = db.prepare('INSERT OR IGNORE INTO category_aliases (id, raw_value, category_id) VALUES (?, ?, ?)');
  const insertTariff = db.prepare('INSERT OR IGNORE INTO battery_tariffs (id, label, particuliers_price, rev_price) VALUES (?, ?, ?, ?)');
  const insertMaintType = db.prepare('INSERT OR IGNORE INTO maintenance_service_types (id, name) VALUES (?, ?)');
  const insertExpDesig = db.prepare('INSERT OR IGNORE INTO expense_designations (id, name) VALUES (?, ?)');

  const catIdMap: Record<string, string> = {};
  let generatedPassword: string | null = null;

  const tx = db.transaction(() => {
    for (const code of SUPPLIERS) {
      insertSupplier.run(`sup-${code.toLowerCase()}`, code);
    }

    for (const name of BOUTIQUES) {
      insertBoutique.run(`bout-${name.toLowerCase()}`, name);
    }

    for (const name of CATEGORIES) {
      const id = `cat-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      insertCategory.run(id, name);
      catIdMap[name] = id;
    }

    // Resolve aliases — need to look up existing category IDs for categories that existed before
    const existingCats = db.prepare('SELECT id, name FROM categories').all() as Array<{ id: string; name: string }>;
    for (const c of existingCats) catIdMap[c.name] = c.id;

    for (const [raw, canonical] of Object.entries(CATEGORY_ALIASES)) {
      const catId = catIdMap[canonical];
      if (catId) {
        insertAlias.run(`alias-${raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, raw, catId);
      }
    }

    for (const label of BATTERY_TARIFF_LABELS) {
      const defaults = BATTERY_TARIFF_DEFAULTS[label];
      const pricePart = defaults.particuliers != null ? defaults.particuliers * 100 : null;
      const revPart = defaults.rev != null ? defaults.rev * 100 : null;
      insertTariff.run(`tariff-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`, label, pricePart, revPart);
    }

    for (const name of MAINTENANCE_SERVICE_TYPES) {
      insertMaintType.run(`mtype-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name);
    }

    for (const name of EXPENSE_DESIGNATIONS) {
      insertExpDesig.run(`edesig-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name);
    }

    // ── Seed admin users (idempotent) ──
    const ALL_PAGES = [
      'dashboard', 'purchases', 'stock', 'sales', 'maintenance',
      'battery-repair', 'expenses', 'credits', 'bank', 'monthly-summary', 'zakat',
    ];
    const userCount = (db.prepare('SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL').get() as { c: number }).c;
    if (userCount === 0) {
      const defaultPassword = process.env['ADMIN_DEFAULT_PASSWORD'] || require('crypto').randomBytes(16).toString('base64url');
      if (!process.env['ADMIN_DEFAULT_PASSWORD']) {
        generatedPassword = defaultPassword;
      }
      const defaultHash = bcrypt.hashSync(defaultPassword, 10);
      const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role, is_active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 1, datetime(\'now\'), datetime(\'now\'))');
      const insertPerm = db.prepare('INSERT INTO user_permissions (id, user_id, page_key, created_at) VALUES (?, ?, ?, datetime(\'now\'))');

      const admins = [
        { id: 'user-hicham', username: 'hicham', displayName: 'HICHAM' },
        { id: 'user-samir', username: 'samir', displayName: 'SAMIR' },
      ];
      for (const admin of admins) {
        insertUser.run(admin.id, admin.username, defaultHash, admin.displayName, 'admin');
        for (const page of ALL_PAGES) {
          insertPerm.run(uuidv7(), admin.id, page);
        }
      }
    }
  });

  tx();

  return generatedPassword;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Sample data seeding — only runs if the database has no purchase lots yet.
 * Populates realistic demo data so the dashboard and pages show content.
 * All monetary values in centimes.
 * ──────────────────────────────────────────────────────────────────────────── */

function seedSampleData(): void {
  const count = (db.prepare('SELECT COUNT(*) as c FROM purchase_lots').get() as { c: number }).c;
  if (count > 0) return; // already has data

  const catId = (name: string) => (db.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: string }).id;
  const supId = (code: string) => (db.prepare('SELECT id FROM suppliers WHERE code = ?').get(code) as { id: string }).id;
  const boutId = (name: string) => (db.prepare('SELECT id FROM boutiques WHERE name = ?').get(name) as { id: string }).id;

  const now = new Date().toISOString();

  // Dynamic dates: spread seed data across current month and previous 2 months
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-based
  const d = (monthOffset: number, day: number): string => {
    const dt = new Date(y, m + monthOffset, day);
    return dt.toISOString().slice(0, 10);
  };

  const tx = db.transaction(() => {
    // ── Purchase Lots (12 items across categories) ──

    const lots: Array<{ id: string; cat: string; desig: string; sup: string; bout: string; qty: number; cost: number; resale: number; date: string }> = [
      { id: uuidv7(), cat: 'PP RAM', desig: 'RAM DDR4 8GB 2666MHz', sup: 'AB', bout: 'MLILIYA', qty: 20, cost: 350000, resale: 500000, date: d(-2, 15) },
      { id: uuidv7(), cat: 'PP SSD', desig: 'SSD NVMe 256GB Samsung', sup: 'F5', bout: 'MLILIYA', qty: 15, cost: 450000, resale: 650000, date: d(-2, 20) },
      { id: uuidv7(), cat: 'PP HDD', desig: 'HDD 1TB Seagate 2.5"', sup: 'MAG', bout: 'TAYRET', qty: 10, cost: 550000, resale: 750000, date: d(-1, 1) },
      { id: uuidv7(), cat: 'CABLES HDMI / DISPLAY', desig: 'Cable HDMI 2.0 1.5m', sup: 'MC', bout: 'MLILIYA', qty: 50, cost: 15000, resale: 30000, date: d(-1, 5) },
      { id: uuidv7(), cat: 'PP CHARGEUR NEUF COPY', desig: 'Chargeur HP 65W 19.5V', sup: 'AB', bout: 'TAYRET', qty: 25, cost: 200000, resale: 350000, date: d(-1, 10) },
      { id: uuidv7(), cat: 'CASQUES', desig: 'Casque Bluetooth Over-Ear', sup: 'F5', bout: 'MLILIYA', qty: 30, cost: 180000, resale: 300000, date: d(-1, 15) },
      { id: uuidv7(), cat: 'GSM CHARGEUR', desig: 'Chargeur USB-C 20W', sup: 'MC', bout: 'MLILIYA', qty: 40, cost: 80000, resale: 150000, date: d(-1, 20) },
      { id: uuidv7(), cat: 'LAPTOP HP', desig: 'HP ProBook 450 G10 i5/8GB/256GB', sup: 'AB', bout: 'MLILIYA', qty: 5, cost: 7500000, resale: 9500000, date: d(0, 1) },
      { id: uuidv7(), cat: 'FLASH/SD', desig: 'Cle USB 3.0 64GB Kingston', sup: 'MAG', bout: 'TAYRET', qty: 60, cost: 25000, resale: 50000, date: d(0, 5) },
      { id: uuidv7(), cat: 'PP BATTERIE HP', desig: 'Batterie HP EliteBook 840 G5', sup: 'F5', bout: 'MLILIYA', qty: 12, cost: 400000, resale: 600000, date: d(0, 10) },
      { id: uuidv7(), cat: 'CABLES USB', desig: 'Cable USB-C vers USB-A 1m', sup: 'MC', bout: 'TAYRET', qty: 80, cost: 10000, resale: 25000, date: d(0, 12) },
      { id: uuidv7(), cat: 'PP CLAVIER HP', desig: 'Clavier HP ProBook 450 G7 FR', sup: 'AB', bout: 'MLILIYA', qty: 8, cost: 250000, resale: 400000, date: d(0, 15) },
    ];

    const insertLot = db.prepare(`
      INSERT INTO purchase_lots (id, ref_number, date, designation, initial_quantity, purchase_unit_cost, target_resale_price, category_id, supplier_id, boutique_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const lot of lots) {
      insertLot.run(lot.id, `PUR-${Date.now()}-${lot.id.slice(-4)}`, lot.date, lot.desig, lot.qty, lot.cost, lot.resale, catId(lot.cat), supId(lot.sup), boutId(lot.bout), now, now);
    }

    // ── Sale Orders (5 orders in March 2026) ──

    const insertOrder = db.prepare('INSERT INTO sale_orders (id, ref_number, date, observation, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    const insertLine = db.prepare('INSERT INTO sale_lines (id, selling_unit_price, quantity, sale_order_id, lot_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

    const sales = [
      { date: d(0, 16), obs: 'Client fidele', lines: [{ lot: lots[0], qty: 3, price: 500000 }, { lot: lots[1], qty: 2, price: 650000 }] },
      { date: d(0, 17), obs: '', lines: [{ lot: lots[3], qty: 10, price: 30000 }, { lot: lots[6], qty: 5, price: 150000 }] },
      { date: d(0, 18), obs: 'Revendeur Tayret', lines: [{ lot: lots[4], qty: 3, price: 320000 }, { lot: lots[2], qty: 2, price: 750000 }] },
      { date: d(0, 20), obs: '', lines: [{ lot: lots[7], qty: 1, price: 9500000 }, { lot: lots[5], qty: 4, price: 300000 }] },
      { date: d(0, 22), obs: 'Lot flash USB', lines: [{ lot: lots[8], qty: 15, price: 50000 }, { lot: lots[10], qty: 20, price: 25000 }] },
    ];

    for (const sale of sales) {
      const orderId = uuidv7();
      insertOrder.run(orderId, `SAL-${Date.now()}-${orderId.slice(-4)}`, sale.date, sale.obs || null, now, now);
      for (const line of sale.lines) {
        insertLine.run(uuidv7(), line.price, line.qty, orderId, line.lot.id, now, now);
      }
    }

    // ── Maintenance Jobs (4 jobs) ──

    const insertMaint = db.prepare('INSERT INTO maintenance_jobs (id, date, designation, price, boutique_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const maintJobs = [
      { date: d(0, 10), desig: 'INSTALL Windows 11 + Office', price: 150000, bout: 'MLILIYA' },
      { date: d(0, 12), desig: 'REPARATION DELL charniere', price: 250000, bout: 'MLILIYA' },
      { date: d(0, 15), desig: 'INSTALL + transfert donnees', price: 200000, bout: 'TAYRET' },
      { date: d(0, 20), desig: 'CARCASSE HP ProBook', price: 350000, bout: 'MLILIYA' },
    ];
    for (const j of maintJobs) {
      insertMaint.run(uuidv7(), j.date, j.desig, j.price, boutId(j.bout), now, now);
    }

    // ── Battery Repair Jobs (3 jobs) ──

    const insertBattery = db.prepare('INSERT INTO battery_repair_jobs (id, date, description, customer_note, amount, cost_adjustment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const batteryJobs = [
      { date: d(0, 11), desc: 'BALLANCER/CHARGER/DECHARGER LES CELLULES', note: 'HP EliteBook 840', amount: 10000, adj: 0 },
      { date: d(0, 14), desc: 'REPARATION DE LA CARTE', note: 'Dell Latitude 5520', amount: 15000, adj: 2000 },
      { date: d(0, 19), desc: 'FLASH UNLOCK', note: 'Lenovo ThinkPad', amount: 20000, adj: 0 },
    ];
    for (const j of batteryJobs) {
      insertBattery.run(uuidv7(), j.date, j.desc, j.note, j.amount, j.adj, now, now);
    }

    // ── Expenses (5 entries) ──

    const insertExp = db.prepare('INSERT INTO expenses (id, date, designation, amount, boutique_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const expenses = [
      { date: d(0, 1), desig: 'Loyer depot mars', amount: 3000000, bout: 'MLILIYA' },
      { date: d(0, 1), desig: 'Electricite mars', amount: 450000, bout: 'MLILIYA' },
      { date: d(0, 5), desig: 'SDTM materiel nettoyage', amount: 120000, bout: 'TAYRET' },
      { date: d(0, 10), desig: 'Internet fibre', amount: 350000, bout: 'MLILIYA' },
      { date: d(0, 15), desig: 'SAC emballages', amount: 80000, bout: 'TAYRET' },
    ];
    for (const e of expenses) {
      insertExp.run(uuidv7(), e.date, e.desig, e.amount, boutId(e.bout), now, now);
    }

    // ── Customer Credits (2 credits) ──

    const insertCustCredit = db.prepare('INSERT INTO customer_credits (id, date, customer_name, designation, quantity, unit_price, advance_paid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insertCustCredit.run(uuidv7(), d(0, 8), 'ABDO BENTAJ', 'Laptop HP + RAM upgrade', 1, 10000000, 5000000, now, now);
    insertCustCredit.run(uuidv7(), d(0, 14), 'YASSIN BENTAJ', 'SSD 512GB + Installation', 1, 800000, 300000, now, now);

    // ── Supplier Credits (1 credit) ──

    const insertSuppCredit = db.prepare('INSERT INTO supplier_credits (id, date, designation, total_amount, advance_paid, supplier_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insertSuppCredit.run(uuidv7(), d(0, 1), 'Lot claviers HP + Dell', 2000000, 1000000, supId('AB'), now, now);

    // ── Bank Movements (4 entries) ──

    const insertBank = db.prepare('INSERT INTO bank_movements (id, date, description, amount_in, amount_out, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertBank.run(uuidv7(), d(0, 1), 'Virement client ABDO BENTAJ', 5000000, 0, now, now);
    insertBank.run(uuidv7(), d(0, 5), 'Reglement fournisseur AB', 0, 3000000, now, now);
    insertBank.run(uuidv7(), d(0, 15), 'Depot especes', 2000000, 0, now, now);
    insertBank.run(uuidv7(), d(0, 20), 'Frais bancaires mars', 0, 150000, now, now);
  });

  tx();
}

/* ────────────────────────────────────────────────────────────────────────────
 * Backfill seed data for tables added after initial seeding.
 * Each section checks independently so it runs even when purchase_lots exist.
 * ──────────────────────────────────────────────────────────────────────────── */

function seedMissingData(): void {
  const now = new Date().toISOString();
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = (monthOffset: number, day: number): string =>
    new Date(y, m + monthOffset, day).toISOString().slice(0, 10);

  // ── Customer Credits ──
  const custCount = (db.prepare('SELECT COUNT(*) as c FROM customer_credits').get() as { c: number }).c;
  if (custCount === 0) {
    const insertCustCredit = db.prepare('INSERT INTO customer_credits (id, date, customer_name, designation, quantity, unit_price, advance_paid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insertCustCredit.run(uuidv7(), d(0, 8), 'ABDO BENTAJ', 'Laptop HP + RAM upgrade', 1, 10000000, 5000000, now, now);
    insertCustCredit.run(uuidv7(), d(0, 14), 'YASSIN BENTAJ', 'SSD 512GB + Installation', 1, 800000, 300000, now, now);
    console.log('[DB] Backfilled 2 customer credits');
  }

  // ── Supplier Credits ──
  const suppCount = (db.prepare('SELECT COUNT(*) as c FROM supplier_credits').get() as { c: number }).c;
  if (suppCount === 0) {
    const supRow = db.prepare('SELECT id FROM suppliers WHERE code = ? AND deleted_at IS NULL').get('AB') as { id: string } | undefined;
    if (supRow) {
      db.prepare('INSERT INTO supplier_credits (id, date, designation, total_amount, advance_paid, supplier_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv7(), d(0, 1), 'Lot claviers HP + Dell', 2000000, 1000000, supRow.id, now, now);
      console.log('[DB] Backfilled 1 supplier credit');
    }
  }

  // ── Bank Movements ──
  const bankCount = (db.prepare('SELECT COUNT(*) as c FROM bank_movements').get() as { c: number }).c;
  if (bankCount === 0) {
    const insertBank = db.prepare('INSERT INTO bank_movements (id, date, description, amount_in, amount_out, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertBank.run(uuidv7(), d(0, 1), 'Virement client ABDO BENTAJ', 5000000, 0, now, now);
    insertBank.run(uuidv7(), d(0, 5), 'Reglement fournisseur AB', 0, 3000000, now, now);
    insertBank.run(uuidv7(), d(0, 15), 'Depot especes', 2000000, 0, now, now);
    insertBank.run(uuidv7(), d(0, 20), 'Frais bancaires mars', 0, 150000, now, now);
    console.log('[DB] Backfilled 4 bank movements');
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Backfill sync outbox — ensure every existing record has a pending outbox
 * entry so it gets pushed to the server. Idempotent: skips records that
 * already have an outbox entry.
 * ──────────────────────────────────────────────────────────────────────────── */

function backfillOutbox(): void {
  // Map: entityType → { table, payloadColumns (col→jsonKey) }
  const entities: Array<{
    entityType: string;
    table: string;
    cols: Array<{ col: string; key: string }>;
    softDelete?: boolean;
  }> = [
    { entityType: 'purchase_lot', table: 'purchase_lots', cols: [
      { col: 'ref_number', key: 'refNumber' }, { col: 'date', key: 'date' },
      { col: 'designation', key: 'designation' }, { col: 'initial_quantity', key: 'initialQuantity' },
      { col: 'purchase_unit_cost', key: 'purchaseUnitCost' }, { col: 'target_resale_price', key: 'targetResalePrice' },
      { col: 'block_price', key: 'blockPrice' }, { col: 'category_id', key: 'categoryId' },
      { col: 'supplier_id', key: 'supplierId' }, { col: 'boutique_id', key: 'boutiqueId' },
      { col: 'sub_category_id', key: 'subCategoryId' }, { col: 'selling_price', key: 'sellingPrice' },
    ]},
    { entityType: 'sale_order', table: 'sale_orders', cols: [
      { col: 'ref_number', key: 'refNumber' }, { col: 'date', key: 'date' },
      { col: 'observation', key: 'observation' }, { col: 'client_id', key: 'clientId' },
    ]},
    { entityType: 'sale_line', table: 'sale_lines', cols: [
      { col: 'selling_unit_price', key: 'sellingUnitPrice' }, { col: 'quantity', key: 'quantity' },
      { col: 'sale_order_id', key: 'saleOrderId' }, { col: 'lot_id', key: 'lotId' },
    ]},
    { entityType: 'maintenance_job', table: 'maintenance_jobs', cols: [
      { col: 'date', key: 'date' }, { col: 'designation', key: 'designation' },
      { col: 'price', key: 'price' }, { col: 'boutique_id', key: 'boutiqueId' },
    ]},
    { entityType: 'battery_repair_job', table: 'battery_repair_jobs', cols: [
      { col: 'date', key: 'date' }, { col: 'description', key: 'description' },
      { col: 'customer_note', key: 'customerNote' }, { col: 'amount', key: 'amount' },
      { col: 'cost_adjustment', key: 'costAdjustment' },
    ]},
    { entityType: 'expense', table: 'expenses', cols: [
      { col: 'date', key: 'date' }, { col: 'designation', key: 'designation' },
      { col: 'amount', key: 'amount' }, { col: 'boutique_id', key: 'boutiqueId' },
    ]},
    { entityType: 'customer_credit', table: 'customer_credits', cols: [
      { col: 'customer_name', key: 'customerName' }, { col: 'date', key: 'date' },
      { col: 'designation', key: 'designation' }, { col: 'quantity', key: 'quantity' },
      { col: 'unit_price', key: 'unitPrice' }, { col: 'advance_paid', key: 'advancePaid' },
      { col: 'due_date', key: 'dueDate' }, { col: 'sale_order_id', key: 'saleOrderId' },
    ]},
    { entityType: 'supplier_credit', table: 'supplier_credits', cols: [
      { col: 'date', key: 'date' }, { col: 'designation', key: 'designation' },
      { col: 'total_amount', key: 'totalAmount' }, { col: 'advance_paid', key: 'advancePaid' },
      { col: 'supplier_id', key: 'supplierId' },
    ]},
    { entityType: 'bank_movement', table: 'bank_movements', cols: [
      { col: 'date', key: 'date' }, { col: 'description', key: 'description' },
      { col: 'amount_in', key: 'amountIn' }, { col: 'amount_out', key: 'amountOut' },
    ]},
    { entityType: 'employee', table: 'employees', cols: [
      { col: 'name', key: 'name' }, { col: 'monthly_salary', key: 'monthlySalary' },
      { col: 'start_date', key: 'startDate' }, { col: 'is_active', key: 'isActive' },
    ]},
    { entityType: 'salary_payment', table: 'salary_payments', cols: [
      { col: 'date', key: 'date' }, { col: 'amount', key: 'amount' },
      { col: 'note', key: 'note' }, { col: 'employee_id', key: 'employeeId' },
    ]},
    { entityType: 'supplier', table: 'suppliers', cols: [
      { col: 'code', key: 'code' },
    ]},
    { entityType: 'boutique', table: 'boutiques', cols: [
      { col: 'name', key: 'name' },
    ]},
    { entityType: 'category', table: 'categories', cols: [
      { col: 'name', key: 'name' },
    ]},
    { entityType: 'sub_category', table: 'sub_categories', cols: [
      { col: 'name', key: 'name' }, { col: 'category_id', key: 'categoryId' },
    ]},
    { entityType: 'client', table: 'clients', cols: [
      { col: 'name', key: 'name' }, { col: 'phone', key: 'phone' },
    ]},
    { entityType: 'battery_tariff', table: 'battery_tariffs', cols: [
      { col: 'label', key: 'label' }, { col: 'particuliers_price', key: 'particuliersPrice' },
      { col: 'rev_price', key: 'revPrice' },
    ]},
    { entityType: 'customer_credit_payment', table: 'customer_credit_payments', cols: [
      { col: 'date', key: 'date' }, { col: 'amount', key: 'amount' },
      { col: 'customer_credit_id', key: 'customerCreditId' },
    ]},
    { entityType: 'supplier_credit_payment', table: 'supplier_credit_payments', cols: [
      { col: 'date', key: 'date' }, { col: 'amount', key: 'amount' },
      { col: 'supplier_credit_id', key: 'supplierCreditId' },
    ]},
    { entityType: 'zakat_advance', table: 'zakat_advances', cols: [
      { col: 'date', key: 'date' }, { col: 'amount', key: 'amount' },
      { col: 'year', key: 'year' }, { col: 'note', key: 'note' },
    ]},
  ];

  const insertOutbox = db.prepare(
    `INSERT INTO sync_outbox (id, entity_type, entity_id, operation, payload, version) VALUES (?, ?, ?, 'CREATE', ?, 1)`
  );

  let totalBackfilled = 0;

  const tx = db.transaction(() => {
    for (const ent of entities) {
      const rows = db.prepare(`
        SELECT t.* FROM ${ent.table} t
        LEFT JOIN sync_outbox o ON o.entity_id = t.id AND o.entity_type = ? AND o.operation = 'CREATE'
        WHERE o.id IS NULL AND t.deleted_at IS NULL AND t.origin_desktop_id IS NULL
      `).all(ent.entityType) as Array<Record<string, unknown>>;

      for (const row of rows) {
        const payload: Record<string, unknown> = { id: row['id'] };
        for (const c of ent.cols) {
          payload[c.key] = row[c.col] ?? null;
        }
        insertOutbox.run(uuidv7(), ent.entityType, row['id'] as string, JSON.stringify(payload));
        totalBackfilled++;
      }
    }
  });

  tx();

  if (totalBackfilled > 0) {
    console.log(`[DB] Backfilled ${totalBackfilled} outbox entries for sync`);
  }
}
