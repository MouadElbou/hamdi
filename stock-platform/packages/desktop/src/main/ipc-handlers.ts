/**
 * IPC handlers — bridge between renderer process and main process.
 * All database operations go through here.
 */

import { ipcMain } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import bcrypt from 'bcryptjs';
import { getDatabase } from './database.js';
import { addToOutbox, SyncManager } from './sync-manager.js';

let currentSession: { userId: string; username: string; role: string; permissions: string[] } | null = null;

export function clearSession(): void {
  currentSession = null;
}

export function getCurrentSession() {
  return currentSession;
}

// ─── Login rate limiting ───────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 60_000; // 1 minute lockout
const MAX_REF_DATA_LENGTH = 100;

// Periodic cleanup of stale login attempt entries
setInterval(() => {
  const cutoff = Date.now() - LOGIN_LOCKOUT_MS * 2;
  for (const [username, attempt] of loginAttempts) {
    if (attempt.lastAttempt < cutoff) loginAttempts.delete(username);
  }
}, 120_000);

const ALL_PAGES = [
  'dashboard', 'purchases', 'stock', 'sales', 'customer-orders', 'maintenance',
  'battery-repair', 'expenses', 'credits', 'bank', 'monthly-summary', 'zakat',
];

// ─── Validation helpers ────────────────────────────────────────────

function validateAmount(value: unknown, field: string): void {
  if (typeof value !== 'number' || !isFinite(value) || value < 0) {
    throw new Error(`${field} doit être un nombre positif ou zéro`);
  }
}

function validatePositive(value: unknown, field: string): void {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) {
    throw new Error(`${field} doit être un nombre strictement positif`);
  }
}

function validateDate(value: unknown, field: string): void {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} doit être au format AAAA-MM-JJ`);
  }
  // Round-trip check: ensure the date is actually valid (rejects 2025-99-99 etc.)
  const d = new Date(value + 'T00:00:00Z');
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} n'est pas une date valide`);
  }
}

function validateString(value: unknown, field: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} est requis`);
  }
}

function validateStringLength(value: string, field: string, max: number = MAX_REF_DATA_LENGTH): void {
  if (value.length > max) {
    throw new Error(`${field} trop long (max ${max} caractères)`);
  }
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

function validatePassword(pwd: string): void {
  if (pwd.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères');
  if (!/[A-Z]/.test(pwd)) throw new Error('Le mot de passe doit contenir au moins une majuscule');
  if (!/[a-z]/.test(pwd)) throw new Error('Le mot de passe doit contenir au moins une minuscule');
  if (!/[0-9]/.test(pwd)) throw new Error('Le mot de passe doit contenir au moins un chiffre');
}

// ─── Channel → permission mapping ──────────────────────────────────

const CHANNEL_PERMISSION_MAP: Record<string, string> = {
  'purchases': 'purchases',
  'stock': 'stock',
  'sales': 'sales',
  'customer-orders': 'customer-orders',
  'maintenance': 'maintenance',
  'battery-repair': 'battery-repair',
  'battery-tariffs': 'battery-repair',
  'expenses': 'expenses',
  'employees': 'expenses',
  'salary-payments': 'expenses',
  'customer-credits': 'credits',
  'supplier-credits': 'credits',
  'bank-movements': 'bank',
  'monthly-summary': 'monthly-summary',
  'zakat': 'zakat',
  'dashboard': 'dashboard',
  'clients': 'credits',
  'maintenance-types': 'maintenance',
  'expense-designations': 'expenses',
  'categories': 'purchases',
  'sub-categories': 'purchases',
  'suppliers': 'purchases',
  'boutiques': 'purchases',
};

// ─── Safe IPC wrappers ─────────────────────────────────────────────

/** Wrap handler in try-catch with logging + auth check + permission enforcement */
function safeHandle(
  channel: string,
  handler: (...args: unknown[]) => unknown,
  opts?: { requireAdmin?: boolean; skipAuth?: boolean },
): void {
  ipcMain.handle(channel, async (...args: unknown[]) => {
    try {
      if (!opts?.skipAuth && !currentSession) {
        throw new Error('Non authentifié');
      }
      if (opts?.requireAdmin && currentSession?.role !== 'admin') {
        throw new Error('Accès réservé aux administrateurs');
      }
      // Page-level permission enforcement (admins bypass)
      if (!opts?.skipAuth && !opts?.requireAdmin && currentSession && currentSession.role !== 'admin') {
        const requiredPerm = CHANNEL_PERMISSION_MAP[channel.split(':')[0]];
        if (requiredPerm && !currentSession.permissions.includes(requiredPerm)) {
          throw new Error('Accès non autorisé à cette fonctionnalité');
        }
      }
      return await Promise.resolve(handler(...args));
    } catch (err) {
      console.error(`[${channel}] Error:`, (err as Error).message);
      throw err;
    }
  });
}

export function registerIpcHandlers(syncManager?: SyncManager | null): void {
  const db = getDatabase();

  // ─── Sync channels (no auth needed — sync runs regardless of login) ──

  safeHandle('sync:status', () => {
    return syncManager?.getStatus() ?? { connected: false, pendingOps: 0, lastSync: null };
  }, { skipAuth: true });

  safeHandle('sync:trigger', async () => {
    await syncManager?.syncNow();
    return syncManager?.getStatus();
  }, { skipAuth: true });

  // ─── Sync Conflict Management ─────────────────────────────────────

  safeHandle('sync:list-conflicts', () => {
    return db.prepare(
      `SELECT id, entity_type, entity_id, operation, payload, version, created_at, status
       FROM sync_outbox
       WHERE status IN ('conflict', 'rejected')
       ORDER BY created_at DESC`
    ).all();
  }, { skipAuth: true });

  safeHandle('sync:dismiss-conflict', (...args: unknown[]) => {
    const outboxId = args[1] as string;
    const result = db.prepare(
      `UPDATE sync_outbox SET status = 'dismissed' WHERE id = ? AND status IN ('conflict', 'rejected')`
    ).run(outboxId);
    return { dismissed: result.changes > 0 };
  }, { skipAuth: true });

  safeHandle('sync:retry-conflict', async (...args: unknown[]) => {
    const outboxId = args[1] as string;
    // Re-read the current entity state and create a fresh outbox entry
    const row = db.prepare(
      `SELECT entity_type, entity_id, operation, payload FROM sync_outbox WHERE id = ? AND status IN ('conflict', 'rejected')`
    ).get(outboxId) as { entity_type: string; entity_id: string; operation: string; payload: string } | undefined;
    if (!row) return { retried: false, reason: 'not_found' };

    // Mark old entry as dismissed
    db.prepare(`UPDATE sync_outbox SET status = 'dismissed' WHERE id = ?`).run(outboxId);

    // Re-enqueue the operation with the current entity version
    const payload = JSON.parse(row.payload);
    addToOutbox(db, row.entity_type, row.entity_id, row.operation as 'CREATE' | 'UPDATE' | 'DELETE', payload);

    // Trigger immediate sync attempt
    await syncManager?.syncNow();
    return { retried: true };
  }, { skipAuth: true });

  // ─── Master Data ─────────────────────────────────────────────────

  safeHandle('suppliers:list', () => {
    return db.prepare('SELECT * FROM suppliers WHERE deleted_at IS NULL ORDER BY code').all();
  });

  safeHandle('boutiques:list', () => {
    return db.prepare('SELECT * FROM boutiques WHERE deleted_at IS NULL ORDER BY name').all();
  });

  safeHandle('categories:list', () => {
    return db.prepare('SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY name').all();
  });

  // ─── Reference Data Create (upsert pattern) ──────────────────────

  safeHandle('suppliers:create', (_event, data: { code: string }) => {
    const trimmed = data.code.trim();
    if (!trimmed) throw new Error('Supplier code is required');
    validateStringLength(trimmed, 'Code fournisseur');
    return db.transaction(() => {
      const existing = db.prepare('SELECT * FROM suppliers WHERE code = ? AND deleted_at IS NULL').get(trimmed) as Record<string, unknown> | undefined;
      if (existing) return existing;
      const id = uuidv7();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO suppliers (id, code, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, trimmed, now, now);
      addToOutbox(db, 'supplier', id, 'CREATE', { id, code: trimmed });
      return { id, code: trimmed };
    })();
  });

  safeHandle('boutiques:create', (_event, data: { name: string }) => {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error('Boutique name is required');
    validateStringLength(trimmed, 'Nom boutique');
    return db.transaction(() => {
      const existing = db.prepare('SELECT * FROM boutiques WHERE name = ? AND deleted_at IS NULL').get(trimmed) as Record<string, unknown> | undefined;
      if (existing) return existing;
      const id = uuidv7();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO boutiques (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, trimmed, now, now);
      addToOutbox(db, 'boutique', id, 'CREATE', { id, name: trimmed });
      return { id, name: trimmed };
    })();
  });

  safeHandle('categories:create', (_event, data: { name: string }) => {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error('Category name is required');
    validateStringLength(trimmed, 'Nom catégorie');
    return db.transaction(() => {
      const existing = db.prepare('SELECT * FROM categories WHERE name = ? AND deleted_at IS NULL').get(trimmed) as Record<string, unknown> | undefined;
      if (existing) return existing;
      const id = uuidv7();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, trimmed, now, now);
      addToOutbox(db, 'category', id, 'CREATE', { id, name: trimmed });
      return { id, name: trimmed };
    })();
  });

  // ─── Sub-Categories ──────────────────────────────────────────────

  safeHandle('sub-categories:list', (_event, params?: { categoryId?: string }) => {
    if (params?.categoryId) {
      return db.prepare('SELECT * FROM sub_categories WHERE category_id = ? AND deleted_at IS NULL ORDER BY name').all(params.categoryId);
    }
    return db.prepare('SELECT * FROM sub_categories WHERE deleted_at IS NULL ORDER BY name').all();
  });

  safeHandle('sub-categories:create', (_event, data: { name: string; categoryId: string }) => {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error('Sub-category name is required');
    if (!data.categoryId) throw new Error('Category is required');
    validateStringLength(trimmed, 'Nom sous-catégorie');
    return db.transaction(() => {
      const existing = db.prepare('SELECT * FROM sub_categories WHERE name = ? AND category_id = ? AND deleted_at IS NULL').get(trimmed, data.categoryId) as Record<string, unknown> | undefined;
      if (existing) return existing;
      const id = uuidv7();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO sub_categories (id, name, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, trimmed, data.categoryId, now, now);
      addToOutbox(db, 'sub_category', id, 'CREATE', { id, name: trimmed, categoryId: data.categoryId });
      return { id, name: trimmed, category_id: data.categoryId };
    })();
  });

  // ─── Maintenance Service Types ───────────────────────────────────

  safeHandle('maintenance-types:list', () => {
    return db.prepare('SELECT * FROM maintenance_service_types WHERE deleted_at IS NULL ORDER BY name').all();
  });

  safeHandle('maintenance-types:create', (_event, data: { name: string }) => {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error('Service type name is required');
    validateStringLength(trimmed, 'Type de service');
    return db.transaction(() => {
      const existing = db.prepare('SELECT * FROM maintenance_service_types WHERE name = ? AND deleted_at IS NULL').get(trimmed) as Record<string, unknown> | undefined;
      if (existing) return existing;
      const id = uuidv7();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO maintenance_service_types (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, trimmed, now, now);
      addToOutbox(db, 'maintenance_service_type', id, 'CREATE', { id, name: trimmed });
      return { id, name: trimmed };
    })();
  });

  // ─── Expense Designations ────────────────────────────────────────

  safeHandle('expense-designations:list', () => {
    return db.prepare('SELECT * FROM expense_designations WHERE deleted_at IS NULL ORDER BY name').all();
  });

  safeHandle('expense-designations:create', (_event, data: { name: string }) => {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error('Expense designation name is required');
    validateStringLength(trimmed, 'Désignation de dépense');
    return db.transaction(() => {
      const existing = db.prepare('SELECT * FROM expense_designations WHERE name = ? AND deleted_at IS NULL').get(trimmed) as Record<string, unknown> | undefined;
      if (existing) return existing;
      const id = uuidv7();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO expense_designations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, trimmed, now, now);
      addToOutbox(db, 'expense_designation', id, 'CREATE', { id, name: trimmed });
      return { id, name: trimmed };
    })();
  });

  // ─── Battery Tariff CRUD ─────────────────────────────────────────

  safeHandle('battery-tariffs:create', (_event, data: { label: string; particuliersPrice: number | null; revPrice: number | null }) => {
    const trimmed = data.label.trim();
    if (!trimmed) throw new Error('Tariff label is required');
    if (data.particuliersPrice != null) validateAmount(data.particuliersPrice, 'Prix particuliers');
    if (data.revPrice != null) validateAmount(data.revPrice, 'Prix revendeur');
    const id = uuidv7();
    const now = new Date().toISOString();
    return db.transaction(() => {
      db.prepare('INSERT INTO battery_tariffs (id, label, particuliers_price, rev_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, trimmed, data.particuliersPrice, data.revPrice, now, now);
      addToOutbox(db, 'battery_tariff', id, 'CREATE', {
        id, label: trimmed, particuliersPrice: data.particuliersPrice,
        revPrice: data.revPrice,
      });
      return { id, label: trimmed, particuliers_price: data.particuliersPrice, rev_price: data.revPrice };
    })();
  });

  safeHandle('battery-tariffs:update', (_event, data: { id: string; label: string; particuliersPrice: number | null; revPrice: number | null }) => {
    if (data.particuliersPrice != null) validateAmount(data.particuliersPrice, 'Prix particuliers');
    if (data.revPrice != null) validateAmount(data.revPrice, 'Prix revendeur');
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE battery_tariffs SET label=?, particuliers_price=?, rev_price=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(data.label.trim(), data.particuliersPrice, data.revPrice, now, data.id);
      if (result.changes === 0) throw new Error(`Battery tariff ${data.id} not found`);
      addToOutbox(db, 'battery_tariff', data.id, 'UPDATE', {
        id: data.id, label: data.label.trim(),
        particuliersPrice: data.particuliersPrice,
        revPrice: data.revPrice,
      });
      return { success: true };
    })();
  });

  safeHandle('battery-tariffs:delete', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE battery_tariffs SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Battery tariff ${id} not found`);
      addToOutbox(db, 'battery_tariff', id, 'DELETE', { id });
      return { success: true };
    })();
  });

  // ─── Clients ─────────────────────────────────────────────────────

  safeHandle('clients:list', () => {
    return db.prepare('SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY name').all();
  });

  safeHandle('clients:create', (_event, data: { name: string; phone?: string }) => {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error('Le nom du client est requis');
    validateStringLength(trimmed, 'Nom client', 200);
    if (data.phone) validateStringLength(data.phone, 'Téléphone', 30);
    return db.transaction(() => {
      const existing = db.prepare('SELECT * FROM clients WHERE name = ? AND deleted_at IS NULL').get(trimmed) as Record<string, unknown> | undefined;
      if (existing) return existing;
      const id = uuidv7();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO clients (id, name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, trimmed, data.phone ?? null, now, now);
      addToOutbox(db, 'client', id, 'CREATE', { id, name: trimmed, phone: data.phone ?? null });
      return { id, name: trimmed, phone: data.phone ?? null };
    })();
  });

  safeHandle('clients:search', (_event, query: string) => {
    const escaped = query.replace(/[%_\\]/g, '\\$&');
    return db.prepare("SELECT * FROM clients WHERE name LIKE ? ESCAPE '\\' AND deleted_at IS NULL ORDER BY name LIMIT 20").all(`%${escaped}%`);
  });

  // ─── Employees ───────────────────────────────────────────────────

  safeHandle('employees:list', () => {
    return db.prepare('SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY name').all();
  });

  safeHandle('employees:create', (_event, data: { name: string; monthlySalary: number; startDate: string }) => {
    validateString(data.name, 'Nom');
    validatePositive(data.monthlySalary, 'Salaire mensuel');
    validateDate(data.startDate, 'Date de début');
    const id = uuidv7();
    const now = new Date().toISOString();
    return db.transaction(() => {
      db.prepare('INSERT INTO employees (id, name, monthly_salary, start_date, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').run(id, data.name.trim(), data.monthlySalary, data.startDate, now, now);
      addToOutbox(db, 'employee', id, 'CREATE', {
        id, name: data.name.trim(), monthlySalary: data.monthlySalary,
        startDate: data.startDate, isActive: true,
      });
      return { id };
    })();
  });

  safeHandle('employees:update', (_event, data: { id: string; name: string; monthlySalary: number; startDate: string; isActive: boolean }) => {
    validateString(data.name, 'Nom');
    validatePositive(data.monthlySalary, 'Salaire mensuel');
    validateDate(data.startDate, 'Date de début');
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE employees SET name=?, monthly_salary=?, start_date=?, is_active=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(data.name.trim(), data.monthlySalary, data.startDate, data.isActive ? 1 : 0, now, data.id);
      if (result.changes === 0) throw new Error(`Employee ${data.id} not found`);
      addToOutbox(db, 'employee', data.id, 'UPDATE', {
        id: data.id, name: data.name.trim(), monthlySalary: data.monthlySalary,
        startDate: data.startDate, isActive: data.isActive,
      });
      return { success: true };
    })();
  });

  safeHandle('employees:delete', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE employees SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Employee ${id} not found`);
      addToOutbox(db, 'employee', id, 'DELETE', { id });
      return { success: true };
    })();
  });

  // ─── Salary Payments ─────────────────────────────────────────────

  safeHandle('salary-payments:list', (_event, params?: { month?: number; year?: number }) => {
    let sql = `
      SELECT sp.*, e.name as employee_name, e.monthly_salary
      FROM salary_payments sp
      JOIN employees e ON sp.employee_id = e.id
      WHERE sp.deleted_at IS NULL
    `;
    const bindings: unknown[] = [];
    if (params?.month && params?.year) {
      if (!Number.isInteger(params.year) || params.year < 2000 || params.year > 2100) throw new Error('Année invalide');
      if (!Number.isInteger(params.month) || params.month < 1 || params.month > 12) throw new Error('Mois invalide');
      const ms = String(params.month).padStart(2, '0');
      const lastDay = new Date(params.year, params.month, 0).getDate();
      sql += ' AND sp.date >= ? AND sp.date <= ?';
      bindings.push(`${params.year}-${ms}-01`, `${params.year}-${ms}-${String(lastDay).padStart(2, '0')}`);
    }
    sql += ' ORDER BY sp.date DESC';
    return db.prepare(sql).all(...bindings);
  });

  safeHandle('salary-payments:create', (_event, data: { employeeId: string; date: string; amount: number; note?: string }) => {
    validateDate(data.date, 'Date');
    validatePositive(data.amount, 'Montant');
    const id = uuidv7();
    const now = new Date().toISOString();
    return db.transaction(() => {
      const emp = db.prepare('SELECT id, monthly_salary FROM employees WHERE id = ? AND deleted_at IS NULL').get(data.employeeId) as { id: string; monthly_salary: number } | undefined;
      if (!emp) throw new Error('Employé introuvable');
      const monthPrefix = data.date.substring(0, 7); // YYYY-MM
      const paid = db.prepare(
        'SELECT COALESCE(SUM(amount), 0) as total FROM salary_payments WHERE employee_id = ? AND date >= ? AND date <= ? AND deleted_at IS NULL'
      ).get(data.employeeId, `${monthPrefix}-01`, `${monthPrefix}-31`) as { total: number };
      if (paid.total + data.amount > emp.monthly_salary) {
        throw new Error(`Le total des paiements pour ce mois (${paid.total + data.amount}) dépasse le salaire mensuel (${emp.monthly_salary})`);
      }
      db.prepare('INSERT INTO salary_payments (id, date, amount, note, employee_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, data.date, data.amount, data.note ?? null, data.employeeId, now, now);
      addToOutbox(db, 'salary_payment', id, 'CREATE', {
        id, date: data.date, amount: data.amount,
        note: data.note ?? null, employeeId: data.employeeId,
      });
      return { id };
    })();
  });

  safeHandle('salary-payments:delete', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE salary_payments SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Salary payment ${id} not found`);
      addToOutbox(db, 'salary_payment', id, 'DELETE', { id });
      return { success: true };
    })();
  });

  // ─── Purchases ───────────────────────────────────────────────────

  safeHandle('purchases:list', (_event, params: { page?: number; limit?: number; search?: string; category?: string; supplier?: string; boutique?: string; subCategory?: string }) => {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(1, params.limit ?? 20), 200);
    const offset = (page - 1) * limit;

    let whereClauses = 'pl.deleted_at IS NULL';
    const bindings: unknown[] = [];

    if (params.category) { whereClauses += ' AND c.name = ?'; bindings.push(params.category); }
    if (params.subCategory) { whereClauses += ' AND sc.name = ?'; bindings.push(params.subCategory); }
    if (params.supplier) { whereClauses += ' AND s.code = ?'; bindings.push(params.supplier); }
    if (params.boutique) { whereClauses += ' AND b.name = ?'; bindings.push(params.boutique); }
    if (params.search) {
      whereClauses += ` AND (pl.id LIKE ? ESCAPE '\\' OR pl.designation LIKE ? ESCAPE '\\' OR pl.ref_number LIKE ? ESCAPE '\\' OR pl.date LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR s.code LIKE ? ESCAPE '\\' OR b.name LIKE ? ESCAPE '\\' OR CAST(pl.purchase_unit_cost AS TEXT) LIKE ? ESCAPE '\\' OR CAST(pl.initial_quantity AS TEXT) LIKE ? ESCAPE '\\' OR pl.barcode LIKE ? ESCAPE '\\')`;
      const s = `%${escapeLike(params.search)}%`;
      bindings.push(s, s, s, s, s, s, s, s, s, s);
    }

    const total = (db.prepare(`
      SELECT COUNT(*) as total FROM purchase_lots pl
      LEFT JOIN categories c ON pl.category_id = c.id
      LEFT JOIN sub_categories sc ON pl.sub_category_id = sc.id
      LEFT JOIN suppliers s ON pl.supplier_id = s.id
      LEFT JOIN boutiques b ON pl.boutique_id = b.id
      WHERE ${whereClauses}
    `).get(...bindings) as { total: number }).total;

    const items = db.prepare(`
      SELECT pl.*, COALESCE(c.name, '[Supprimé]') as category_name, COALESCE(s.code, '[Supprimé]') as supplier_code, COALESCE(b.name, '[Supprimé]') as boutique_name, sc.name as sub_category_name
      FROM purchase_lots pl
      LEFT JOIN categories c ON pl.category_id = c.id
      LEFT JOIN sub_categories sc ON pl.sub_category_id = sc.id
      LEFT JOIN suppliers s ON pl.supplier_id = s.id
      LEFT JOIN boutiques b ON pl.boutique_id = b.id
      WHERE ${whereClauses}
      ORDER BY pl.date DESC LIMIT ? OFFSET ?
    `).all(...bindings, limit, offset);

    return { items, total, page, limit };
  });

  safeHandle('purchases:create', (_event, data: {
    date: string; category: string; designation: string; supplier?: string;
    boutique: string; initialQuantity: number; purchaseUnitCost: number;
    targetResalePrice: number | null; blockPrice: number | null;
    sellingPrice: number | null; subCategory: string | null;
    barcode?: string;
  }) => {
    validateDate(data.date, 'Date');
    validateString(data.category, 'Catégorie');
    validateString(data.designation, 'Désignation');
    if (data.supplier) validateString(data.supplier, 'Fournisseur');
    validateString(data.boutique, 'Boutique');
    validatePositive(data.initialQuantity, 'Quantité');
    if (data.purchaseUnitCost > 0) validatePositive(data.purchaseUnitCost, 'Coût unitaire');
    if (data.targetResalePrice != null) validatePositive(data.targetResalePrice, 'Prix de revente');
    if (data.blockPrice != null) validatePositive(data.blockPrice, 'Prix bloc');
    if (data.sellingPrice != null) validatePositive(data.sellingPrice, 'Prix de vente');
    const id = uuidv7();
    const refNumber = `PUR-${Date.now()}`;
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      let category = db.prepare('SELECT id FROM categories WHERE name = ? AND deleted_at IS NULL').get(data.category) as { id: string } | undefined;
      let supplier = data.supplier ? db.prepare('SELECT id FROM suppliers WHERE code = ? AND deleted_at IS NULL').get(data.supplier) as { id: string } | undefined : undefined;
      let boutique = db.prepare('SELECT id FROM boutiques WHERE name = ? AND deleted_at IS NULL').get(data.boutique) as { id: string } | undefined;

      // Auto-create category if not found
      if (!category) {
        const catId = uuidv7();
        db.prepare('INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(catId, data.category.trim(), now, now);
        addToOutbox(db, 'category', catId, 'CREATE', { id: catId, name: data.category.trim() });
        category = { id: catId };
      }
      // Auto-create supplier if not found
      if (data.supplier && data.supplier.trim()) {
        if (!supplier) {
          const supId = uuidv7();
          db.prepare('INSERT INTO suppliers (id, code, created_at, updated_at) VALUES (?, ?, ?, ?)').run(supId, data.supplier.trim(), now, now);
          addToOutbox(db, 'supplier', supId, 'CREATE', { id: supId, code: data.supplier.trim() });
          supplier = { id: supId };
        }
      } else {
        // Default placeholder supplier for non-admin submissions
        supplier = db.prepare("SELECT id FROM suppliers WHERE code = '—' AND deleted_at IS NULL").get() as { id: string } | undefined;
        if (!supplier) {
          const supId = uuidv7();
          db.prepare("INSERT INTO suppliers (id, code, created_at, updated_at) VALUES (?, '—', ?, ?)").run(supId, now, now);
          addToOutbox(db, 'supplier', supId, 'CREATE', { id: supId, code: '—' });
          supplier = { id: supId };
        }
      }
      // Auto-create boutique if not found
      if (!boutique) {
        const boutId = uuidv7();
        db.prepare('INSERT INTO boutiques (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(boutId, data.boutique.trim(), now, now);
        addToOutbox(db, 'boutique', boutId, 'CREATE', { id: boutId, name: data.boutique.trim() });
        boutique = { id: boutId };
      }

      // Resolve sub-category
      let subCategoryId: string | null = null;
      if (data.subCategory && data.subCategory.trim()) {
        const trimmedSub = data.subCategory.trim();
        let subCat = db.prepare('SELECT id FROM sub_categories WHERE name = ? AND category_id = ? AND deleted_at IS NULL').get(trimmedSub, category.id) as { id: string } | undefined;
        if (!subCat) {
          subCategoryId = uuidv7();
          db.prepare('INSERT INTO sub_categories (id, name, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(subCategoryId, trimmedSub, category.id, now, now);
          addToOutbox(db, 'sub_category', subCategoryId, 'CREATE', { id: subCategoryId, name: trimmedSub, categoryId: category.id });
        } else {
          subCategoryId = subCat.id;
        }
      }

      db.prepare(`
        INSERT INTO purchase_lots (id, ref_number, date, designation, initial_quantity, purchase_unit_cost, target_resale_price, block_price, selling_price, category_id, supplier_id, boutique_id, sub_category_id, barcode, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, refNumber, data.date, data.designation.trim(), data.initialQuantity, data.purchaseUnitCost, data.targetResalePrice, data.blockPrice ?? null, data.sellingPrice ?? null, category.id, supplier.id, boutique.id, subCategoryId, data.barcode?.trim() || null, now, now);

      addToOutbox(db, 'purchase_lot', id, 'CREATE', {
        id, refNumber, date: data.date, designation: data.designation.trim(),
        initialQuantity: data.initialQuantity, purchaseUnitCost: data.purchaseUnitCost,
        targetResalePrice: data.targetResalePrice, blockPrice: data.blockPrice ?? null,
        sellingPrice: data.sellingPrice ?? null,
        categoryId: category.id, supplierId: supplier.id, boutiqueId: boutique.id,
        subCategoryId,
        barcode: data.barcode?.trim() || null,
      });
    });
    transaction();

    return { id, refNumber };
  });

  // ─── Stock ───────────────────────────────────────────────────────

  safeHandle('stock:list', (_event, params: { inStockOnly?: boolean; search?: string; category?: string; page?: number; limit?: number }) => {
    const limit = Math.min(Math.max(1, params.limit ?? 20), 5000);
    const page = Math.max(1, params.page ?? 1);
    const offset = (page - 1) * limit;

    let whereClauses = 'pl.deleted_at IS NULL';
    const bindings: unknown[] = [];

    if (params.category) { whereClauses += ' AND c.name = ?'; bindings.push(params.category); }
    if (params.search) {
      whereClauses += ` AND (pl.id LIKE ? ESCAPE '\\' OR pl.designation LIKE ? ESCAPE '\\' OR pl.ref_number LIKE ? ESCAPE '\\' OR pl.date LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR s.code LIKE ? ESCAPE '\\' OR b.name LIKE ? ESCAPE '\\' OR CAST(pl.purchase_unit_cost AS TEXT) LIKE ? ESCAPE '\\' OR CAST(pl.initial_quantity AS TEXT) LIKE ? ESCAPE '\\' OR pl.barcode LIKE ? ESCAPE '\\')`;
      const s = `%${escapeLike(params.search)}%`;
      bindings.push(s, s, s, s, s, s, s, s, s, s);
    }
    if (params.inStockOnly) {
      whereClauses += ' AND (pl.initial_quantity - COALESCE((SELECT SUM(sl2.quantity) FROM sale_lines sl2 WHERE sl2.lot_id = pl.id AND sl2.deleted_at IS NULL), 0) + COALESCE((SELECT SUM(srl2.quantity) FROM sale_return_lines srl2 WHERE srl2.lot_id = pl.id AND srl2.deleted_at IS NULL), 0)) > 0';
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM purchase_lots pl
      LEFT JOIN categories c ON pl.category_id = c.id
      LEFT JOIN suppliers s ON pl.supplier_id = s.id
      LEFT JOIN boutiques b ON pl.boutique_id = b.id
      LEFT JOIN sub_categories sc ON pl.sub_category_id = sc.id
      WHERE ${whereClauses}
    `).get(...bindings) as { total: number };

    const lots = db.prepare(`
      SELECT pl.*, COALESCE(c.name, '[Supprimé]') as category_name, COALESCE(s.code, '[Supprimé]') as supplier_code, COALESCE(b.name, '[Supprimé]') as boutique_name,
        sc.name as sub_category_name,
        COALESCE((SELECT SUM(sl.quantity) FROM sale_lines sl WHERE sl.lot_id = pl.id AND sl.deleted_at IS NULL), 0)
        - COALESCE((SELECT SUM(srl.quantity) FROM sale_return_lines srl WHERE srl.lot_id = pl.id AND srl.deleted_at IS NULL), 0) as sold_quantity
      FROM purchase_lots pl
      LEFT JOIN categories c ON pl.category_id = c.id
      LEFT JOIN suppliers s ON pl.supplier_id = s.id
      LEFT JOIN boutiques b ON pl.boutique_id = b.id
      LEFT JOIN sub_categories sc ON pl.sub_category_id = sc.id
      WHERE ${whereClauses}
      ORDER BY pl.date DESC
      LIMIT ? OFFSET ?
    `).all(...bindings, limit, offset) as Array<Record<string, unknown>>;

    const items = lots.map((lot) => {
      const soldQty = lot['sold_quantity'] as number;
      const initial = lot['initial_quantity'] as number;
      const cost = lot['purchase_unit_cost'] as number;
      const remaining = initial - soldQty;
      return {
        lotId: lot['id'],
        refNumber: lot['ref_number'],
        date: lot['date'],
        category: lot['category_name'],
        designation: lot['designation'],
        supplier: lot['supplier_code'],
        boutique: lot['boutique_name'],
        initialQuantity: initial,
        soldQuantity: soldQty,
        remainingQuantity: remaining,
        purchaseUnitCost: cost,
        targetResalePrice: lot['target_resale_price'],
        sellingPrice: lot['selling_price'] as number | null,
        subCategory: (lot['sub_category_name'] as string | null) || null,
        barcode: (lot['barcode'] as string | null) || null,
        currentStockValue: remaining * cost,
      };
    });

    return { items, total: countResult.total, page, limit };
  });

  safeHandle('stock:lookup-barcode', (_event, params: { barcode: string }) => {
    if (!params.barcode || !params.barcode.trim()) return null;
    const barcode = params.barcode.trim();
    const lot = db.prepare(`
      SELECT pl.id, pl.designation, pl.selling_price, pl.purchase_unit_cost, pl.target_resale_price, pl.barcode,
        COALESCE(c.name, '[Supprimé]') as category_name,
        pl.initial_quantity - COALESCE((SELECT SUM(sl.quantity) FROM sale_lines sl WHERE sl.lot_id = pl.id AND sl.deleted_at IS NULL), 0) + COALESCE((SELECT SUM(srl.quantity) FROM sale_return_lines srl WHERE srl.lot_id = pl.id AND srl.deleted_at IS NULL), 0) as remaining_quantity
      FROM purchase_lots pl
      LEFT JOIN categories c ON pl.category_id = c.id
      WHERE pl.barcode = ? AND pl.deleted_at IS NULL
        AND (pl.initial_quantity - COALESCE((SELECT SUM(sl2.quantity) FROM sale_lines sl2 WHERE sl2.lot_id = pl.id AND sl2.deleted_at IS NULL), 0) + COALESCE((SELECT SUM(srl2.quantity) FROM sale_return_lines srl2 WHERE srl2.lot_id = pl.id AND srl2.deleted_at IS NULL), 0)) > 0
      ORDER BY pl.date ASC
      LIMIT 1
    `).get(barcode) as Record<string, unknown> | undefined;
    if (!lot) return null;
    return {
      lotId: lot['id'] as string,
      designation: lot['designation'] as string,
      category: lot['category_name'] as string,
      remainingQuantity: lot['remaining_quantity'] as number,
      sellingPrice: lot['selling_price'] as number | null,
      purchaseUnitCost: lot['purchase_unit_cost'] as number,
      targetResalePrice: lot['target_resale_price'] as number | null,
      barcode: lot['barcode'] as string,
    };
  });

  // ─── Sales ───────────────────────────────────────────────────────

  safeHandle('sales:create', (_event, data: {
    date: string; observation?: string; clientName?: string;
    lines: Array<{ lotId: string; quantity: number; sellingUnitPrice: number }>;
    paymentType?: 'comptant' | 'credit';
    advancePaid?: number;
    dueDate?: string;
  }) => {
    validateDate(data.date, 'Date');
    if (!data.lines || data.lines.length === 0) throw new Error('Au moins une ligne est requise');
    if (data.lines.length > 200) throw new Error('Maximum 200 lignes par vente');
    for (const line of data.lines) {
      validatePositive(line.quantity, 'Quantité');
      validatePositive(line.sellingUnitPrice, 'Prix de vente');
    }
    if (data.paymentType === 'credit' && (!data.clientName || !data.clientName.trim())) {
      throw new Error('Le nom du client est requis pour une vente à crédit');
    }
    if (data.dueDate) validateDate(data.dueDate, 'Date d\'échéance');
    if (data.advancePaid != null && data.advancePaid !== 0) validateAmount(data.advancePaid, 'Avance versée');
    const saleId = uuidv7();
    const refNumber = `SAL-${Date.now()}`;
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      // Resolve or auto-create client
      let clientId: string | null = null;
      if (data.clientName && data.clientName.trim()) {
        const trimmed = data.clientName.trim();
        let client = db.prepare('SELECT id FROM clients WHERE name = ? AND deleted_at IS NULL').get(trimmed) as { id: string } | undefined;
        if (!client) {
          clientId = uuidv7();
          db.prepare('INSERT INTO clients (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(clientId, trimmed, now, now);
          addToOutbox(db, 'client', clientId, 'CREATE', { id: clientId, name: trimmed });
        } else {
          clientId = client.id;
        }
      }

      // Verify stock availability for each line
      for (const line of data.lines) {
        const lot = db.prepare('SELECT initial_quantity FROM purchase_lots WHERE id = ? AND deleted_at IS NULL').get(line.lotId) as { initial_quantity: number } | undefined;
        if (!lot) throw new Error(`Lot ${line.lotId} not found`);

        const soldResult = db.prepare('SELECT COALESCE(SUM(quantity), 0) as sold FROM sale_lines WHERE lot_id = ? AND deleted_at IS NULL').get(line.lotId) as { sold: number };
        const returnedResult = db.prepare('SELECT COALESCE(SUM(quantity), 0) as returned FROM sale_return_lines WHERE lot_id = ? AND deleted_at IS NULL').get(line.lotId) as { returned: number };
        const available = lot.initial_quantity - soldResult.sold + returnedResult.returned;

        if (line.quantity > available) {
          throw new Error(`Insufficient stock for lot ${line.lotId}: requested ${line.quantity}, available ${available}`);
        }
      }

      // Create sale order
      db.prepare(`INSERT INTO sale_orders (id, ref_number, date, observation, client_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(saleId, refNumber, data.date, data.observation ?? null, clientId, now, now);

      // Add sale_order to outbox FIRST (parent before children — prevents FK violations on sync)
      addToOutbox(db, 'sale_order', saleId, 'CREATE', {
        id: saleId, refNumber, date: data.date,
        observation: data.observation ?? null, clientId,
      });

      // Create sale lines
      const lineIds: string[] = [];
      for (const line of data.lines) {
        const lineId = uuidv7();
        db.prepare(`INSERT INTO sale_lines (id, selling_unit_price, quantity, sale_order_id, lot_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(lineId, line.sellingUnitPrice, line.quantity, saleId, line.lotId, now, now);
        lineIds.push(lineId);
        addToOutbox(db, 'sale_line', lineId, 'CREATE', {
          id: lineId, sellingUnitPrice: line.sellingUnitPrice,
          quantity: line.quantity, saleOrderId: saleId, lotId: line.lotId,
        });
      }

      // Auto-create customer credit for credit sales
      if (data.paymentType === 'credit') {
        const totalAmount = data.lines.reduce((sum, l) => sum + l.quantity * l.sellingUnitPrice, 0);
        const advancePaid = data.advancePaid ?? 0;
        if (advancePaid > totalAmount) throw new Error('L\'avance ne peut pas dépasser le montant total');
        const creditId = uuidv7();
        db.prepare(`
          INSERT INTO customer_credits (id, date, customer_name, designation, quantity, unit_price, advance_paid, due_date, sale_order_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(creditId, data.date, data.clientName!.trim(), `Vente ${refNumber}`, 1, totalAmount, advancePaid, data.dueDate ?? null, saleId, now, now);
        addToOutbox(db, 'customer_credit', creditId, 'CREATE', {
          id: creditId, date: data.date, customerName: data.clientName!.trim(),
          designation: `Vente ${refNumber}`, quantity: 1, unitPrice: totalAmount,
          advancePaid, dueDate: data.dueDate ?? null, saleOrderId: saleId,
        });
      }

      return { id: saleId, refNumber, lineIds };
    });

    return transaction();
  });

  // ─── Maintenance ─────────────────────────────────────────────────

  safeHandle('maintenance:create', (_event, data: { date: string; designation: string; price: number; boutique: string }) => {
    validateDate(data.date, 'Date');
    validateString(data.designation, 'Désignation');
    validatePositive(data.price, 'Prix');
    validateString(data.boutique, 'Boutique');
    const id = uuidv7();
    const now = new Date().toISOString();
    return db.transaction(() => {
      let boutique = db.prepare('SELECT id FROM boutiques WHERE name = ? AND deleted_at IS NULL').get(data.boutique) as { id: string } | undefined;
      if (!boutique) {
        const boutId = uuidv7();
        db.prepare('INSERT INTO boutiques (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(boutId, data.boutique.trim(), now, now);
        addToOutbox(db, 'boutique', boutId, 'CREATE', { id: boutId, name: data.boutique.trim() });
        boutique = { id: boutId };
      }

      // Upsert designation into maintenance_service_types for autocomplete
      const trimmedDesig = data.designation.trim();
      const existingType = db.prepare('SELECT id FROM maintenance_service_types WHERE name = ? AND deleted_at IS NULL').get(trimmedDesig) as { id: string } | undefined;
      if (!existingType) {
        const typeId = uuidv7();
        const ins = db.prepare('INSERT OR IGNORE INTO maintenance_service_types (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(typeId, trimmedDesig, now, now);
        if (ins.changes > 0) {
          addToOutbox(db, 'maintenance_service_type', typeId, 'CREATE', { id: typeId, name: trimmedDesig });
        }
      }

      db.prepare('INSERT INTO maintenance_jobs (id, date, designation, price, boutique_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, data.date, trimmedDesig, data.price, boutique.id, now, now);

      addToOutbox(db, 'maintenance_job', id, 'CREATE', {
        id, date: data.date, designation: trimmedDesig,
        price: data.price, boutiqueId: boutique.id,
      });
      return { id };
    })();
  });

  // ─── Battery Repair ──────────────────────────────────────────────

  safeHandle('battery-repair:create', (_event, data: { date: string; description: string; customerNote?: string; amount: number; costAdjustment?: number }) => {
    validateDate(data.date, 'Date');
    validateString(data.description, 'Description');
    validatePositive(data.amount, 'Montant');
    if (data.costAdjustment != null && data.costAdjustment !== 0) validateAmount(data.costAdjustment, 'Ajustement coût');
    const id = uuidv7();
    const now = new Date().toISOString();
    return db.transaction(() => {
      db.prepare('INSERT INTO battery_repair_jobs (id, date, description, customer_note, amount, cost_adjustment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, data.date, data.description.trim(), data.customerNote ?? null, data.amount, data.costAdjustment ?? 0, now, now);
      addToOutbox(db, 'battery_repair_job', id, 'CREATE', {
        id, date: data.date, description: data.description.trim(),
        customerNote: data.customerNote ?? null, amount: data.amount,
        costAdjustment: data.costAdjustment ?? 0,
      });
      return { id };
    })();
  });

  safeHandle('battery-repair:tariffs', () => {
    return db.prepare('SELECT * FROM battery_tariffs WHERE deleted_at IS NULL ORDER BY label').all();
  });

  // ─── Expenses ────────────────────────────────────────────────────

  safeHandle('expenses:create', (_event, data: { date: string; designation: string; amount: number; boutique: string }) => {
    validateDate(data.date, 'Date');
    validateString(data.designation, 'Désignation');
    validatePositive(data.amount, 'Montant');
    validateString(data.boutique, 'Boutique');
    const id = uuidv7();
    const now = new Date().toISOString();
    return db.transaction(() => {
      let boutique = db.prepare('SELECT id FROM boutiques WHERE name = ? AND deleted_at IS NULL').get(data.boutique) as { id: string } | undefined;
      if (!boutique) {
        const boutId = uuidv7();
        db.prepare('INSERT INTO boutiques (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(boutId, data.boutique.trim(), now, now);
        addToOutbox(db, 'boutique', boutId, 'CREATE', { id: boutId, name: data.boutique.trim() });
        boutique = { id: boutId };
      }

      // Upsert designation into expense_designations for autocomplete
      const trimmedDesig = data.designation.trim();
      const existingDesig = db.prepare('SELECT id FROM expense_designations WHERE name = ? AND deleted_at IS NULL').get(trimmedDesig) as { id: string } | undefined;
      if (!existingDesig) {
        const desigId = uuidv7();
        const ins = db.prepare('INSERT OR IGNORE INTO expense_designations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(desigId, trimmedDesig, now, now);
        if (ins.changes > 0) {
          addToOutbox(db, 'expense_designation', desigId, 'CREATE', { id: desigId, name: trimmedDesig });
        }
      }

      db.prepare('INSERT INTO expenses (id, date, designation, amount, boutique_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, data.date, trimmedDesig, data.amount, boutique.id, now, now);

      addToOutbox(db, 'expense', id, 'CREATE', {
        id, date: data.date, designation: trimmedDesig,
        amount: data.amount, boutiqueId: boutique.id,
      });
      return { id };
    })();
  });

  // ─── Customer Credits ────────────────────────────────────────────

  safeHandle('customer-credits:list', (_event, params?: { search?: string; page?: number; limit?: number }) => {
    const limit = Math.min(Math.max(1, params?.limit ?? 50), 200);
    const page = Math.max(1, params?.page ?? 1);
    const offset = (page - 1) * limit;

    let whereClauses = 'cc.deleted_at IS NULL';
    const bindings: unknown[] = [];
    if (params?.search) {
      whereClauses += ` AND (cc.id LIKE ? ESCAPE '\\' OR cc.customer_name LIKE ? ESCAPE '\\' OR cc.designation LIKE ? ESCAPE '\\' OR cc.date LIKE ? ESCAPE '\\' OR CAST(cc.quantity * cc.unit_price AS TEXT) LIKE ? ESCAPE '\\')`;
      const s = `%${escapeLike(params.search)}%`;
      bindings.push(s, s, s, s, s);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM customer_credits cc WHERE ${whereClauses}`).get(...bindings) as { total: number };

    const credits = db.prepare(`
      SELECT cc.*,
        (cc.quantity * cc.unit_price) as total_amount,
        COALESCE((SELECT SUM(amount) FROM customer_credit_payments WHERE customer_credit_id = cc.id AND deleted_at IS NULL), 0) as total_payments
      FROM customer_credits cc
      WHERE ${whereClauses}
      ORDER BY cc.date DESC
      LIMIT ? OFFSET ?
    `).all(...bindings, limit, offset) as Array<Record<string, unknown>>;

    // Batch-fetch all payments for active credits in one query
    const creditIds = credits.map(c => c['id'] as string);
    const paymentsMap = new Map<string, Array<Record<string, unknown>>>();
    if (creditIds.length > 0) {
      const allPayments = db.prepare(`SELECT id, date, amount, customer_credit_id FROM customer_credit_payments WHERE customer_credit_id IN (${creditIds.map(() => '?').join(',')}) AND deleted_at IS NULL ORDER BY date ASC`).all(...creditIds) as Array<Record<string, unknown>>;
      for (const p of allPayments) {
        const cid = p['customer_credit_id'] as string;
        if (!paymentsMap.has(cid)) paymentsMap.set(cid, []);
        paymentsMap.get(cid)!.push({ id: p['id'], date: p['date'], amount: p['amount'] });
      }
    }

    const items = credits.map((c) => ({
      ...c,
      remainingBalance: (c['total_amount'] as number) - (c['advance_paid'] as number) - (c['total_payments'] as number),
      payments: paymentsMap.get(c['id'] as string) || [],
    }));

    return { items, total: countResult.total, page, limit };
  });

  safeHandle('customer-credits:history', (_event, customerName: string) => {
    if (!customerName || typeof customerName !== 'string') throw new Error('Nom client requis');
    const credits = db.prepare(`
      SELECT cc.*,
        (cc.quantity * cc.unit_price) as total_amount,
        COALESCE((SELECT SUM(amount) FROM customer_credit_payments WHERE customer_credit_id = cc.id AND deleted_at IS NULL), 0) as total_payments
      FROM customer_credits cc
      WHERE cc.deleted_at IS NULL AND cc.customer_name = ?
      ORDER BY cc.date DESC
    `).all(customerName) as Array<Record<string, unknown>>;
    const creditIds = credits.map(c => c['id'] as string);
    const paymentsMap = new Map<string, Array<Record<string, unknown>>>();
    if (creditIds.length > 0) {
      const allPayments = db.prepare(`SELECT id, date, amount, customer_credit_id FROM customer_credit_payments WHERE customer_credit_id IN (${creditIds.map(() => '?').join(',')}) AND deleted_at IS NULL ORDER BY date ASC`).all(...creditIds) as Array<Record<string, unknown>>;
      for (const p of allPayments) {
        const cid = p['customer_credit_id'] as string;
        if (!paymentsMap.has(cid)) paymentsMap.set(cid, []);
        paymentsMap.get(cid)!.push({ id: p['id'], date: p['date'], amount: p['amount'] });
      }
    }
    return credits.map((c) => ({
      ...c,
      remainingBalance: (c['total_amount'] as number) - (c['advance_paid'] as number) - (c['total_payments'] as number),
      payments: paymentsMap.get(c['id'] as string) || [],
    }));
  });

  safeHandle('customer-credits:create', (_event, data: { date: string; customerName: string; designation: string; quantity: number; unitPrice: number; advancePaid?: number }) => {
    validateDate(data.date, 'Date');
    validateString(data.customerName, 'Nom client');
    validateString(data.designation, 'Désignation');
    validatePositive(data.quantity, 'Quantité');
    validatePositive(data.unitPrice, 'Prix unitaire');
    if (data.advancePaid != null && data.advancePaid !== 0) {
      validateAmount(data.advancePaid, 'Avance');
      if (data.advancePaid > data.quantity * data.unitPrice) throw new Error('L\'avance ne peut pas dépasser le total');
    }
    const id = uuidv7();
    const now = new Date().toISOString();
    return db.transaction(() => {
      db.prepare('INSERT INTO customer_credits (id, date, customer_name, designation, quantity, unit_price, advance_paid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, data.date, data.customerName.trim(), data.designation.trim(), data.quantity, data.unitPrice, data.advancePaid ?? 0, now, now);
      addToOutbox(db, 'customer_credit', id, 'CREATE', {
        id, date: data.date, customerName: data.customerName.trim(),
        designation: data.designation.trim(), quantity: data.quantity,
        unitPrice: data.unitPrice, advancePaid: data.advancePaid ?? 0,
      });
      return { id };
    })();
  });

  // ─── Supplier Credits ────────────────────────────────────────────

  safeHandle('supplier-credits:create', (_event, data: { date: string; supplier: string; designation: string; totalAmount: number; advancePaid?: number }) => {
    validateDate(data.date, 'Date');
    validateString(data.supplier, 'Fournisseur');
    validateString(data.designation, 'Désignation');
    validatePositive(data.totalAmount, 'Montant total');
    if (data.advancePaid != null && data.advancePaid !== 0) {
      validateAmount(data.advancePaid, 'Avance');
      if (data.advancePaid > data.totalAmount) throw new Error('L\'avance ne peut pas dépasser le total');
    }
    const id = uuidv7();
    const supplier = db.prepare('SELECT id FROM suppliers WHERE code = ? AND deleted_at IS NULL').get(data.supplier) as { id: string } | undefined;
    if (!supplier) throw new Error(`Supplier '${data.supplier}' not found`);

    const now = new Date().toISOString();
    return db.transaction(() => {
      db.prepare('INSERT INTO supplier_credits (id, date, designation, total_amount, advance_paid, supplier_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, data.date, data.designation.trim(), data.totalAmount, data.advancePaid ?? 0, supplier.id, now, now);
      addToOutbox(db, 'supplier_credit', id, 'CREATE', {
        id, date: data.date, designation: data.designation.trim(),
        totalAmount: data.totalAmount, advancePaid: data.advancePaid ?? 0,
        supplierId: supplier.id,
      });
      return { id };
    })();
  });

  // ─── Bank Movements ──────────────────────────────────────────────

  safeHandle('bank-movements:create', (_event, data: { date: string; description: string; amountIn?: number; amountOut?: number }) => {
    validateDate(data.date, 'Date');
    validateString(data.description, 'Description');
    if (data.amountIn != null) validateAmount(data.amountIn, 'Montant entrée');
    if (data.amountOut != null) validateAmount(data.amountOut, 'Montant sortie');
    if ((data.amountIn ?? 0) > 0 && (data.amountOut ?? 0) > 0) {
      throw new Error('Un mouvement ne peut pas avoir un montant en entrée ET en sortie');
    }
    if ((data.amountIn ?? 0) === 0 && (data.amountOut ?? 0) === 0) {
      throw new Error('Un mouvement doit avoir un montant en entrée OU en sortie');
    }
    const id = uuidv7();
    const now = new Date().toISOString();
    return db.transaction(() => {
      db.prepare('INSERT INTO bank_movements (id, date, description, amount_in, amount_out, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, data.date, data.description.trim(), data.amountIn ?? 0, data.amountOut ?? 0, now, now);
      addToOutbox(db, 'bank_movement', id, 'CREATE', {
        id, date: data.date, description: data.description.trim(),
        amountIn: data.amountIn ?? 0, amountOut: data.amountOut ?? 0,
      });
      return { id };
    })();
  });

  safeHandle('bank-movements:summary', () => {
    const result = db.prepare('SELECT COALESCE(SUM(amount_in), 0) as total_in, COALESCE(SUM(amount_out), 0) as total_out FROM bank_movements WHERE deleted_at IS NULL').get() as { total_in: number; total_out: number };
    return { totalIn: result.total_in, totalOut: result.total_out, balanceDelta: result.total_in - result.total_out };
  });

  // ─── Sales Update ─────────────────────────────────────────────────

  safeHandle('sales:update', (_event, data: {
    id: string; date: string; observation?: string; clientName?: string;
    lines: Array<{ lotId: string; quantity: number; sellingUnitPrice: number }>;
  }) => {
    validateDate(data.date, 'Date');
    if (!data.lines || data.lines.length === 0) throw new Error('Au moins une ligne est requise');
    if (data.lines.length > 200) throw new Error('Maximum 200 lignes par vente');
    for (const line of data.lines) {
      validatePositive(line.quantity, 'Quantité');
      validatePositive(line.sellingUnitPrice, 'Prix de vente');
    }
    const now = new Date().toISOString();
    const transaction = db.transaction(() => {
      const existing = db.prepare('SELECT id FROM sale_orders WHERE id = ? AND deleted_at IS NULL').get(data.id) as { id: string } | undefined;
      if (!existing) throw new Error(`Sale order ${data.id} not found`);

      // Resolve or auto-create client
      let clientId: string | null = null;
      if (data.clientName && data.clientName.trim()) {
        const trimmed = data.clientName.trim();
        let client = db.prepare('SELECT id FROM clients WHERE name = ? AND deleted_at IS NULL').get(trimmed) as { id: string } | undefined;
        if (!client) {
          clientId = uuidv7();
          db.prepare('INSERT INTO clients (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(clientId, trimmed, now, now);
          addToOutbox(db, 'client', clientId, 'CREATE', { id: clientId, name: trimmed });
        } else {
          clientId = client.id;
        }
      }

      // Soft-delete old lines
      const oldLines = db.prepare('SELECT id FROM sale_lines WHERE sale_order_id = ? AND deleted_at IS NULL').all(data.id) as Array<{ id: string }>;
      db.prepare('UPDATE sale_lines SET deleted_at = ?, updated_at = ? WHERE sale_order_id = ? AND deleted_at IS NULL').run(now, now, data.id);
      for (const oldLine of oldLines) {
        addToOutbox(db, 'sale_line', oldLine.id, 'DELETE', { id: oldLine.id });
      }

      // Update order header first (parent before children in outbox)
      db.prepare('UPDATE sale_orders SET date = ?, observation = ?, client_id = ?, updated_at = ? WHERE id = ?').run(data.date, data.observation ?? null, clientId, now, data.id);

      const existingOrder = db.prepare('SELECT ref_number FROM sale_orders WHERE id = ?').get(data.id) as { ref_number: string };
      addToOutbox(db, 'sale_order', data.id, 'UPDATE', {
        id: data.id, refNumber: existingOrder.ref_number, date: data.date,
        observation: data.observation ?? null, clientId,
      });

      // Verify stock and insert new lines
      const lineIds: string[] = [];
      for (const line of data.lines) {
        const lot = db.prepare('SELECT initial_quantity FROM purchase_lots WHERE id = ? AND deleted_at IS NULL').get(line.lotId) as { initial_quantity: number } | undefined;
        if (!lot) throw new Error(`Lot ${line.lotId} not found`);

        const soldResult = db.prepare('SELECT COALESCE(SUM(quantity), 0) as sold FROM sale_lines WHERE lot_id = ? AND deleted_at IS NULL').get(line.lotId) as { sold: number };
        const returnedResult = db.prepare('SELECT COALESCE(SUM(quantity), 0) as returned FROM sale_return_lines WHERE lot_id = ? AND deleted_at IS NULL').get(line.lotId) as { returned: number };
        const available = lot.initial_quantity - soldResult.sold + returnedResult.returned;
        if (line.quantity > available) throw new Error(`Insufficient stock for lot ${line.lotId}: requested ${line.quantity}, available ${available}`);

        const lineId = uuidv7();
        db.prepare('INSERT INTO sale_lines (id, selling_unit_price, quantity, sale_order_id, lot_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(lineId, line.sellingUnitPrice, line.quantity, data.id, line.lotId, now, now);
        lineIds.push(lineId);
        addToOutbox(db, 'sale_line', lineId, 'CREATE', {
          id: lineId, sellingUnitPrice: line.sellingUnitPrice,
          quantity: line.quantity, saleOrderId: data.id, lotId: line.lotId,
        });
      }
      return { success: true };
    });
    return transaction();
  });

  // ─── Sales Delete ─────────────────────────────────────────────────

  safeHandle('sales:delete', (_event, id: string) => {
    const now = new Date().toISOString();
    const transaction = db.transaction(() => {
      const oldLines = db.prepare('SELECT id FROM sale_lines WHERE sale_order_id = ? AND deleted_at IS NULL').all(id) as Array<{ id: string }>;
      db.prepare('UPDATE sale_lines SET deleted_at = ?, updated_at = ? WHERE sale_order_id = ? AND deleted_at IS NULL').run(now, now, id);
      for (const oldLine of oldLines) {
        addToOutbox(db, 'sale_line', oldLine.id, 'DELETE', { id: oldLine.id });
      }
      const result = db.prepare('UPDATE sale_orders SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Sale order ${id} not found`);
      addToOutbox(db, 'sale_order', id, 'DELETE', { id });
    });
    transaction();
    return { success: true };
  });

  // ─── Sales Return ─────────────────────────────────────────────────

  safeHandle('sales:return', (_event, data: {
    saleOrderId: string; date: string; observation?: string;
    lines: Array<{ saleLineId: string; lotId: string; quantity: number; sellingUnitPrice: number }>;
  }) => {
    validateDate(data.date, 'Date');
    if (!data.saleOrderId) throw new Error('saleOrderId est requis');
    if (!data.lines || data.lines.length === 0) throw new Error('Au moins une ligne de retour est requise');
    if (data.lines.length > 200) throw new Error('Maximum 200 lignes par retour');
    for (const line of data.lines) {
      validatePositive(line.quantity, 'Quantité');
      validatePositive(line.sellingUnitPrice, 'Prix de vente');
    }

    const returnId = uuidv7();
    const refNumber = `RET-${Date.now()}`;
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      // Verify sale order exists
      const order = db.prepare('SELECT id FROM sale_orders WHERE id = ? AND deleted_at IS NULL').get(data.saleOrderId) as { id: string } | undefined;
      if (!order) throw new Error(`Vente ${data.saleOrderId} introuvable`);

      // Validate each line
      for (const line of data.lines) {
        // Verify sale line belongs to this order
        const saleLine = db.prepare('SELECT id, quantity, lot_id FROM sale_lines WHERE id = ? AND sale_order_id = ? AND deleted_at IS NULL').get(line.saleLineId, data.saleOrderId) as { id: string; quantity: number; lot_id: string } | undefined;
        if (!saleLine) throw new Error(`Ligne de vente ${line.saleLineId} introuvable dans cette vente`);
        if (saleLine.lot_id !== line.lotId) throw new Error(`Lot incohérent pour la ligne ${line.saleLineId}`);

        // Check already returned quantity
        const alreadyReturned = db.prepare('SELECT COALESCE(SUM(quantity), 0) as returned FROM sale_return_lines WHERE sale_line_id = ? AND deleted_at IS NULL').get(line.saleLineId) as { returned: number };
        const maxReturnable = saleLine.quantity - alreadyReturned.returned;
        if (line.quantity > maxReturnable) {
          throw new Error(`Quantité de retour (${line.quantity}) dépasse le maximum retournable (${maxReturnable}) pour la ligne ${line.saleLineId}`);
        }
      }

      // Create sale return header
      db.prepare(`INSERT INTO sale_returns (id, ref_number, date, sale_order_id, observation, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(returnId, refNumber, data.date, data.saleOrderId, data.observation ?? null, now, now);

      // Outbox parent first
      addToOutbox(db, 'sale_return', returnId, 'CREATE', {
        id: returnId, refNumber, date: data.date,
        observation: data.observation ?? null, saleOrderId: data.saleOrderId,
      });

      // Create return lines
      for (const line of data.lines) {
        const lineId = uuidv7();
        db.prepare(`INSERT INTO sale_return_lines (id, sale_return_id, sale_line_id, lot_id, quantity, selling_unit_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(lineId, returnId, line.saleLineId, line.lotId, line.quantity, line.sellingUnitPrice, now, now);
        addToOutbox(db, 'sale_return_line', lineId, 'CREATE', {
          id: lineId, sellingUnitPrice: line.sellingUnitPrice,
          quantity: line.quantity, saleReturnId: returnId, saleLineId: line.saleLineId, lotId: line.lotId,
        });
      }

      return { id: returnId, refNumber };
    });
    return transaction();
  });

  // ─── Sales List ──────────────────────────────────────────────────

  safeHandle('sales:list', (_event, params?: { search?: string; page?: number; limit?: number; category?: string; subCategory?: string }) => {
    const limit = Math.min(Math.max(1, params?.limit ?? 50), 200);
    const page = Math.max(1, params?.page ?? 1);
    const offset = (page - 1) * limit;

    let whereClauses = 'so.deleted_at IS NULL';
    const bindings: unknown[] = [];
    if (params?.search) {
      whereClauses += ` AND (so.id LIKE ? ESCAPE '\\' OR so.ref_number LIKE ? ESCAPE '\\' OR so.date LIKE ? ESCAPE '\\' OR so.observation LIKE ? ESCAPE '\\' OR cl.name LIKE ? ESCAPE '\\' OR so.id IN (SELECT sl_b.sale_order_id FROM sale_lines sl_b JOIN purchase_lots pl_b ON sl_b.lot_id = pl_b.id WHERE sl_b.deleted_at IS NULL AND pl_b.barcode LIKE ? ESCAPE '\\'))`;
      const s = `%${escapeLike(params.search)}%`;
      bindings.push(s, s, s, s, s, s);
    }

    // Category/sub-category filters require checking sale lines → lots
    if (params?.category || params?.subCategory) {
      let subWhere = 'sl_f.deleted_at IS NULL';
      const subBindings: string[] = [];
      if (params.category) { subWhere += ' AND cat_f.name = ?'; subBindings.push(params.category); }
      if (params.subCategory) { subWhere += ' AND scat_f.name = ?'; subBindings.push(params.subCategory); }
      whereClauses += ` AND so.id IN (
        SELECT DISTINCT sl_f.sale_order_id FROM sale_lines sl_f
        JOIN purchase_lots pl_f ON sl_f.lot_id = pl_f.id
        LEFT JOIN categories cat_f ON pl_f.category_id = cat_f.id
        LEFT JOIN sub_categories scat_f ON pl_f.sub_category_id = scat_f.id
        WHERE ${subWhere}
      )`;
      bindings.push(...subBindings);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM sale_orders so LEFT JOIN clients cl ON so.client_id = cl.id WHERE ${whereClauses}
    `).get(...bindings) as { total: number };

    const orders = db.prepare(`
      SELECT so.id, so.ref_number, so.date, so.observation, so.client_id,
        cl.name as client_name
      FROM sale_orders so
      LEFT JOIN clients cl ON so.client_id = cl.id
      WHERE ${whereClauses} ORDER BY so.date DESC LIMIT ? OFFSET ?
    `).all(...bindings, limit, offset) as Array<Record<string, unknown>>;

    // Batch-fetch all sale lines in one query instead of N queries
    const orderIds = orders.map(o => o['id'] as string);
    const linesMap = new Map<string, Array<Record<string, unknown>>>();
    if (orderIds.length > 0) {
      const allLines = db.prepare(`
        SELECT sl.id, sl.quantity, sl.selling_unit_price, sl.lot_id, sl.sale_order_id,
          pl.designation, pl.purchase_unit_cost, pl.selling_price, COALESCE(c.name, '[Supprimé]') as category, COALESCE(b.name, '[Supprimé]') as boutique
        FROM sale_lines sl
        JOIN purchase_lots pl ON sl.lot_id = pl.id
        LEFT JOIN categories c ON pl.category_id = c.id
        LEFT JOIN boutiques b ON pl.boutique_id = b.id
        WHERE sl.sale_order_id IN (${orderIds.map(() => '?').join(',')}) AND sl.deleted_at IS NULL
      `).all(...orderIds) as Array<Record<string, unknown>>;
      for (const l of allLines) {
        const oid = l['sale_order_id'] as string;
        if (!linesMap.has(oid)) linesMap.set(oid, []);
        linesMap.get(oid)!.push(l);
      }
    }

    // Batch-fetch returned quantities per sale line
    const returnedMap = new Map<string, number>();
    if (orderIds.length > 0) {
      const returnRows = db.prepare(`
        SELECT srl.sale_line_id, SUM(srl.quantity) as returned_quantity
        FROM sale_return_lines srl
        JOIN sale_lines sl ON srl.sale_line_id = sl.id
        WHERE sl.sale_order_id IN (${orderIds.map(() => '?').join(',')}) AND srl.deleted_at IS NULL
        GROUP BY srl.sale_line_id
      `).all(...orderIds) as Array<{ sale_line_id: string; returned_quantity: number }>;
      for (const r of returnRows) {
        returnedMap.set(r.sale_line_id, r.returned_quantity);
      }
    }

    const items = orders.map((order) => {
      const lines = linesMap.get(order['id'] as string) || [];
      // Add returned_quantity to each line
      const linesWithReturns = lines.map(l => ({
        ...l,
        returned_quantity: returnedMap.get(l['id'] as string) || 0,
      }));
      const totalAmount = lines.reduce((sum, l) => sum + (l['quantity'] as number) * (l['selling_unit_price'] as number), 0);
      const totalMargin = lines.reduce((sum, l) => sum + ((l['selling_unit_price'] as number) - (l['purchase_unit_cost'] as number)) * (l['quantity'] as number), 0);
      const totalReturned = linesWithReturns.reduce((sum, l) => sum + (l.returned_quantity as number) * (l['selling_unit_price'] as number), 0);
      return { ...order, lines: linesWithReturns, totalAmount, totalMargin, totalReturned };
    });

    return { items, total: countResult.total, page, limit };
  });

  // ─── Customer Orders Create ──────────────────────────────────────

  safeHandle('customer-orders:create', (_event, data: {
    date: string; observation?: string; clientName?: string;
    lines: Array<{ lotId: string; quantity: number; sellingUnitPrice: number }>;
  }) => {
    validateDate(data.date, 'Date');
    if (!data.lines || data.lines.length === 0) throw new Error('Au moins une ligne est requise');
    if (data.lines.length > 200) throw new Error('Maximum 200 lignes par commande');
    for (const line of data.lines) {
      validatePositive(line.quantity, 'Quantité');
      validatePositive(line.sellingUnitPrice, 'Prix de vente');
    }
    const orderId = uuidv7();
    const refNumber = `CMD-${Date.now()}`;
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      // Resolve or auto-create client
      let clientId: string | null = null;
      if (data.clientName && data.clientName.trim()) {
        const trimmed = data.clientName.trim();
        let client = db.prepare('SELECT id FROM clients WHERE name = ? AND deleted_at IS NULL').get(trimmed) as { id: string } | undefined;
        if (!client) {
          clientId = uuidv7();
          db.prepare('INSERT INTO clients (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(clientId, trimmed, now, now);
          addToOutbox(db, 'client', clientId, 'CREATE', { id: clientId, name: trimmed });
        } else {
          clientId = client.id;
        }
      }

      // Create customer order
      db.prepare(`INSERT INTO customer_orders (id, ref_number, date, client_id, status, observation, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`).run(orderId, refNumber, data.date, clientId, data.observation ?? null, now, now);

      addToOutbox(db, 'customer_order', orderId, 'CREATE', {
        id: orderId, refNumber, date: data.date,
        observation: data.observation ?? null, clientId, status: 'pending',
      });

      // Create order lines
      for (const line of data.lines) {
        const lineId = uuidv7();
        db.prepare(`INSERT INTO customer_order_lines (id, customer_order_id, lot_id, quantity, selling_unit_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(lineId, orderId, line.lotId, line.quantity, line.sellingUnitPrice, now, now);
        addToOutbox(db, 'customer_order_line', lineId, 'CREATE', {
          id: lineId, customerOrderId: orderId, lotId: line.lotId,
          quantity: line.quantity, sellingUnitPrice: line.sellingUnitPrice,
        });
      }
      return { success: true, id: orderId };
    });
    return transaction();
  });

  // ─── Customer Orders Update ──────────────────────────────────────

  safeHandle('customer-orders:update', (_event, data: {
    id: string; date: string; observation?: string; clientName?: string; status?: string;
    lines: Array<{ lotId: string; quantity: number; sellingUnitPrice: number }>;
  }) => {
    validateDate(data.date, 'Date');
    if (!data.lines || data.lines.length === 0) throw new Error('Au moins une ligne est requise');
    if (data.lines.length > 200) throw new Error('Maximum 200 lignes par commande');
    for (const line of data.lines) {
      validatePositive(line.quantity, 'Quantité');
      validatePositive(line.sellingUnitPrice, 'Prix de vente');
    }
    if (data.status && !['pending', 'confirmed', 'delivered', 'cancelled'].includes(data.status)) {
      throw new Error('Statut invalide');
    }
    const now = new Date().toISOString();
    const transaction = db.transaction(() => {
      const existing = db.prepare('SELECT id, ref_number, status FROM customer_orders WHERE id = ? AND deleted_at IS NULL').get(data.id) as { id: string; ref_number: string; status: string } | undefined;
      if (!existing) throw new Error(`Commande ${data.id} introuvable`);

      // Resolve or auto-create client
      let clientId: string | null = null;
      if (data.clientName && data.clientName.trim()) {
        const trimmed = data.clientName.trim();
        let client = db.prepare('SELECT id FROM clients WHERE name = ? AND deleted_at IS NULL').get(trimmed) as { id: string } | undefined;
        if (!client) {
          clientId = uuidv7();
          db.prepare('INSERT INTO clients (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(clientId, trimmed, now, now);
          addToOutbox(db, 'client', clientId, 'CREATE', { id: clientId, name: trimmed });
        } else {
          clientId = client.id;
        }
      }

      // Soft-delete old lines
      const oldLines = db.prepare('SELECT id FROM customer_order_lines WHERE customer_order_id = ? AND deleted_at IS NULL').all(data.id) as Array<{ id: string }>;
      db.prepare('UPDATE customer_order_lines SET deleted_at = ?, updated_at = ? WHERE customer_order_id = ? AND deleted_at IS NULL').run(now, now, data.id);
      for (const oldLine of oldLines) {
        addToOutbox(db, 'customer_order_line', oldLine.id, 'DELETE', { id: oldLine.id });
      }

      // Update order header
      const newStatus = data.status || existing.status;
      db.prepare('UPDATE customer_orders SET date = ?, observation = ?, client_id = ?, status = ?, updated_at = ? WHERE id = ?').run(data.date, data.observation ?? null, clientId, newStatus, now, data.id);

      addToOutbox(db, 'customer_order', data.id, 'UPDATE', {
        id: data.id, refNumber: existing.ref_number, date: data.date,
        observation: data.observation ?? null, clientId, status: newStatus,
      });

      // Insert new lines
      for (const line of data.lines) {
        const lineId = uuidv7();
        db.prepare(`INSERT INTO customer_order_lines (id, customer_order_id, lot_id, quantity, selling_unit_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(lineId, data.id, line.lotId, line.quantity, line.sellingUnitPrice, now, now);
        addToOutbox(db, 'customer_order_line', lineId, 'CREATE', {
          id: lineId, customerOrderId: data.id, lotId: line.lotId,
          quantity: line.quantity, sellingUnitPrice: line.sellingUnitPrice,
        });
      }
      return { success: true };
    });
    return transaction();
  });

  // ─── Customer Orders Update Status ───────────────────────────────

  safeHandle('customer-orders:update-status', (_event, data: { id: string; status: string }) => {
    if (!['pending', 'confirmed', 'delivered', 'cancelled'].includes(data.status)) {
      throw new Error('Statut invalide');
    }
    const now = new Date().toISOString();
    return db.transaction(() => {
      const existing = db.prepare('SELECT id, ref_number, date, observation, client_id FROM customer_orders WHERE id = ? AND deleted_at IS NULL').get(data.id) as { id: string; ref_number: string; date: string; observation: string | null; client_id: string | null } | undefined;
      if (!existing) throw new Error(`Commande ${data.id} introuvable`);

      db.prepare('UPDATE customer_orders SET status = ?, updated_at = ? WHERE id = ?').run(data.status, now, data.id);
      addToOutbox(db, 'customer_order', data.id, 'UPDATE', {
        id: data.id, refNumber: existing.ref_number, date: existing.date,
        observation: existing.observation, clientId: existing.client_id, status: data.status,
      });
      return { success: true };
    })();
  });

  // ─── Customer Orders Delete ──────────────────────────────────────

  safeHandle('customer-orders:delete', (_event, id: string) => {
    const now = new Date().toISOString();
    const transaction = db.transaction(() => {
      const oldLines = db.prepare('SELECT id FROM customer_order_lines WHERE customer_order_id = ? AND deleted_at IS NULL').all(id) as Array<{ id: string }>;
      db.prepare('UPDATE customer_order_lines SET deleted_at = ?, updated_at = ? WHERE customer_order_id = ? AND deleted_at IS NULL').run(now, now, id);
      for (const oldLine of oldLines) {
        addToOutbox(db, 'customer_order_line', oldLine.id, 'DELETE', { id: oldLine.id });
      }
      const result = db.prepare('UPDATE customer_orders SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Commande ${id} introuvable`);
      addToOutbox(db, 'customer_order', id, 'DELETE', { id });
    });
    transaction();
    return { success: true };
  });

  // ─── Customer Orders List ────────────────────────────────────────

  safeHandle('customer-orders:list', (_event, params?: { search?: string; page?: number; limit?: number; status?: string }) => {
    const limit = Math.min(Math.max(1, params?.limit ?? 50), 200);
    const page = Math.max(1, params?.page ?? 1);
    const offset = (page - 1) * limit;

    let whereClauses = 'co.deleted_at IS NULL';
    const bindings: unknown[] = [];
    if (params?.status) {
      whereClauses += ' AND co.status = ?';
      bindings.push(params.status);
    }
    if (params?.search) {
      whereClauses += ` AND (co.id LIKE ? ESCAPE '\\' OR co.ref_number LIKE ? ESCAPE '\\' OR co.date LIKE ? ESCAPE '\\' OR co.observation LIKE ? ESCAPE '\\' OR cl.name LIKE ? ESCAPE '\\')`;
      const s = `%${escapeLike(params.search)}%`;
      bindings.push(s, s, s, s, s);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM customer_orders co LEFT JOIN clients cl ON co.client_id = cl.id WHERE ${whereClauses}
    `).get(...bindings) as { total: number };

    const orders = db.prepare(`
      SELECT co.id, co.ref_number, co.date, co.observation, co.client_id, co.status,
        cl.name as client_name
      FROM customer_orders co
      LEFT JOIN clients cl ON co.client_id = cl.id
      WHERE ${whereClauses} ORDER BY co.date DESC, co.created_at DESC LIMIT ? OFFSET ?
    `).all(...bindings, limit, offset) as Array<Record<string, unknown>>;

    // Batch-fetch all order lines
    const orderIds = orders.map(o => o['id'] as string);
    const linesMap = new Map<string, Array<Record<string, unknown>>>();
    if (orderIds.length > 0) {
      const allLines = db.prepare(`
        SELECT col.id, col.quantity, col.selling_unit_price, col.lot_id, col.customer_order_id,
          pl.designation, pl.purchase_unit_cost, pl.selling_price, COALESCE(c.name, '[Supprimé]') as category
        FROM customer_order_lines col
        JOIN purchase_lots pl ON col.lot_id = pl.id
        LEFT JOIN categories c ON pl.category_id = c.id
        WHERE col.customer_order_id IN (${orderIds.map(() => '?').join(',')}) AND col.deleted_at IS NULL
      `).all(...orderIds) as Array<Record<string, unknown>>;
      for (const l of allLines) {
        const oid = l['customer_order_id'] as string;
        if (!linesMap.has(oid)) linesMap.set(oid, []);
        linesMap.get(oid)!.push(l);
      }
    }

    const items = orders.map((order) => {
      const lines = linesMap.get(order['id'] as string) || [];
      const totalAmount = lines.reduce((sum, l) => sum + (l['quantity'] as number) * (l['selling_unit_price'] as number), 0);
      return { ...order, lines, totalAmount };
    });

    return { items, total: countResult.total, page, limit };
  });

  // ─── Maintenance List ────────────────────────────────────────────

  safeHandle('maintenance:list', (_event, params?: { search?: string; page?: number; limit?: number }) => {
    const limit = Math.min(Math.max(1, params?.limit ?? 50), 200);
    const page = Math.max(1, params?.page ?? 1);
    const offset = (page - 1) * limit;

    let whereClauses = 'mj.deleted_at IS NULL';
    const bindings: unknown[] = [];
    if (params?.search) {
      whereClauses += ` AND (mj.id LIKE ? ESCAPE '\\' OR mj.designation LIKE ? ESCAPE '\\' OR mj.date LIKE ? ESCAPE '\\' OR b.name LIKE ? ESCAPE '\\' OR CAST(mj.price AS TEXT) LIKE ? ESCAPE '\\')`;
      const s = `%${escapeLike(params.search)}%`;
      bindings.push(s, s, s, s, s);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM maintenance_jobs mj LEFT JOIN boutiques b ON mj.boutique_id = b.id WHERE ${whereClauses}`).get(...bindings) as { total: number };
    const items = db.prepare(`
      SELECT mj.*, COALESCE(b.name, '[Supprimé]') as boutique_name
      FROM maintenance_jobs mj
      LEFT JOIN boutiques b ON mj.boutique_id = b.id
      WHERE ${whereClauses}
      ORDER BY mj.date DESC LIMIT ? OFFSET ?
    `).all(...bindings, limit, offset);

    return { items, total: countResult.total, page, limit };
  });

  // ─── Battery Repair List ─────────────────────────────────────────

  safeHandle('battery-repair:list', (_event, params?: { search?: string; page?: number; limit?: number }) => {
    const limit = Math.min(Math.max(1, params?.limit ?? 50), 200);
    const page = Math.max(1, params?.page ?? 1);
    const offset = (page - 1) * limit;

    let whereClauses = 'deleted_at IS NULL';
    const bindings: unknown[] = [];
    if (params?.search) {
      whereClauses += ` AND (id LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR date LIKE ? ESCAPE '\\' OR customer_note LIKE ? ESCAPE '\\' OR CAST(amount AS TEXT) LIKE ? ESCAPE '\\')`;
      const s = `%${escapeLike(params.search)}%`;
      bindings.push(s, s, s, s, s);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM battery_repair_jobs WHERE ${whereClauses}`).get(...bindings) as { total: number };
    const items = db.prepare(`SELECT * FROM battery_repair_jobs WHERE ${whereClauses} ORDER BY date DESC LIMIT ? OFFSET ?`).all(...bindings, limit, offset);

    return { items, total: countResult.total, page, limit };
  });

  // ─── Expenses List ───────────────────────────────────────────────

  safeHandle('expenses:list', (_event, params?: { search?: string; page?: number; limit?: number }) => {
    const limit = Math.min(Math.max(1, params?.limit ?? 50), 200);
    const page = Math.max(1, params?.page ?? 1);
    const offset = (page - 1) * limit;

    let whereClauses = 'e.deleted_at IS NULL';
    const bindings: unknown[] = [];
    if (params?.search) {
      whereClauses += ` AND (e.id LIKE ? ESCAPE '\\' OR e.designation LIKE ? ESCAPE '\\' OR e.date LIKE ? ESCAPE '\\' OR b.name LIKE ? ESCAPE '\\' OR CAST(e.amount AS TEXT) LIKE ? ESCAPE '\\')`;
      const s = `%${escapeLike(params.search)}%`;
      bindings.push(s, s, s, s, s);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM expenses e LEFT JOIN boutiques b ON e.boutique_id = b.id WHERE ${whereClauses}`).get(...bindings) as { total: number };
    const items = db.prepare(`
      SELECT e.*, COALESCE(b.name, '[Supprimé]') as boutique_name
      FROM expenses e
      LEFT JOIN boutiques b ON e.boutique_id = b.id
      WHERE ${whereClauses}
      ORDER BY e.date DESC LIMIT ? OFFSET ?
    `).all(...bindings, limit, offset);

    return { items, total: countResult.total, page, limit };
  });

  // ─── Supplier Credits List ───────────────────────────────────────

  safeHandle('supplier-credits:list', (_event, params?: { search?: string; page?: number; limit?: number }) => {
    const limit = Math.min(Math.max(1, params?.limit ?? 50), 200);
    const page = Math.max(1, params?.page ?? 1);
    const offset = (page - 1) * limit;

    let whereClauses = 'sc.deleted_at IS NULL';
    const bindings: unknown[] = [];
    if (params?.search) {
      whereClauses += ` AND (sc.id LIKE ? ESCAPE '\\' OR s.code LIKE ? ESCAPE '\\' OR sc.designation LIKE ? ESCAPE '\\' OR sc.date LIKE ? ESCAPE '\\' OR CAST(sc.total_amount AS TEXT) LIKE ? ESCAPE '\\')`;
      const s = `%${escapeLike(params.search)}%`;
      bindings.push(s, s, s, s, s);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM supplier_credits sc LEFT JOIN suppliers s ON sc.supplier_id = s.id WHERE ${whereClauses}`).get(...bindings) as { total: number };

    const credits = db.prepare(`
      SELECT sc.*, COALESCE(s.code, '[Supprimé]') as supplier_code,
        COALESCE((SELECT SUM(amount) FROM supplier_credit_payments WHERE supplier_credit_id = sc.id AND deleted_at IS NULL), 0) as total_payments
      FROM supplier_credits sc
      LEFT JOIN suppliers s ON sc.supplier_id = s.id
      WHERE ${whereClauses}
      ORDER BY sc.date DESC
      LIMIT ? OFFSET ?
    `).all(...bindings, limit, offset) as Array<Record<string, unknown>>;

    // Batch-fetch all payments for active credits in one query
    const creditIds = credits.map(c => c['id'] as string);
    const paymentsMap = new Map<string, Array<Record<string, unknown>>>();
    if (creditIds.length > 0) {
      const allPayments = db.prepare(`SELECT id, date, amount, supplier_credit_id FROM supplier_credit_payments WHERE supplier_credit_id IN (${creditIds.map(() => '?').join(',')}) AND deleted_at IS NULL ORDER BY date ASC`).all(...creditIds) as Array<Record<string, unknown>>;
      for (const p of allPayments) {
        const cid = p['supplier_credit_id'] as string;
        if (!paymentsMap.has(cid)) paymentsMap.set(cid, []);
        paymentsMap.get(cid)!.push({ id: p['id'], date: p['date'], amount: p['amount'] });
      }
    }

    const items = credits.map((c) => ({
      ...c,
      remainingBalance: (c['total_amount'] as number) - (c['advance_paid'] as number) - (c['total_payments'] as number),
      payments: paymentsMap.get(c['id'] as string) || [],
    }));

    return { items, total: countResult.total, page, limit };
  });

  safeHandle('supplier-credits:history', (_event, supplierCode: string) => {
    if (!supplierCode || typeof supplierCode !== 'string') throw new Error('Code fournisseur requis');
    const credits = db.prepare(`
      SELECT sc.*, COALESCE(s.code, '[Supprimé]') as supplier_code,
        COALESCE((SELECT SUM(amount) FROM supplier_credit_payments WHERE supplier_credit_id = sc.id AND deleted_at IS NULL), 0) as total_payments
      FROM supplier_credits sc
      LEFT JOIN suppliers s ON sc.supplier_id = s.id
      WHERE sc.deleted_at IS NULL AND s.code = ?
      ORDER BY sc.date DESC
    `).all(supplierCode) as Array<Record<string, unknown>>;
    const creditIds = credits.map(c => c['id'] as string);
    const paymentsMap = new Map<string, Array<Record<string, unknown>>>();
    if (creditIds.length > 0) {
      const allPayments = db.prepare(`SELECT id, date, amount, supplier_credit_id FROM supplier_credit_payments WHERE supplier_credit_id IN (${creditIds.map(() => '?').join(',')}) AND deleted_at IS NULL ORDER BY date ASC`).all(...creditIds) as Array<Record<string, unknown>>;
      for (const p of allPayments) {
        const cid = p['supplier_credit_id'] as string;
        if (!paymentsMap.has(cid)) paymentsMap.set(cid, []);
        paymentsMap.get(cid)!.push({ id: p['id'], date: p['date'], amount: p['amount'] });
      }
    }
    return credits.map((c) => ({
      ...c,
      remainingBalance: (c['total_amount'] as number) - (c['advance_paid'] as number) - (c['total_payments'] as number),
      payments: paymentsMap.get(c['id'] as string) || [],
    }));
  });

  // ─── Credit Payments ─────────────────────────────────────────────

  safeHandle('customer-credits:add-payment', (_event, data: { creditId: string; date: string; amount: number }) => {
    validateDate(data.date, 'Date');
    validatePositive(data.amount, 'Montant');
    const id = uuidv7();
    const now = new Date().toISOString();
    return db.transaction(() => {
      // Check remaining balance to prevent overpayment
      const credit = db.prepare('SELECT quantity, unit_price, advance_paid FROM customer_credits WHERE id = ? AND deleted_at IS NULL').get(data.creditId) as { quantity: number; unit_price: number; advance_paid: number } | undefined;
      if (!credit) throw new Error('Crédit client introuvable');
      const totalAmount = credit.quantity * credit.unit_price;
      const paidSum = (db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM customer_credit_payments WHERE customer_credit_id = ? AND deleted_at IS NULL').get(data.creditId) as { s: number }).s;
      const remaining = totalAmount - credit.advance_paid - paidSum;
      if (data.amount > remaining) throw new Error(`Le paiement (${data.amount}) dépasse le solde restant (${remaining})`);

      db.prepare('INSERT INTO customer_credit_payments (id, date, amount, customer_credit_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, data.date, data.amount, data.creditId, now, now);
      addToOutbox(db, 'customer_credit_payment', id, 'CREATE', {
        id, date: data.date, amount: data.amount, customerCreditId: data.creditId,
      });
      return { id };
    })();
  });

  safeHandle('supplier-credits:add-payment', (_event, data: { creditId: string; date: string; amount: number }) => {
    validateDate(data.date, 'Date');
    validatePositive(data.amount, 'Montant');
    const id = uuidv7();
    const now = new Date().toISOString();
    return db.transaction(() => {
      // Check remaining balance to prevent overpayment
      const credit = db.prepare('SELECT total_amount, advance_paid FROM supplier_credits WHERE id = ? AND deleted_at IS NULL').get(data.creditId) as { total_amount: number; advance_paid: number } | undefined;
      if (!credit) throw new Error('Crédit fournisseur introuvable');
      const paidSum = (db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM supplier_credit_payments WHERE supplier_credit_id = ? AND deleted_at IS NULL').get(data.creditId) as { s: number }).s;
      const remaining = credit.total_amount - credit.advance_paid - paidSum;
      if (data.amount > remaining) throw new Error(`Le paiement (${data.amount}) dépasse le solde restant (${remaining})`);

      db.prepare('INSERT INTO supplier_credit_payments (id, date, amount, supplier_credit_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, data.date, data.amount, data.creditId, now, now);
      addToOutbox(db, 'supplier_credit_payment', id, 'CREATE', {
        id, date: data.date, amount: data.amount, supplierCreditId: data.creditId,
      });
      return { id };
    })();
  });

  safeHandle('customer-credits:delete-payment', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE customer_credit_payments SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Payment ${id} not found`);
      addToOutbox(db, 'customer_credit_payment', id, 'DELETE', { id });
      return { success: true };
    })();
  });

  safeHandle('supplier-credits:delete-payment', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE supplier_credit_payments SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Payment ${id} not found`);
      addToOutbox(db, 'supplier_credit_payment', id, 'DELETE', { id });
      return { success: true };
    })();
  });

  // ─── Bank Movements List ─────────────────────────────────────────

  safeHandle('bank-movements:list', (_event, params?: { search?: string; page?: number; limit?: number }) => {
    const limit = Math.min(Math.max(1, params?.limit ?? 50), 200);
    const page = Math.max(1, params?.page ?? 1);
    const offset = (page - 1) * limit;

    let whereClauses = 'deleted_at IS NULL';
    const bindings: unknown[] = [];
    if (params?.search) {
      whereClauses += ` AND (id LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR date LIKE ? ESCAPE '\\' OR CAST(amount_in AS TEXT) LIKE ? ESCAPE '\\' OR CAST(amount_out AS TEXT) LIKE ? ESCAPE '\\')`;
      const s = `%${escapeLike(params.search)}%`;
      bindings.push(s, s, s, s, s);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM bank_movements WHERE ${whereClauses}`).get(...bindings) as { total: number };
    const items = db.prepare(`SELECT * FROM bank_movements WHERE ${whereClauses} ORDER BY date DESC LIMIT ? OFFSET ?`).all(...bindings, limit, offset);

    return { items, total: countResult.total, page, limit };
  });

  // ─── Dashboard Stats ─────────────────────────────────────────────

  safeHandle('dashboard:stats', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthStart = `${year}-${month}-01`;
    const monthEnd = `${year}-${month}-${String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

    // Stock value — single aggregation query (no row-level load)
    const stockResult = db.prepare(`
      SELECT COALESCE(SUM((pl.initial_quantity - COALESCE(sold.qty, 0) + COALESCE(ret.qty, 0)) * pl.purchase_unit_cost), 0) as stockValue,
        SUM(CASE WHEN (pl.initial_quantity - COALESCE(sold.qty, 0) + COALESCE(ret.qty, 0)) > 0 AND (pl.initial_quantity - COALESCE(sold.qty, 0) + COALESCE(ret.qty, 0)) <= 5 THEN 1 ELSE 0 END) as lowStockAlerts
      FROM purchase_lots pl
      LEFT JOIN (SELECT lot_id, SUM(quantity) as qty FROM sale_lines WHERE deleted_at IS NULL GROUP BY lot_id) sold ON sold.lot_id = pl.id
      LEFT JOIN (SELECT lot_id, SUM(quantity) as qty FROM sale_return_lines WHERE deleted_at IS NULL GROUP BY lot_id) ret ON ret.lot_id = pl.id
      WHERE pl.deleted_at IS NULL
    `).get() as { stockValue: number; lowStockAlerts: number };

    // Monthly sales (subtract sale returns for accurate totals)
    const salesResult = db.prepare(`
      SELECT COALESCE(SUM(sl.quantity * sl.selling_unit_price), 0) as total,
        COALESCE(SUM((sl.selling_unit_price - pl.purchase_unit_cost) * sl.quantity), 0) as margin
      FROM sale_lines sl
      JOIN sale_orders so ON sl.sale_order_id = so.id
      JOIN purchase_lots pl ON sl.lot_id = pl.id
      WHERE so.date >= ? AND so.date <= ? AND so.deleted_at IS NULL AND sl.deleted_at IS NULL
    `).get(monthStart, monthEnd) as { total: number; margin: number };

    // Monthly sale returns (deducted from sales)
    const returnsResult = db.prepare(`
      SELECT COALESCE(SUM(srl.quantity * srl.selling_unit_price), 0) as total,
        COALESCE(SUM((srl.selling_unit_price - pl.purchase_unit_cost) * srl.quantity), 0) as margin
      FROM sale_return_lines srl
      JOIN sale_returns sr ON srl.sale_return_id = sr.id
      JOIN purchase_lots pl ON srl.lot_id = pl.id
      WHERE sr.date >= ? AND sr.date <= ? AND sr.deleted_at IS NULL AND srl.deleted_at IS NULL
    `).get(monthStart, monthEnd) as { total: number; margin: number };

    const netSalesTotal = salesResult.total - returnsResult.total;
    const netSalesMargin = salesResult.margin - returnsResult.margin;

    // Monthly maintenance
    const maintResult = db.prepare(`
      SELECT COALESCE(SUM(price), 0) as total FROM maintenance_jobs WHERE date >= ? AND date <= ? AND deleted_at IS NULL
    `).get(monthStart, monthEnd) as { total: number };

    // Monthly expenses
    const expenseResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date <= ? AND deleted_at IS NULL
    `).get(monthStart, monthEnd) as { total: number };

    // Active credits
    const customerCredits = db.prepare(`
      SELECT COUNT(*) as count FROM customer_credits cc
      WHERE cc.deleted_at IS NULL AND
        (cc.quantity * cc.unit_price) - cc.advance_paid -
        COALESCE((SELECT SUM(amount) FROM customer_credit_payments WHERE customer_credit_id = cc.id AND deleted_at IS NULL), 0) > 0
    `).get() as { count: number };

    const result = {
      stockValue: stockResult.stockValue,
      monthlySales: netSalesTotal,
      monthlyMargin: netSalesMargin,
      monthlyMaintenance: maintResult.total,
      monthlyExpenses: expenseResult.total,
      lowStockAlerts: stockResult.lowStockAlerts,
      activeCredits: customerCredits.count,
    };
    return result;
  });

  // ─── Monthly Summary ─────────────────────────────────────────────

  safeHandle('monthly-summary:get', (_event, params: { year: number }) => {
    const year = params.year;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Année invalide');
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Single query per table with GROUP BY month instead of 12 loops × 5 queries
    const salesByMonth = db.prepare(`
      SELECT CAST(strftime('%m', so.date) AS INTEGER) as month,
        COALESCE(SUM(sl.quantity * sl.selling_unit_price), 0) as total,
        COALESCE(SUM(sl.quantity * pl.purchase_unit_cost), 0) as cost,
        COALESCE(SUM((sl.selling_unit_price - pl.purchase_unit_cost) * sl.quantity), 0) as margin
      FROM sale_lines sl
      JOIN sale_orders so ON sl.sale_order_id = so.id
      JOIN purchase_lots pl ON sl.lot_id = pl.id
      WHERE so.date >= ? AND so.date <= ? AND so.deleted_at IS NULL AND sl.deleted_at IS NULL
      GROUP BY month
    `).all(yearStart, yearEnd) as Array<{ month: number; total: number; cost: number; margin: number }>;

    // Sale returns by month (to deduct from sales)
    const returnsByMonth = db.prepare(`
      SELECT CAST(strftime('%m', sr.date) AS INTEGER) as month,
        COALESCE(SUM(srl.quantity * srl.selling_unit_price), 0) as total,
        COALESCE(SUM(srl.quantity * pl.purchase_unit_cost), 0) as cost,
        COALESCE(SUM((srl.selling_unit_price - pl.purchase_unit_cost) * srl.quantity), 0) as margin
      FROM sale_return_lines srl
      JOIN sale_returns sr ON srl.sale_return_id = sr.id
      JOIN purchase_lots pl ON srl.lot_id = pl.id
      WHERE sr.date >= ? AND sr.date <= ? AND sr.deleted_at IS NULL AND srl.deleted_at IS NULL
      GROUP BY month
    `).all(yearStart, yearEnd) as Array<{ month: number; total: number; cost: number; margin: number }>;
    const returnsMap = new Map(returnsByMonth.map(r => [r.month, r]));

    const purchasesByMonth = db.prepare(`
      SELECT CAST(strftime('%m', date) AS INTEGER) as month,
        COALESCE(SUM(initial_quantity * purchase_unit_cost), 0) as total
      FROM purchase_lots WHERE date >= ? AND date <= ? AND deleted_at IS NULL
      GROUP BY month
    `).all(yearStart, yearEnd) as Array<{ month: number; total: number }>;

    const maintByMonth = db.prepare(`
      SELECT CAST(strftime('%m', date) AS INTEGER) as month,
        COALESCE(SUM(price), 0) as total
      FROM maintenance_jobs WHERE date >= ? AND date <= ? AND deleted_at IS NULL
      GROUP BY month
    `).all(yearStart, yearEnd) as Array<{ month: number; total: number }>;

    const batteryByMonth = db.prepare(`
      SELECT CAST(strftime('%m', date) AS INTEGER) as month,
        COALESCE(SUM(amount), 0) as total
      FROM battery_repair_jobs WHERE date >= ? AND date <= ? AND deleted_at IS NULL
      GROUP BY month
    `).all(yearStart, yearEnd) as Array<{ month: number; total: number }>;

    const expensesByMonth = db.prepare(`
      SELECT CAST(strftime('%m', date) AS INTEGER) as month,
        COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE date >= ? AND date <= ? AND deleted_at IS NULL
      GROUP BY month
    `).all(yearStart, yearEnd) as Array<{ month: number; total: number }>;

    // Customer credits: amount given (quantity*unit_price) and payments received
    const custCreditsByMonth = db.prepare(`
      SELECT CAST(strftime('%m', date) AS INTEGER) as month,
        COALESCE(SUM(quantity * unit_price), 0) as given,
        COALESCE(SUM(advance_paid), 0) as advances
      FROM customer_credits WHERE date >= ? AND date <= ? AND deleted_at IS NULL
      GROUP BY month
    `).all(yearStart, yearEnd) as Array<{ month: number; given: number; advances: number }>;

    const custPaymentsByMonth = db.prepare(`
      SELECT CAST(strftime('%m', p.date) AS INTEGER) as month,
        COALESCE(SUM(p.amount), 0) as total
      FROM customer_credit_payments p
      JOIN customer_credits cc ON p.customer_credit_id = cc.id
      WHERE p.date >= ? AND p.date <= ? AND p.deleted_at IS NULL AND cc.deleted_at IS NULL
      GROUP BY month
    `).all(yearStart, yearEnd) as Array<{ month: number; total: number }>;

    // Supplier credits: amount owed and payments made
    const suppCreditsByMonth = db.prepare(`
      SELECT CAST(strftime('%m', date) AS INTEGER) as month,
        COALESCE(SUM(total_amount), 0) as received,
        COALESCE(SUM(advance_paid), 0) as advances
      FROM supplier_credits WHERE date >= ? AND date <= ? AND deleted_at IS NULL
      GROUP BY month
    `).all(yearStart, yearEnd) as Array<{ month: number; received: number; advances: number }>;

    const suppPaymentsByMonth = db.prepare(`
      SELECT CAST(strftime('%m', p.date) AS INTEGER) as month,
        COALESCE(SUM(p.amount), 0) as total
      FROM supplier_credit_payments p
      JOIN supplier_credits sc ON p.supplier_credit_id = sc.id
      WHERE p.date >= ? AND p.date <= ? AND p.deleted_at IS NULL AND sc.deleted_at IS NULL
      GROUP BY month
    `).all(yearStart, yearEnd) as Array<{ month: number; total: number }>;

    // Index by month for O(1) lookup
    const salesMap = new Map(salesByMonth.map(r => [r.month, r]));
    const purchasesMap = new Map(purchasesByMonth.map(r => [r.month, r.total]));
    const maintMap = new Map(maintByMonth.map(r => [r.month, r.total]));
    const batteryMap = new Map(batteryByMonth.map(r => [r.month, r.total]));
    const expensesMap = new Map(expensesByMonth.map(r => [r.month, r.total]));
    const custCreditsMap = new Map(custCreditsByMonth.map(r => [r.month, r]));
    const custPaymentsMap = new Map(custPaymentsByMonth.map(r => [r.month, r.total]));
    const suppCreditsMap = new Map(suppCreditsByMonth.map(r => [r.month, r]));
    const suppPaymentsMap = new Map(suppPaymentsByMonth.map(r => [r.month, r.total]));

    const months: Array<Record<string, number>> = [];
    for (let m = 1; m <= 12; m++) {
      const s = salesMap.get(m) || { total: 0, cost: 0, margin: 0 };
      const r = returnsMap.get(m) || { total: 0, cost: 0, margin: 0 };
      const purchaseTotal = purchasesMap.get(m) || 0;
      const maintenanceTotal = maintMap.get(m) || 0;
      const batteryTotal = batteryMap.get(m) || 0;
      const expenseTotal = expensesMap.get(m) || 0;
      const cc = custCreditsMap.get(m) || { given: 0, advances: 0 };
      const custPayments = custPaymentsMap.get(m) || 0;
      const sc = suppCreditsMap.get(m) || { received: 0, advances: 0 };
      const suppPayments = suppPaymentsMap.get(m) || 0;

      const customerCreditsGiven = cc.given;
      const customerCreditsReceived = cc.advances + custPayments;
      const supplierCreditsReceived = sc.received;
      const supplierCreditsPaid = sc.advances + suppPayments;

      // Net sales = gross sales - returns
      const netSalesTotal = s.total - r.total;
      const netSalesCost = s.cost - r.cost;
      const netSalesMargin = s.margin - r.margin;

      months.push({
        month: m,
        purchaseTotal,
        salesTotal: netSalesTotal,
        salesCost: netSalesCost,
        salesMargin: netSalesMargin,
        maintenanceTotal,
        batteryTotal,
        expenseTotal,
        customerCreditsGiven,
        customerCreditsReceived,
        supplierCreditsReceived,
        supplierCreditsPaid,
        marginRate: netSalesTotal > 0 ? Math.round(((netSalesTotal - netSalesCost) / netSalesTotal) * 10000) / 10000 : 0,
        totalRevenue: netSalesMargin + maintenanceTotal + batteryTotal,
        profit: netSalesMargin + maintenanceTotal + batteryTotal - expenseTotal,
      });
    }

    return { year, months };
  });

  // ─── Stock Alerts ────────────────────────────────────────────────

  safeHandle('stock:low-stock-alerts', () => {
    return db.prepare(`
      SELECT pl.id, pl.designation, COALESCE(c.name, '[Supprimé]') as category,
        (pl.initial_quantity - COALESCE(sold.qty, 0) + COALESCE(ret.qty, 0)) as remaining
      FROM purchase_lots pl
      LEFT JOIN categories c ON pl.category_id = c.id
      LEFT JOIN (SELECT lot_id, SUM(quantity) as qty FROM sale_lines WHERE deleted_at IS NULL GROUP BY lot_id) sold ON sold.lot_id = pl.id
      LEFT JOIN (SELECT lot_id, SUM(quantity) as qty FROM sale_return_lines WHERE deleted_at IS NULL GROUP BY lot_id) ret ON ret.lot_id = pl.id
      WHERE pl.deleted_at IS NULL
        AND (pl.initial_quantity - COALESCE(sold.qty, 0) + COALESCE(ret.qty, 0)) > 0
        AND (pl.initial_quantity - COALESCE(sold.qty, 0) + COALESCE(ret.qty, 0)) <= 5
      ORDER BY remaining ASC
    `).all();
  });

  // ─── Notifications: Unpaid Credits ───────────────────────────────

  safeHandle('notifications:unpaid-customer-credits', () => {
    return db.prepare(`
      SELECT cc.id, cc.date, cc.customer_name as name, cc.designation,
        (cc.quantity * cc.unit_price) as totalAmount,
        (cc.quantity * cc.unit_price) - cc.advance_paid -
          COALESCE((SELECT SUM(amount) FROM customer_credit_payments WHERE customer_credit_id = cc.id AND deleted_at IS NULL), 0) as remainingBalance
      FROM customer_credits cc
      WHERE cc.deleted_at IS NULL
        AND (cc.quantity * cc.unit_price) - cc.advance_paid -
          COALESCE((SELECT SUM(amount) FROM customer_credit_payments WHERE customer_credit_id = cc.id AND deleted_at IS NULL), 0) > 0
      ORDER BY cc.date ASC
    `).all();
  });

  safeHandle('notifications:unpaid-supplier-credits', () => {
    return db.prepare(`
      SELECT sc.id, sc.date, COALESCE(s.code, '[Supprimé]') as name, sc.designation,
        sc.total_amount as totalAmount,
        sc.total_amount - sc.advance_paid -
          COALESCE((SELECT SUM(amount) FROM supplier_credit_payments WHERE supplier_credit_id = sc.id AND deleted_at IS NULL), 0) as remainingBalance
      FROM supplier_credits sc
      LEFT JOIN suppliers s ON sc.supplier_id = s.id
      WHERE sc.deleted_at IS NULL
        AND sc.total_amount - sc.advance_paid -
          COALESCE((SELECT SUM(amount) FROM supplier_credit_payments WHERE supplier_credit_id = sc.id AND deleted_at IS NULL), 0) > 0
      ORDER BY sc.date ASC
    `).all();
  });

  // ─── Zakat ───────────────────────────────────────────────────────

  safeHandle('zakat:compute', (_event, params: { year: number; cashAtClosing?: number }) => {
    if (!Number.isInteger(params.year) || params.year < 2000 || params.year > 2100) throw new Error('Année invalide');
    const cutoff = `${params.year}-12-31`;

    // Stock value at closing (lots purchased on/before cutoff, sales on/before cutoff)
    const stockRows = db.prepare(`
      SELECT pl.initial_quantity, pl.purchase_unit_cost,
        COALESCE((SELECT SUM(sl.quantity) FROM sale_lines sl
          JOIN sale_orders so ON sl.sale_order_id = so.id
          WHERE sl.lot_id = pl.id AND sl.deleted_at IS NULL AND so.deleted_at IS NULL AND so.date <= ?), 0) as sold,
        COALESCE((SELECT SUM(srl.quantity) FROM sale_return_lines srl
          JOIN sale_returns sr ON srl.sale_return_id = sr.id
          WHERE srl.lot_id = pl.id AND srl.deleted_at IS NULL AND sr.deleted_at IS NULL AND sr.date <= ?), 0) as returned
      FROM purchase_lots pl WHERE pl.deleted_at IS NULL AND pl.date <= ?
    `).all(cutoff, cutoff, cutoff) as Array<{ initial_quantity: number; purchase_unit_cost: number; sold: number; returned: number }>;
    const closingStockValue = stockRows.reduce((sum, r) => sum + (r.initial_quantity - r.sold + r.returned) * r.purchase_unit_cost, 0);

    // Bank balance at closing
    const bankResult = db.prepare('SELECT COALESCE(SUM(amount_in), 0) as total_in, COALESCE(SUM(amount_out), 0) as total_out FROM bank_movements WHERE deleted_at IS NULL AND date <= ?').get(cutoff) as { total_in: number; total_out: number };
    const closingBankBalance = bankResult.total_in - bankResult.total_out;

    const closingCash = params.cashAtClosing ?? 0;

    // Customer credit balance at closing (money owed TO us, not yet collected)
    const customerCreditBalance = db.prepare(`
      SELECT COALESCE(SUM(
        (cc.quantity * cc.unit_price) - cc.advance_paid -
        COALESCE((SELECT SUM(amount) FROM customer_credit_payments WHERE customer_credit_id = cc.id AND deleted_at IS NULL AND date <= ?), 0)
      ), 0) as total
      FROM customer_credits cc WHERE cc.deleted_at IS NULL AND cc.date <= ?
    `).get(cutoff, cutoff) as { total: number };

    // Supplier credit balance at closing (money WE owe = liability)
    const supplierCreditBalance = db.prepare(`
      SELECT COALESCE(SUM(
        sc.total_amount - sc.advance_paid -
        COALESCE((SELECT SUM(amount) FROM supplier_credit_payments WHERE supplier_credit_id = sc.id AND deleted_at IS NULL AND date <= ?), 0)
      ), 0) as total
      FROM supplier_credits sc WHERE sc.deleted_at IS NULL AND sc.date <= ?
    `).get(cutoff, cutoff) as { total: number };

    const totalAssets = closingStockValue + closingBankBalance + closingCash;
    const zakatBase = totalAssets + customerCreditBalance.total - supplierCreditBalance.total;
    const zakatRate = 0.025;
    const zakatDue = Math.round(Math.max(0, zakatBase) * zakatRate);

    // Previous advances
    const advances = db.prepare(`
      SELECT * FROM zakat_advances WHERE year = ? AND deleted_at IS NULL ORDER BY date ASC
    `).all(params.year) as Array<Record<string, unknown>>;
    const advanceTotal = advances.reduce((sum, a) => sum + (a['amount'] as number), 0);

    return {
      year: params.year,
      closingStockValue,
      closingBankBalance,
      closingCash,
      totalAssets,
      clientCreditDeduction: customerCreditBalance.total,
      supplierCreditDeduction: supplierCreditBalance.total,
      zakatBase,
      zakatRate,
      zakatDue,
      advanceTotal,
      zakatRemaining: zakatDue - advanceTotal,
      advances,
    };
  });

  safeHandle('zakat:save-advance', (_event, data: { year: number; date: string; amount: number; note?: string }) => {
    if (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100) throw new Error('Année invalide');
    validateDate(data.date, 'Date');
    validatePositive(data.amount, 'Montant');
    const id = uuidv7();
    const now = new Date().toISOString();
    return db.transaction(() => {
      db.prepare('INSERT INTO zakat_advances (id, year, date, amount, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, data.year, data.date, data.amount, data.note ?? null, now, now);
      addToOutbox(db, 'zakat_advance', id, 'CREATE', {
        id, year: data.year, date: data.date,
        amount: data.amount, note: data.note ?? null,
      });
      return { id };
    })();
  });

  safeHandle('zakat:delete-advance', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE zakat_advances SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Zakat advance ${id} not found`);
      addToOutbox(db, 'zakat_advance', id, 'DELETE', { id });
      return { ok: true };
    })();
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE / DELETE handlers
  // ═══════════════════════════════════════════════════════════════════

  // ─── Purchases Update / Delete ───────────────────────────────────

  safeHandle('purchases:update', (_event, data: {
    id: string; date: string; category: string; designation: string; supplier?: string;
    boutique: string; initialQuantity: number; purchaseUnitCost: number;
    targetResalePrice: number | null; blockPrice: number | null;
    sellingPrice: number | null; subCategory: string | null;
    barcode?: string;
  }) => {
    validateDate(data.date, 'Date');
    validateString(data.category, 'Catégorie');
    validateString(data.designation, 'Désignation');
    if (data.supplier) validateString(data.supplier, 'Fournisseur');
    validateString(data.boutique, 'Boutique');
    validatePositive(data.initialQuantity, 'Quantité');
    if (data.purchaseUnitCost > 0) validatePositive(data.purchaseUnitCost, 'Coût unitaire');
    if (data.targetResalePrice != null) validatePositive(data.targetResalePrice, 'Prix de revente');
    if (data.blockPrice != null) validatePositive(data.blockPrice, 'Prix bloc');
    if (data.sellingPrice != null) validatePositive(data.sellingPrice, 'Prix de vente');
    const now = new Date().toISOString();
    return db.transaction(() => {
      let category = db.prepare('SELECT id FROM categories WHERE name = ? AND deleted_at IS NULL').get(data.category) as { id: string } | undefined;
      let supplier = data.supplier ? db.prepare('SELECT id FROM suppliers WHERE code = ? AND deleted_at IS NULL').get(data.supplier) as { id: string } | undefined : undefined;
      let boutique = db.prepare('SELECT id FROM boutiques WHERE name = ? AND deleted_at IS NULL').get(data.boutique) as { id: string } | undefined;
      if (!category) {
        const catId = uuidv7();
        db.prepare('INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(catId, data.category.trim(), now, now);
        addToOutbox(db, 'category', catId, 'CREATE', { id: catId, name: data.category.trim() });
        category = { id: catId };
      }
      if (data.supplier && data.supplier.trim()) {
        if (!supplier) {
          const supId = uuidv7();
          db.prepare('INSERT INTO suppliers (id, code, created_at, updated_at) VALUES (?, ?, ?, ?)').run(supId, data.supplier.trim(), now, now);
          addToOutbox(db, 'supplier', supId, 'CREATE', { id: supId, code: data.supplier.trim() });
          supplier = { id: supId };
        }
      } else {
        // Keep existing supplier_id when not provided (non-admin edit)
        const existing = db.prepare('SELECT supplier_id FROM purchase_lots WHERE id = ?').get(data.id) as { supplier_id: string } | undefined;
        supplier = existing ? { id: existing.supplier_id } : undefined;
        if (!supplier) {
          supplier = db.prepare("SELECT id FROM suppliers WHERE code = '—' AND deleted_at IS NULL").get() as { id: string } | undefined;
          if (!supplier) {
            const supId = uuidv7();
            db.prepare("INSERT INTO suppliers (id, code, created_at, updated_at) VALUES (?, '—', ?, ?)").run(supId, now, now);
            addToOutbox(db, 'supplier', supId, 'CREATE', { id: supId, code: '—' });
            supplier = { id: supId };
          }
        }
      }
      if (!boutique) {
        const boutId = uuidv7();
        db.prepare('INSERT INTO boutiques (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(boutId, data.boutique.trim(), now, now);
        addToOutbox(db, 'boutique', boutId, 'CREATE', { id: boutId, name: data.boutique.trim() });
        boutique = { id: boutId };
      }

      // Resolve sub-category
      let subCategoryId: string | null = null;
      if (data.subCategory && data.subCategory.trim()) {
        const trimmedSub = data.subCategory.trim();
        let subCat = db.prepare('SELECT id FROM sub_categories WHERE name = ? AND category_id = ? AND deleted_at IS NULL').get(trimmedSub, category.id) as { id: string } | undefined;
        if (!subCat) {
          subCategoryId = uuidv7();
          db.prepare('INSERT INTO sub_categories (id, name, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(subCategoryId, trimmedSub, category.id, now, now);
          addToOutbox(db, 'sub_category', subCategoryId, 'CREATE', { id: subCategoryId, name: trimmedSub, categoryId: category.id });
        } else {
          subCategoryId = subCat.id;
        }
      }

      // Ensure new initialQuantity is not below already-sold quantity
      const soldResult = db.prepare('SELECT COALESCE(SUM(quantity), 0) as sold FROM sale_lines WHERE lot_id = ? AND deleted_at IS NULL').get(data.id) as { sold: number };
      const returnedResult = db.prepare('SELECT COALESCE(SUM(quantity), 0) as returned FROM sale_return_lines WHERE lot_id = ? AND deleted_at IS NULL').get(data.id) as { returned: number };
      const netSold = soldResult.sold - returnedResult.returned;
      if (data.initialQuantity < netSold) {
        throw new Error(`La quantité initiale (${data.initialQuantity}) ne peut pas être inférieure à la quantité déjà vendue (${netSold})`);
      }
      const result = db.prepare(`
        UPDATE purchase_lots SET date=?, designation=?, initial_quantity=?, purchase_unit_cost=?, target_resale_price=?, block_price=?,
          selling_price=?, category_id=?, supplier_id=?, boutique_id=?, sub_category_id=?, barcode=?, updated_at=?
        WHERE id=? AND deleted_at IS NULL
      `).run(data.date, data.designation.trim(), data.initialQuantity, data.purchaseUnitCost, data.targetResalePrice, data.blockPrice ?? null,
        data.sellingPrice ?? null, category.id, supplier.id, boutique.id, subCategoryId, data.barcode?.trim() || null, now, data.id);
      if (result.changes === 0) throw new Error(`Purchase lot ${data.id} not found`);
      const existingLot = db.prepare('SELECT ref_number FROM purchase_lots WHERE id = ?').get(data.id) as { ref_number: string };
      addToOutbox(db, 'purchase_lot', data.id, 'UPDATE', {
        id: data.id, refNumber: existingLot.ref_number, date: data.date, designation: data.designation.trim(),
        initialQuantity: data.initialQuantity, purchaseUnitCost: data.purchaseUnitCost,
        targetResalePrice: data.targetResalePrice, blockPrice: data.blockPrice ?? null,
        sellingPrice: data.sellingPrice ?? null,
        categoryId: category.id, supplierId: supplier.id, boutiqueId: boutique.id,
        subCategoryId,
        barcode: data.barcode?.trim() || null,
      });
      return { success: true };
    })();
  });

  safeHandle('purchases:delete', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      // Block deletion if there are active sales referencing this lot
      const activeSales = db.prepare('SELECT COUNT(*) as c FROM sale_lines WHERE lot_id = ? AND deleted_at IS NULL').get(id) as { c: number };
      if (activeSales.c > 0) throw new Error('Impossible de supprimer: ce lot a des ventes actives');

      const result = db.prepare('UPDATE purchase_lots SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Purchase lot ${id} not found`);
      addToOutbox(db, 'purchase_lot', id, 'DELETE', { id });
      return { success: true };
    })();
  });

  // ─── Maintenance Update / Delete ─────────────────────────────────

  safeHandle('maintenance:update', (_event, data: { id: string; date: string; designation: string; price: number; boutique: string }) => {
    validateDate(data.date, 'Date');
    validateString(data.designation, 'Désignation');
    validatePositive(data.price, 'Prix');
    validateString(data.boutique, 'Boutique');
    const now = new Date().toISOString();
    return db.transaction(() => {
      let boutique = db.prepare('SELECT id FROM boutiques WHERE name = ? AND deleted_at IS NULL').get(data.boutique) as { id: string } | undefined;
      if (!boutique) {
        const boutId = uuidv7();
        db.prepare('INSERT INTO boutiques (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(boutId, data.boutique.trim(), now, now);
        addToOutbox(db, 'boutique', boutId, 'CREATE', { id: boutId, name: data.boutique.trim() });
        boutique = { id: boutId };
      }
      // Upsert designation into maintenance_service_types for autocomplete
      const trimmedDesig = data.designation.trim();
      const existingType = db.prepare('SELECT id FROM maintenance_service_types WHERE name = ? AND deleted_at IS NULL').get(trimmedDesig) as { id: string } | undefined;
      if (!existingType) {
        const typeId = uuidv7();
        const ins = db.prepare('INSERT OR IGNORE INTO maintenance_service_types (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(typeId, trimmedDesig, now, now);
        if (ins.changes > 0) {
          addToOutbox(db, 'maintenance_service_type', typeId, 'CREATE', { id: typeId, name: trimmedDesig });
        }
      }
      const result = db.prepare('UPDATE maintenance_jobs SET date=?, designation=?, price=?, boutique_id=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(data.date, trimmedDesig, data.price, boutique.id, now, data.id);
      if (result.changes === 0) throw new Error(`Maintenance job ${data.id} not found`);
      addToOutbox(db, 'maintenance_job', data.id, 'UPDATE', {
        id: data.id, date: data.date, designation: trimmedDesig,
        price: data.price, boutiqueId: boutique.id,
      });
      return { success: true };
    })();
  });

  safeHandle('maintenance:delete', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE maintenance_jobs SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Maintenance job ${id} not found`);
      addToOutbox(db, 'maintenance_job', id, 'DELETE', { id });
      return { success: true };
    })();
  });

  // ─── Battery Repair Update / Delete ──────────────────────────────

  safeHandle('battery-repair:update', (_event, data: { id: string; date: string; description: string; customerNote?: string; amount: number; costAdjustment?: number }) => {
    validateDate(data.date, 'Date');
    validateString(data.description, 'Description');
    validatePositive(data.amount, 'Montant');
    if (data.costAdjustment != null && data.costAdjustment !== 0) validateAmount(data.costAdjustment, 'Ajustement coût');
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE battery_repair_jobs SET date=?, description=?, customer_note=?, amount=?, cost_adjustment=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(data.date, data.description.trim(), data.customerNote ?? null, data.amount, data.costAdjustment ?? 0, now, data.id);
      if (result.changes === 0) throw new Error(`Battery repair job ${data.id} not found`);
      addToOutbox(db, 'battery_repair_job', data.id, 'UPDATE', {
        id: data.id, date: data.date, description: data.description.trim(),
        customerNote: data.customerNote ?? null, amount: data.amount,
        costAdjustment: data.costAdjustment ?? 0,
      });
      return { success: true };
    })();
  });

  safeHandle('battery-repair:delete', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE battery_repair_jobs SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Battery repair job ${id} not found`);
      addToOutbox(db, 'battery_repair_job', id, 'DELETE', { id });
      return { success: true };
    })();
  });

  // ─── Expenses Update / Delete ────────────────────────────────────

  safeHandle('expenses:update', (_event, data: { id: string; date: string; designation: string; amount: number; boutique: string }) => {
    validateDate(data.date, 'Date');
    validateString(data.designation, 'Désignation');
    validatePositive(data.amount, 'Montant');
    validateString(data.boutique, 'Boutique');
    const now = new Date().toISOString();
    return db.transaction(() => {
      let boutique = db.prepare('SELECT id FROM boutiques WHERE name = ? AND deleted_at IS NULL').get(data.boutique) as { id: string } | undefined;
      if (!boutique) {
        const boutId = uuidv7();
        db.prepare('INSERT INTO boutiques (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(boutId, data.boutique.trim(), now, now);
        addToOutbox(db, 'boutique', boutId, 'CREATE', { id: boutId, name: data.boutique.trim() });
        boutique = { id: boutId };
      }
      // Upsert designation into expense_designations for autocomplete
      const trimmedDesig = data.designation.trim();
      const existingDesig = db.prepare('SELECT id FROM expense_designations WHERE name = ? AND deleted_at IS NULL').get(trimmedDesig) as { id: string } | undefined;
      if (!existingDesig) {
        const desigId = uuidv7();
        const ins = db.prepare('INSERT OR IGNORE INTO expense_designations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(desigId, trimmedDesig, now, now);
        if (ins.changes > 0) {
          addToOutbox(db, 'expense_designation', desigId, 'CREATE', { id: desigId, name: trimmedDesig });
        }
      }
      const result = db.prepare('UPDATE expenses SET date=?, designation=?, amount=?, boutique_id=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(data.date, trimmedDesig, data.amount, boutique.id, now, data.id);
      if (result.changes === 0) throw new Error(`Expense ${data.id} not found`);
      addToOutbox(db, 'expense', data.id, 'UPDATE', {
        id: data.id, date: data.date, designation: trimmedDesig,
        amount: data.amount, boutiqueId: boutique.id,
      });
      return { success: true };
    })();
  });

  safeHandle('expenses:delete', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE expenses SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Expense ${id} not found`);
      addToOutbox(db, 'expense', id, 'DELETE', { id });
      return { success: true };
    })();
  });

  // ─── Customer Credits Update / Delete ────────────────────────────

  safeHandle('customer-credits:update', (_event, data: { id: string; date: string; customerName: string; designation: string; quantity: number; unitPrice: number; advancePaid?: number }) => {
    validateDate(data.date, 'Date');
    validateString(data.customerName, 'Nom client');
    validateString(data.designation, 'Désignation');
    validatePositive(data.quantity, 'Quantité');
    validatePositive(data.unitPrice, 'Prix unitaire');
    if (data.advancePaid != null && data.advancePaid !== 0) {
      validateAmount(data.advancePaid, 'Avance');
      if (data.advancePaid > data.quantity * data.unitPrice) throw new Error('L\'avance ne peut pas dépasser le total');
    }
    const now = new Date().toISOString();
    return db.transaction(() => {
      // Check that new total >= advance + already paid
      const newTotal = data.quantity * data.unitPrice;
      const paidRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as paid FROM customer_credit_payments WHERE customer_credit_id = ? AND deleted_at IS NULL').get(data.id) as { paid: number };
      const advancePaid = data.advancePaid ?? 0;
      if (newTotal < advancePaid + paidRow.paid) throw new Error('Le nouveau total ne peut pas être inférieur aux paiements déjà effectués');
      const result = db.prepare('UPDATE customer_credits SET date=?, customer_name=?, designation=?, quantity=?, unit_price=?, advance_paid=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(data.date, data.customerName.trim(), data.designation.trim(), data.quantity, data.unitPrice, data.advancePaid ?? 0, now, data.id);
      if (result.changes === 0) throw new Error(`Customer credit ${data.id} not found`);
      addToOutbox(db, 'customer_credit', data.id, 'UPDATE', {
        id: data.id, date: data.date, customerName: data.customerName.trim(),
        designation: data.designation.trim(), quantity: data.quantity,
        unitPrice: data.unitPrice, advancePaid: data.advancePaid ?? 0,
      });
      return { success: true };
    })();
  });

  safeHandle('customer-credits:delete', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const payments = db.prepare('SELECT id FROM customer_credit_payments WHERE customer_credit_id=? AND deleted_at IS NULL').all(id) as Array<{id: string}>;
      db.prepare('UPDATE customer_credit_payments SET deleted_at=?, updated_at=? WHERE customer_credit_id=? AND deleted_at IS NULL').run(now, now, id);
      for (const p of payments) {
        addToOutbox(db, 'customer_credit_payment', p.id, 'DELETE', { id: p.id });
      }
      const result = db.prepare('UPDATE customer_credits SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Customer credit ${id} not found`);
      addToOutbox(db, 'customer_credit', id, 'DELETE', { id });
      return { success: true };
    })();
  });

  // ─── Supplier Credits Update / Delete ────────────────────────────

  safeHandle('supplier-credits:update', (_event, data: { id: string; date: string; supplier: string; designation: string; totalAmount: number; advancePaid?: number }) => {
    validateDate(data.date, 'Date');
    validateString(data.supplier, 'Fournisseur');
    validateString(data.designation, 'Désignation');
    validatePositive(data.totalAmount, 'Montant total');
    if (data.advancePaid != null && data.advancePaid !== 0) {
      validateAmount(data.advancePaid, 'Avance');
      if (data.advancePaid > data.totalAmount) throw new Error('L\'avance ne peut pas dépasser le total');
    }
    const supplier = db.prepare('SELECT id FROM suppliers WHERE code = ? AND deleted_at IS NULL').get(data.supplier) as { id: string } | undefined;
    if (!supplier) throw new Error(`Supplier '${data.supplier}' not found`);
    const now = new Date().toISOString();
    return db.transaction(() => {
      // Check that new total >= advance + already paid
      const paidRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as paid FROM supplier_credit_payments WHERE supplier_credit_id = ? AND deleted_at IS NULL').get(data.id) as { paid: number };
      const advancePaid = data.advancePaid ?? 0;
      if (data.totalAmount < advancePaid + paidRow.paid) throw new Error('Le nouveau total ne peut pas être inférieur aux paiements déjà effectués');
      const result = db.prepare('UPDATE supplier_credits SET date=?, designation=?, total_amount=?, advance_paid=?, supplier_id=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(data.date, data.designation.trim(), data.totalAmount, data.advancePaid ?? 0, supplier.id, now, data.id);
      if (result.changes === 0) throw new Error(`Supplier credit ${data.id} not found`);
      addToOutbox(db, 'supplier_credit', data.id, 'UPDATE', {
        id: data.id, date: data.date, designation: data.designation.trim(),
        totalAmount: data.totalAmount, advancePaid: data.advancePaid ?? 0,
        supplierId: supplier.id,
      });
      return { success: true };
    })();
  });

  safeHandle('supplier-credits:delete', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const payments = db.prepare('SELECT id FROM supplier_credit_payments WHERE supplier_credit_id=? AND deleted_at IS NULL').all(id) as Array<{id: string}>;
      db.prepare('UPDATE supplier_credit_payments SET deleted_at=?, updated_at=? WHERE supplier_credit_id=? AND deleted_at IS NULL').run(now, now, id);
      for (const p of payments) {
        addToOutbox(db, 'supplier_credit_payment', p.id, 'DELETE', { id: p.id });
      }
      const result = db.prepare('UPDATE supplier_credits SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Supplier credit ${id} not found`);
      addToOutbox(db, 'supplier_credit', id, 'DELETE', { id });
      return { success: true };
    })();
  });

  // ─── Bank Movements Update / Delete ──────────────────────────────

  safeHandle('bank-movements:update', (_event, data: { id: string; date: string; description: string; amountIn?: number; amountOut?: number }) => {
    validateDate(data.date, 'Date');
    validateString(data.description, 'Description');
    if (data.amountIn != null) validateAmount(data.amountIn, 'Montant entrée');
    if (data.amountOut != null) validateAmount(data.amountOut, 'Montant sortie');
    if ((data.amountIn ?? 0) > 0 && (data.amountOut ?? 0) > 0) {
      throw new Error('Un mouvement ne peut pas avoir un montant en entrée ET en sortie');
    }
    if ((data.amountIn ?? 0) === 0 && (data.amountOut ?? 0) === 0) {
      throw new Error('Un mouvement doit avoir un montant en entrée OU en sortie');
    }
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE bank_movements SET date=?, description=?, amount_in=?, amount_out=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(data.date, data.description.trim(), data.amountIn ?? 0, data.amountOut ?? 0, now, data.id);
      if (result.changes === 0) throw new Error(`Bank movement ${data.id} not found`);
      addToOutbox(db, 'bank_movement', data.id, 'UPDATE', {
        id: data.id, date: data.date, description: data.description.trim(),
        amountIn: data.amountIn ?? 0, amountOut: data.amountOut ?? 0,
      });
      return { success: true };
    })();
  });

  safeHandle('bank-movements:delete', (_event, id: string) => {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE bank_movements SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error(`Bank movement ${id} not found`);
      addToOutbox(db, 'bank_movement', id, 'DELETE', { id });
      return { success: true };
    })();
  });

  // ═══════════════════════════════════════════════════════════════════
  // AUTH & USERS
  // ═══════════════════════════════════════════════════════════════════

  safeHandle('auth:login', (_event, data: { username: string; password: string }) => {
    const username = data.username.trim().toLowerCase();

    // Rate limiting check
    const now = Date.now();
    const attempts = loginAttempts.get(username);
    if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS && (now - attempts.lastAttempt) < LOGIN_LOCKOUT_MS) {
      const remainingSec = Math.ceil((LOGIN_LOCKOUT_MS - (now - attempts.lastAttempt)) / 1000);
      throw new Error(`Trop de tentatives. Réessayez dans ${remainingSec} secondes.`);
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND deleted_at IS NULL').get(username) as Record<string, unknown> | undefined;
    if (!user || !(user['is_active'] as number) || !bcrypt.compareSync(data.password, user['password_hash'] as string)) {
      // Record failed attempt
      const prev = loginAttempts.get(username);
      const newCount = (prev && (now - prev.lastAttempt) < LOGIN_LOCKOUT_MS) ? prev.count + 1 : 1;
      loginAttempts.set(username, { count: newCount, lastAttempt: now });
      throw new Error('Nom d\'utilisateur ou mot de passe incorrect');
    }

    // Success — clear attempts
    loginAttempts.delete(username);

    const permissions = (db.prepare('SELECT page_key FROM user_permissions WHERE user_id = ?').all(user['id'] as string) as Array<{ page_key: string }>).map(p => p.page_key);
    currentSession = { userId: user['id'] as string, username: user['username'] as string, role: user['role'] as string, permissions };
    return {
      user: { id: user['id'], username: user['username'], displayName: user['display_name'], role: user['role'], employeeId: user['employee_id'] },
      permissions,
      mustChangePassword: !!(user['must_change_password'] as number),
    };
  }, { skipAuth: true });

  safeHandle('auth:logout', () => {
    currentSession = null;
    return { success: true };
  }, { skipAuth: true });

  safeHandle('auth:change-password', (_event, data: { userId: string; oldPassword: string; newPassword: string }) => {
    if (!currentSession) throw new Error('Non authentifié');
    if (currentSession.userId !== data.userId && currentSession.role !== 'admin') {
      throw new Error('Non autorisé à changer le mot de passe d\'un autre utilisateur');
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(data.userId) as Record<string, unknown> | undefined;
    if (!user) throw new Error('Utilisateur non trouvé');
    if (!bcrypt.compareSync(data.oldPassword, user['password_hash'] as string)) {
      throw new Error('Ancien mot de passe incorrect');
    }
    validatePassword(data.newPassword);
    const hash = bcrypt.hashSync(data.newPassword, 10);
    const now = new Date().toISOString();
    return db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(hash, now, data.userId);
      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(data.userId) as Record<string, unknown>;
      const perms = (db.prepare('SELECT page_key FROM user_permissions WHERE user_id = ?').all(data.userId) as Array<{ page_key: string }>).map(p => p.page_key);
      addToOutbox(db, 'user', data.userId, 'UPDATE', {
        username: updatedUser['username'], passwordHash: hash,
        displayName: updatedUser['display_name'], role: updatedUser['role'],
        isActive: !!(updatedUser['is_active'] as number), mustChangePassword: false,
        permissions: perms,
      });
      return { success: true };
    })();
  });

  safeHandle('users:list', () => {
    const users = db.prepare('SELECT id, username, display_name, role, employee_id, is_active, must_change_password, created_at FROM users WHERE deleted_at IS NULL ORDER BY display_name').all() as Array<Record<string, unknown>>;
    const userIds = users.map(u => u['id'] as string);
    const employeeIds = users.map(u => u['employee_id']).filter(Boolean) as string[];

    // Batch-fetch permissions
    const permsMap = new Map<string, string[]>();
    if (userIds.length > 0) {
      const allPerms = db.prepare(`SELECT user_id, page_key FROM user_permissions WHERE user_id IN (${userIds.map(() => '?').join(',')})`).all(...userIds) as Array<{ user_id: string; page_key: string }>;
      for (const p of allPerms) {
        if (!permsMap.has(p.user_id)) permsMap.set(p.user_id, []);
        permsMap.get(p.user_id)!.push(p.page_key);
      }
    }

    // Batch-fetch employees
    const empMap = new Map<string, string>();
    if (employeeIds.length > 0) {
      const allEmps = db.prepare(`SELECT id, name FROM employees WHERE id IN (${employeeIds.map(() => '?').join(',')})`).all(...employeeIds) as Array<{ id: string; name: string }>;
      for (const e of allEmps) empMap.set(e.id, e.name);
    }

    return users.map(u => ({
      ...u,
      permissions: permsMap.get(u['id'] as string) || [],
      employee_name: u['employee_id'] ? empMap.get(u['employee_id'] as string) ?? null : null,
    }));
  }, { requireAdmin: true });

  safeHandle('users:create', (_event, data: { username: string; password: string; displayName: string; role: string; employeeId?: string; permissions: string[] }) => {
    const username = data.username.trim().toLowerCase();
    if (!username) throw new Error('Le nom d\'utilisateur est requis');
    if (data.password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères');
    if (data.role !== 'admin' && data.role !== 'employee') throw new Error('Rôle invalide');
    validatePassword(data.password);
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND deleted_at IS NULL').get(username);
    if (existing) throw new Error('Ce nom d\'utilisateur existe déjà');
    const id = uuidv7();
    const hash = bcrypt.hashSync(data.password, 10);
    const now = new Date().toISOString();
    const perms = data.role === 'admin' ? ALL_PAGES : (data.permissions || []);

    return db.transaction(() => {
      db.prepare('INSERT INTO users (id, username, password_hash, display_name, role, employee_id, is_active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)').run(id, username, hash, data.displayName.trim(), data.role, data.employeeId ?? null, now, now);
      const insertPerm = db.prepare('INSERT INTO user_permissions (id, user_id, page_key, created_at) VALUES (?, ?, ?, ?)');
      for (const page of perms) {
        insertPerm.run(uuidv7(), id, page, now);
      }
      addToOutbox(db, 'user', id, 'CREATE', {
        username, passwordHash: hash, displayName: data.displayName.trim(),
        role: data.role, isActive: true, mustChangePassword: true, permissions: perms,
      });
      return { id };
    })();
  }, { requireAdmin: true });

  safeHandle('users:update', (_event, data: { id: string; displayName?: string; isActive?: boolean; role?: string; permissions?: string[] }) => {
    // P2-4: Prevent admin from deactivating or demoting themselves
    if (currentSession && data.id === currentSession.userId) {
      if (data.isActive === false) throw new Error('Vous ne pouvez pas désactiver votre propre compte');
      if (data.role !== undefined && data.role !== currentSession.role) throw new Error('Vous ne pouvez pas changer votre propre rôle');
    }
    if (data.role !== undefined && data.role !== 'admin' && data.role !== 'employee') throw new Error('Rôle invalide');
    const now = new Date().toISOString();
    return db.transaction(() => {
      const user = db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(data.id) as Record<string, unknown> | undefined;
      if (!user) throw new Error('Utilisateur non trouvé');
      const updates: string[] = [];
      const values: unknown[] = [];
      if (data.displayName !== undefined) { updates.push('display_name = ?'); values.push(data.displayName.trim()); }
      if (data.isActive !== undefined) { updates.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
      if (data.role !== undefined) { updates.push('role = ?'); values.push(data.role); }
      if (updates.length > 0) {
        updates.push('updated_at = ?');
        values.push(now, data.id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }
      if (data.permissions !== undefined) {
        db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(data.id);
        const effectivePerms = (data.role ?? user['role']) === 'admin' ? ALL_PAGES : data.permissions;
        const insertPerm = db.prepare('INSERT INTO user_permissions (id, user_id, page_key, created_at) VALUES (?, ?, ?, ?)');
        for (const page of effectivePerms) {
          insertPerm.run(uuidv7(), data.id, page, now);
        }
      }
      // Build updated user snapshot for sync (inside transaction)
      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(data.id) as Record<string, unknown>;
      const updatedPerms = (db.prepare('SELECT page_key FROM user_permissions WHERE user_id = ?').all(data.id) as Array<{ page_key: string }>).map(p => p.page_key);
      addToOutbox(db, 'user', data.id, 'UPDATE', {
        username: updatedUser['username'], passwordHash: updatedUser['password_hash'],
        displayName: updatedUser['display_name'], role: updatedUser['role'],
        isActive: !!(updatedUser['is_active'] as number), mustChangePassword: !!(updatedUser['must_change_password'] as number),
        permissions: updatedPerms,
      });
      return { success: true };
    })();
  }, { requireAdmin: true });

  safeHandle('users:reset-password', (_event, data: { userId: string; newPassword: string }) => {
    validatePassword(data.newPassword);
    const hash = bcrypt.hashSync(data.newPassword, 10);
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(hash, now, data.userId);
      if (result.changes === 0) throw new Error('Utilisateur non trouvé');
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(data.userId) as Record<string, unknown>;
      const perms = (db.prepare('SELECT page_key FROM user_permissions WHERE user_id = ?').all(data.userId) as Array<{ page_key: string }>).map(p => p.page_key);
      addToOutbox(db, 'user', data.userId, 'UPDATE', {
        username: user['username'], passwordHash: hash,
        displayName: user['display_name'], role: user['role'],
        isActive: !!(user['is_active'] as number), mustChangePassword: true,
        permissions: perms,
      });
      return { success: true };
    })();
  }, { requireAdmin: true });

  safeHandle('users:delete', (_event, id: string) => {
    // P2-4: Prevent admin from deleting themselves
    if (currentSession && id === currentSession.userId) {
      throw new Error('Vous ne pouvez pas supprimer votre propre compte');
    }
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare('UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id);
      if (result.changes === 0) throw new Error('Utilisateur non trouvé');
      addToOutbox(db, 'user', id, 'DELETE', {});
      return { success: true };
    })();
  }, { requireAdmin: true });
}
