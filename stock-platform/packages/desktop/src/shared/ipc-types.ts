/**
 * Strictly typed IPC interfaces — derived from actual handler signatures
 * in src/main/ipc-handlers.ts. Every preload method uses these instead
 * of Record<string, unknown>.
 */

// ─── Master Data ────────────────────────────────────────────────────

export interface SupplierCreateParams {
  code: string;
}

export interface SupplierUpdateParams {
  id: string;
  code: string;
}

export interface BoutiqueCreateParams {
  name: string;
}

export interface CategoryCreateParams {
  name: string;
}

export interface CategoryUpdateParams {
  id: string;
  name: string;
}

export interface SubCategoryListParams {
  categoryId?: string;
}

export interface SubCategoryCreateParams {
  name: string;
  categoryId: string;
}

export interface SubCategoryUpdateParams {
  id: string;
  name: string;
  categoryId: string;
}

export interface ClientCreateParams {
  name: string;
  phone?: string;
}

export interface ClientUpdateParams {
  id: string;
  name: string;
  phone?: string;
}

// ─── Employees & Salary ─────────────────────────────────────────────

export interface EmployeeCreateParams {
  name: string;
  monthlySalary: number;
  startDate: string;
}

export interface EmployeeUpdateParams {
  id: string;
  name: string;
  monthlySalary: number;
  startDate: string;
  isActive: boolean;
}

export interface SalaryPaymentListParams {
  month?: number;
  year?: number;
}

export interface SalaryPaymentCreateParams {
  employeeId: string;
  date: string;
  amount: number;
  note?: string;
}

// ─── Purchases ──────────────────────────────────────────────────────

export interface PurchaseListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  supplier?: string;
  boutique?: string;
  subCategory?: string;
}

export interface PurchaseCreateParams {
  date: string;
  category: string;
  designation: string;
  supplier?: string;
  boutique: string;
  initialQuantity: number;
  purchaseUnitCost: number;
  targetResalePrice: number | null;
  blockPrice: number | null;
  sellingPrice: number | null;
  subCategory: string | null;
  barcode?: string;
}

export interface PurchaseUpdateParams {
  id: string;
  date: string;
  category: string;
  designation: string;
  supplier?: string;
  boutique: string;
  initialQuantity: number;
  purchaseUnitCost: number;
  targetResalePrice: number | null;
  blockPrice: number | null;
  sellingPrice: number | null;
  subCategory: string | null;
  barcode?: string;
}

export interface PurchaseImportExcelParams {
  rows: PurchaseCreateParams[];
}

export interface ImportExcelResult {
  created: number;
  errors: Array<{ row: number; message: string }>;
}

export type PurchaseImportExcelResult = ImportExcelResult;

export interface MaintenanceImportExcelParams {
  rows: MaintenanceCreateParams[];
}

export type MaintenanceImportExcelResult = ImportExcelResult;

export interface ExpenseImportExcelParams {
  rows: ExpenseCreateParams[];
}

export type ExpenseImportExcelResult = ImportExcelResult;

export interface CustomerCreditImportExcelParams {
  rows: CustomerCreditCreateParams[];
}

export type CustomerCreditImportExcelResult = ImportExcelResult;

export interface SupplierCreditImportExcelParams {
  rows: SupplierCreditCreateParams[];
}

export type SupplierCreditImportExcelResult = ImportExcelResult;

export interface BankMovementImportExcelParams {
  rows: BankMovementCreateParams[];
}

export type BankMovementImportExcelResult = ImportExcelResult;

// ─── Stock ──────────────────────────────────────────────────────────

export interface StockListParams {
  inStockOnly?: boolean;
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface StockLookupBarcodeParams {
  barcode: string;
}

// ─── Sales ──────────────────────────────────────────────────────────

export interface SaleLine {
  lotId: string;
  quantity: number;
  sellingUnitPrice: number;
}

export interface SaleCreateParams {
  date: string;
  observation?: string;
  clientName?: string;
  lines: SaleLine[];
  paymentType?: 'comptant' | 'credit';
  advancePaid?: number;
  dueDate?: string;
}

export interface SaleUpdateParams {
  id: string;
  date: string;
  observation?: string;
  clientName?: string;
  lines: SaleLine[];
}

export interface SaleReturnLine {
  saleLineId: string;
  lotId: string;
  quantity: number;
  sellingUnitPrice: number;
}

export interface SaleReturnParams {
  saleOrderId: string;
  date: string;
  observation?: string;
  lines: SaleReturnLine[];
}

export interface SaleListParams {
  search?: string;
  page?: number;
  limit?: number;
  category?: string;
  subCategory?: string;
}

export interface SaleImportRow {
  date: string;
  designation: string;
  quantity: number;
  sellingUnitPrice: number;
  clientName?: string;
  observation?: string;
  boutique?: string;
}

export interface SaleImportExcelParams {
  rows: SaleImportRow[];
}

export type SaleImportExcelResult = ImportExcelResult;

// ─── Maintenance ────────────────────────────────────────────────────

export interface MaintenanceCreateParams {
  date: string;
  designation: string;
  price: number;
  boutique: string;
}

export interface MaintenanceUpdateParams {
  id: string;
  date: string;
  designation: string;
  price: number;
  boutique: string;
}

export interface MaintenanceListParams {
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Maintenance Service Types ──────────────────────────────────────

export interface MaintenanceTypeCreateParams {
  name: string;
}

// ─── Expense Designations ───────────────────────────────────────────

export interface ExpenseDesignationCreateParams {
  name: string;
}

// ─── Battery Repair ─────────────────────────────────────────────────

export interface BatteryRepairCreateParams {
  date: string;
  description: string;
  customerNote?: string;
  amount: number;
  costAdjustment?: number;
}

export interface BatteryRepairUpdateParams {
  id: string;
  date: string;
  description: string;
  customerNote?: string;
  amount: number;
  costAdjustment?: number;
}

export interface BatteryRepairListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface BatteryRepairImportRow {
  date: string;
  description: string;
  amount: number;
  customerNote?: string;
  costAdjustment?: number;
}

export interface BatteryRepairImportExcelParams {
  rows: BatteryRepairImportRow[];
}

export type BatteryRepairImportExcelResult = ImportExcelResult;

export interface BatteryTariffCreateParams {
  label: string;
  particuliersPrice: number | null;
  revPrice: number | null;
}

export interface BatteryTariffUpdateParams {
  id: string;
  label: string;
  particuliersPrice: number | null;
  revPrice: number | null;
}

// ─── Expenses ───────────────────────────────────────────────────────

export interface ExpenseCreateParams {
  date: string;
  designation: string;
  amount: number;
  boutique: string;
}

export interface ExpenseUpdateParams {
  id: string;
  date: string;
  designation: string;
  amount: number;
  boutique: string;
}

export interface ExpenseListParams {
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Customer Credits ───────────────────────────────────────────────

export interface CustomerCreditCreateParams {
  date: string;
  customerName: string;
  designation: string;
  quantity: number;
  unitPrice: number;
  advancePaid?: number;
}

export interface CustomerCreditUpdateParams {
  id: string;
  date: string;
  customerName: string;
  designation: string;
  quantity: number;
  unitPrice: number;
  advancePaid?: number;
}

export interface CustomerCreditListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreditPaymentParams {
  creditId: string;
  date: string;
  amount: number;
}

// ─── Supplier Credits ───────────────────────────────────────────────

export interface SupplierCreditCreateParams {
  date: string;
  supplier: string;
  designation: string;
  totalAmount: number;
  advancePaid?: number;
}

export interface SupplierCreditUpdateParams {
  id: string;
  date: string;
  supplier: string;
  designation: string;
  totalAmount: number;
  advancePaid?: number;
}

export interface SupplierCreditListParams {
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Customer Orders ────────────────────────────────────────────────

export interface CustomerOrderLine {
  lotId: string;
  quantity: number;
  sellingUnitPrice: number;
}

export interface CustomerOrderCreateParams {
  date: string;
  observation?: string;
  clientName?: string;
  lines: CustomerOrderLine[];
}

export interface CustomerOrderUpdateParams {
  id: string;
  date: string;
  observation?: string;
  clientName?: string;
  status?: string;
  lines: CustomerOrderLine[];
}

export interface CustomerOrderUpdateStatusParams {
  id: string;
  status: string;
}

export interface CustomerOrderListParams {
  search?: string;
  page?: number;
  limit?: number;
  status?: string;
}

// ─── Bank Movements ─────────────────────────────────────────────────

export interface BankMovementCreateParams {
  date: string;
  description: string;
  amountIn?: number;
  amountOut?: number;
}

export interface BankMovementUpdateParams {
  id: string;
  date: string;
  description: string;
  amountIn?: number;
  amountOut?: number;
}

export interface BankMovementListParams {
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Monthly Summary ────────────────────────────────────────────────

export interface MonthlySummaryParams {
  year: number;
}

// ─── Zakat ──────────────────────────────────────────────────────────

export interface ZakatComputeParams {
  year: number;
  cashAtClosing?: number;
}

export interface ZakatSaveAdvanceParams {
  year: number;
  date: string;
  amount: number;
  note?: string;
}

// ─── Auth ───────────────────────────────────────────────────────────

export interface AuthLoginParams {
  username: string;
  password: string;
}

export interface AuthChangePasswordParams {
  userId: string;
  oldPassword: string;
  newPassword: string;
}

// ─── Users ──────────────────────────────────────────────────────────

export interface UserCreateParams {
  username: string;
  password: string;
  displayName: string;
  role: string;
  employeeId?: string;
  permissions: string[];
}

export interface UserUpdateParams {
  id: string;
  displayName?: string;
  isActive?: boolean;
  role?: string;
  permissions?: string[];
}

export interface UserResetPasswordParams {
  userId: string;
  newPassword: string;
}
