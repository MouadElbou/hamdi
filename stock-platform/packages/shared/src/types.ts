/**
 * Domain entity types used across all packages.
 * All monetary values are stored as integers in centimes (minor units).
 * All dates are ISO 8601 strings.
 */

// ─── Common ──────────────────────────────────────────────────────────────────

/** All entities carry sync metadata. */
export interface SyncMeta {
  version: number;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  deletedAt: string | null;
  originDesktopId: string | null; // UUID of originating desktop, null if created on server
}

// ─── Purchase Lot ────────────────────────────────────────────────────────────

export interface PurchaseLot extends SyncMeta {
  id: string;            // UUIDv7
  refNumber: string;
  date: string;          // ISO 8601 date
  category: string;
  designation: string;
  supplier: string;
  boutique: string;
  initialQuantity: number;
  purchaseUnitCost: number;   // centimes
  targetResalePrice: number | null; // centimes, optional
  // Derived (computed, not stored)
  // totalPurchaseAmount = initialQuantity * purchaseUnitCost
}

// ─── Stock Lot (computed view, not a separate table) ─────────────────────────

export interface StockLotView {
  lotId: string;
  refNumber: string;
  date: string;
  category: string;
  designation: string;
  supplier: string;
  boutique: string;
  initialQuantity: number;
  soldQuantity: number;          // computed: sum of sale lines for this lot
  remainingQuantity: number;     // computed: initialQuantity - soldQuantity
  purchaseUnitCost: number;      // centimes
  targetResalePrice: number | null;
  currentStockValue: number;     // computed: remainingQuantity * purchaseUnitCost
}

// ─── Sale ────────────────────────────────────────────────────────────────────

export interface SaleOrder extends SyncMeta {
  id: string;           // UUIDv7
  refNumber: string;
  date: string;         // ISO 8601 date
  observation: string | null;
}

export interface SaleLine extends SyncMeta {
  id: string;           // UUIDv7
  saleOrderId: string;  // FK to SaleOrder
  lotId: string;        // FK to PurchaseLot
  quantity: number;
  sellingUnitPrice: number;  // centimes
  // Derived:
  // totalSaleAmount = quantity * sellingUnitPrice
  // saleMargin = (sellingUnitPrice - lot.purchaseUnitCost) * quantity
}

// ─── Maintenance ─────────────────────────────────────────────────────────────

export interface MaintenanceJob extends SyncMeta {
  id: string;
  date: string;
  designation: string;
  price: number;        // centimes
  boutique: string;
}

// ─── Battery Repair ──────────────────────────────────────────────────────────

export interface BatteryRepairJob extends SyncMeta {
  id: string;
  date: string;
  description: string;
  customerNote: string | null;
  amount: number;            // centimes
  costAdjustment: number;    // centimes, default 0
}

export interface BatteryTariff extends SyncMeta {
  id: string;
  label: string;
  particuliersPrice: number | null; // centimes
  revPrice: number | null;          // centimes
}

// ─── Expense ─────────────────────────────────────────────────────────────────

export interface Expense extends SyncMeta {
  id: string;
  date: string;
  designation: string;
  amount: number;  // centimes
  boutique: string;
}

// ─── Customer Credit ─────────────────────────────────────────────────────────

export interface CustomerCredit extends SyncMeta {
  id: string;
  date: string;
  customerName: string;
  designation: string;
  quantity: number;
  unitPrice: number;           // centimes
  // Derived: totalAmount = quantity * unitPrice
  advancePaid: number;         // centimes
  // Derived: remainingBalance = totalAmount - advancePaid
}

export interface CustomerCreditPayment extends SyncMeta {
  id: string;
  customerCreditId: string;
  date: string;
  amount: number;  // centimes
}

// ─── Supplier Credit ─────────────────────────────────────────────────────────

export interface SupplierCredit extends SyncMeta {
  id: string;
  date: string;
  supplier: string;
  designation: string;
  totalAmount: number;     // centimes
  advancePaid: number;     // centimes
  // Derived: remainingBalance = totalAmount - advancePaid
}

export interface SupplierCreditPayment extends SyncMeta {
  id: string;
  supplierCreditId: string;
  date: string;
  amount: number;  // centimes
}

// ─── Bank Movement ───────────────────────────────────────────────────────────

export interface BankMovement extends SyncMeta {
  id: string;
  date: string;
  description: string;
  amountIn: number;   // centimes, 0 if outflow
  amountOut: number;  // centimes, 0 if inflow
}

// ─── Monthly Summary ─────────────────────────────────────────────────────────

export interface MonthlySummary extends SyncMeta {
  id: string;
  year: number;
  month: number;   // 1-12
}

export interface MonthlySummaryLine extends SyncMeta {
  id: string;
  monthlySummaryId: string;
  section: 'revenue' | 'expense' | 'salary';
  label: string;
  amount: number;         // centimes
  isAutoComputed: boolean; // true = fed from transactions, false = manual input
}

// ─── Zakat ───────────────────────────────────────────────────────────────────

export interface ZakatSnapshot extends SyncMeta {
  id: string;
  year: number;
  closingDate: string;
  closingStockValue: number;  // centimes
  closingBankBalance: number; // centimes
  closingCash: number;        // centimes
  creditDeduction: number;    // centimes
  // Derived:
  // totalAssets = closingStockValue + closingBankBalance + closingCash
  // zakatBase = totalAssets - creditDeduction
  // zakatDue = zakatBase * 0.025
}

export interface ZakatAdvance extends SyncMeta {
  id: string;
  zakatSnapshotId: string;
  date: string;
  amount: number;  // centimes
}

// ─── Sync entities ───────────────────────────────────────────────────────────

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'failed';

export interface SyncOutboxEntry {
  id: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload: string;  // JSON
  version: number;
  createdAt: string;
  syncedAt: string | null;
  status: SyncStatus;
  errorDetail: string | null;
}

export interface SyncAuditLog {
  id: string;
  direction: 'push' | 'pull';
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  result: 'accepted' | 'conflict' | 'rejected';
  detail: string | null;
  desktopId: string;
  occurredAt: string;
}

// ─── Import ──────────────────────────────────────────────────────────────────

export type ImportAnomalyType =
  | 'negative_stock'
  | 'invalid_date'
  | 'unmapped_category'
  | 'zero_designation'
  | 'zero_boutique'
  | 'duplicate_reference'
  | 'missing_lot_link'
  | 'other';

export interface ImportAnomaly {
  id: string;
  importBatchId: string;
  entityType: string;
  entityId: string | null;
  anomalyType: ImportAnomalyType;
  rawValue: string;
  canonicalValue: string | null;
  description: string;
  createdAt: string;
}
