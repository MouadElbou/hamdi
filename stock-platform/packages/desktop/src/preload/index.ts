/**
 * Preload script — exposes a safe API from main process to renderer.
 * Uses contextBridge for security isolation.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  SupplierCreateParams,
  BoutiqueCreateParams,
  CategoryCreateParams,
  SubCategoryListParams,
  SubCategoryCreateParams,
  ClientCreateParams,
  EmployeeCreateParams,
  EmployeeUpdateParams,
  SalaryPaymentListParams,
  SalaryPaymentCreateParams,
  PurchaseListParams,
  PurchaseCreateParams,
  PurchaseUpdateParams,
  StockListParams,
  StockLookupBarcodeParams,
  SaleCreateParams,
  SaleUpdateParams,
  SaleReturnParams,
  SaleListParams,
  MaintenanceCreateParams,
  MaintenanceUpdateParams,
  MaintenanceListParams,
  MaintenanceTypeCreateParams,
  ExpenseDesignationCreateParams,
  BatteryRepairCreateParams,
  BatteryRepairUpdateParams,
  BatteryRepairListParams,
  BatteryTariffCreateParams,
  BatteryTariffUpdateParams,
  ExpenseCreateParams,
  ExpenseUpdateParams,
  ExpenseListParams,
  CustomerCreditCreateParams,
  CustomerCreditUpdateParams,
  CustomerCreditListParams,
  CreditPaymentParams,
  SupplierCreditCreateParams,
  SupplierCreditUpdateParams,
  SupplierCreditListParams,
  CustomerOrderCreateParams,
  CustomerOrderUpdateParams,
  CustomerOrderUpdateStatusParams,
  CustomerOrderListParams,
  BankMovementCreateParams,
  BankMovementUpdateParams,
  BankMovementListParams,
  MonthlySummaryParams,
  ZakatComputeParams,
  ZakatSaveAdvanceParams,
  AuthLoginParams,
  AuthChangePasswordParams,
  UserCreateParams,
  UserUpdateParams,
  UserResetPasswordParams,
} from '../shared/ipc-types.js';

const api = {
  // Master Data
  suppliers: {
    list: () => ipcRenderer.invoke('suppliers:list'),
    create: (data: SupplierCreateParams) => ipcRenderer.invoke('suppliers:create', data),
  },
  boutiques: {
    list: () => ipcRenderer.invoke('boutiques:list'),
    create: (data: BoutiqueCreateParams) => ipcRenderer.invoke('boutiques:create', data),
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (data: CategoryCreateParams) => ipcRenderer.invoke('categories:create', data),
  },
  subCategories: {
    list: (params?: SubCategoryListParams) => ipcRenderer.invoke('sub-categories:list', params),
    create: (data: SubCategoryCreateParams) => ipcRenderer.invoke('sub-categories:create', data),
  },
  clients: {
    list: () => ipcRenderer.invoke('clients:list'),
    create: (data: ClientCreateParams) => ipcRenderer.invoke('clients:create', data),
    search: (query: string) => ipcRenderer.invoke('clients:search', query),
  },

  // Employees & Salary
  employees: {
    list: () => ipcRenderer.invoke('employees:list'),
    create: (data: EmployeeCreateParams) => ipcRenderer.invoke('employees:create', data),
    update: (data: EmployeeUpdateParams) => ipcRenderer.invoke('employees:update', data),
    delete: (id: string) => ipcRenderer.invoke('employees:delete', id),
  },
  salaryPayments: {
    list: (params?: SalaryPaymentListParams) => ipcRenderer.invoke('salary-payments:list', params),
    create: (data: SalaryPaymentCreateParams) => ipcRenderer.invoke('salary-payments:create', data),
    delete: (id: string) => ipcRenderer.invoke('salary-payments:delete', id),
  },

  // Purchases
  purchases: {
    list: (params: PurchaseListParams) => ipcRenderer.invoke('purchases:list', params),
    create: (data: PurchaseCreateParams) => ipcRenderer.invoke('purchases:create', data),
    update: (data: PurchaseUpdateParams) => ipcRenderer.invoke('purchases:update', data),
    delete: (id: string) => ipcRenderer.invoke('purchases:delete', id),
  },

  // Stock
  stock: {
    list: (params: StockListParams) => ipcRenderer.invoke('stock:list', params),
    lowStockAlerts: () => ipcRenderer.invoke('stock:low-stock-alerts'),
    lookupBarcode: (data: StockLookupBarcodeParams) => ipcRenderer.invoke('stock:lookup-barcode', data),
  },

  // Sales
  sales: {
    list: (params?: SaleListParams) => ipcRenderer.invoke('sales:list', params),
    create: (data: SaleCreateParams) => ipcRenderer.invoke('sales:create', data),
    update: (data: SaleUpdateParams) => ipcRenderer.invoke('sales:update', data),
    delete: (id: string) => ipcRenderer.invoke('sales:delete', id),
    return: (data: SaleReturnParams) => ipcRenderer.invoke('sales:return', data),
  },

  // Maintenance
  maintenance: {
    list: (params?: MaintenanceListParams) => ipcRenderer.invoke('maintenance:list', params),
    create: (data: MaintenanceCreateParams) => ipcRenderer.invoke('maintenance:create', data),
    update: (data: MaintenanceUpdateParams) => ipcRenderer.invoke('maintenance:update', data),
    delete: (id: string) => ipcRenderer.invoke('maintenance:delete', id),
  },

  // Maintenance Service Types
  maintenanceTypes: {
    list: () => ipcRenderer.invoke('maintenance-types:list'),
    create: (data: MaintenanceTypeCreateParams) => ipcRenderer.invoke('maintenance-types:create', data),
  },

  // Expense Designations
  expenseDesignations: {
    list: () => ipcRenderer.invoke('expense-designations:list'),
    create: (data: ExpenseDesignationCreateParams) => ipcRenderer.invoke('expense-designations:create', data),
  },

  // Battery Repair
  batteryRepair: {
    list: (params?: BatteryRepairListParams) => ipcRenderer.invoke('battery-repair:list', params),
    create: (data: BatteryRepairCreateParams) => ipcRenderer.invoke('battery-repair:create', data),
    update: (data: BatteryRepairUpdateParams) => ipcRenderer.invoke('battery-repair:update', data),
    delete: (id: string) => ipcRenderer.invoke('battery-repair:delete', id),
    tariffs: () => ipcRenderer.invoke('battery-repair:tariffs'),
    createTariff: (data: BatteryTariffCreateParams) => ipcRenderer.invoke('battery-tariffs:create', data),
    updateTariff: (data: BatteryTariffUpdateParams) => ipcRenderer.invoke('battery-tariffs:update', data),
    deleteTariff: (id: string) => ipcRenderer.invoke('battery-tariffs:delete', id),
  },

  // Expenses
  expenses: {
    list: (params?: ExpenseListParams) => ipcRenderer.invoke('expenses:list', params),
    create: (data: ExpenseCreateParams) => ipcRenderer.invoke('expenses:create', data),
    update: (data: ExpenseUpdateParams) => ipcRenderer.invoke('expenses:update', data),
    delete: (id: string) => ipcRenderer.invoke('expenses:delete', id),
  },

  // Customer Credits
  customerCredits: {
    list: (params?: CustomerCreditListParams) => ipcRenderer.invoke('customer-credits:list', params),
    create: (data: CustomerCreditCreateParams) => ipcRenderer.invoke('customer-credits:create', data),
    update: (data: CustomerCreditUpdateParams) => ipcRenderer.invoke('customer-credits:update', data),
    delete: (id: string) => ipcRenderer.invoke('customer-credits:delete', id),
    addPayment: (data: CreditPaymentParams) => ipcRenderer.invoke('customer-credits:add-payment', data),
    deletePayment: (id: string) => ipcRenderer.invoke('customer-credits:delete-payment', id),
    history: (name: string) => ipcRenderer.invoke('customer-credits:history', name),
  },

  // Supplier Credits
  supplierCredits: {
    list: (params?: SupplierCreditListParams) => ipcRenderer.invoke('supplier-credits:list', params),
    create: (data: SupplierCreditCreateParams) => ipcRenderer.invoke('supplier-credits:create', data),
    update: (data: SupplierCreditUpdateParams) => ipcRenderer.invoke('supplier-credits:update', data),
    delete: (id: string) => ipcRenderer.invoke('supplier-credits:delete', id),
    addPayment: (data: CreditPaymentParams) => ipcRenderer.invoke('supplier-credits:add-payment', data),
    deletePayment: (id: string) => ipcRenderer.invoke('supplier-credits:delete-payment', id),
    history: (code: string) => ipcRenderer.invoke('supplier-credits:history', code),
  },

  // Notifications
  notifications: {
    unpaidCustomerCredits: () => ipcRenderer.invoke('notifications:unpaid-customer-credits'),
    unpaidSupplierCredits: () => ipcRenderer.invoke('notifications:unpaid-supplier-credits'),
  },

  // Customer Orders
  customerOrders: {
    list: (params?: CustomerOrderListParams) => ipcRenderer.invoke('customer-orders:list', params),
    create: (data: CustomerOrderCreateParams) => ipcRenderer.invoke('customer-orders:create', data),
    update: (data: CustomerOrderUpdateParams) => ipcRenderer.invoke('customer-orders:update', data),
    updateStatus: (data: CustomerOrderUpdateStatusParams) => ipcRenderer.invoke('customer-orders:update-status', data),
    delete: (id: string) => ipcRenderer.invoke('customer-orders:delete', id),
  },

  // Bank Movements
  bankMovements: {
    list: (params?: BankMovementListParams) => ipcRenderer.invoke('bank-movements:list', params),
    create: (data: BankMovementCreateParams) => ipcRenderer.invoke('bank-movements:create', data),
    update: (data: BankMovementUpdateParams) => ipcRenderer.invoke('bank-movements:update', data),
    delete: (id: string) => ipcRenderer.invoke('bank-movements:delete', id),
    summary: () => ipcRenderer.invoke('bank-movements:summary'),
  },

  // Dashboard
  dashboard: {
    stats: () => ipcRenderer.invoke('dashboard:stats'),
  },

  // Monthly Summary
  monthlySummary: {
    get: (params: MonthlySummaryParams) => ipcRenderer.invoke('monthly-summary:get', params),
  },

  // Zakat
  zakat: {
    compute: (params: ZakatComputeParams) => ipcRenderer.invoke('zakat:compute', params),
    saveAdvance: (data: ZakatSaveAdvanceParams) => ipcRenderer.invoke('zakat:save-advance', data),
    deleteAdvance: (id: string) => ipcRenderer.invoke('zakat:delete-advance', id),
  },

  // Auth
  auth: {
    login: (data: AuthLoginParams) => ipcRenderer.invoke('auth:login', data),
    logout: () => ipcRenderer.invoke('auth:logout'),
    changePassword: (data: AuthChangePasswordParams) => ipcRenderer.invoke('auth:change-password', data),
  },

  // Users
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (data: UserCreateParams) => ipcRenderer.invoke('users:create', data),
    update: (data: UserUpdateParams) => ipcRenderer.invoke('users:update', data),
    resetPassword: (data: UserResetPasswordParams) => ipcRenderer.invoke('users:reset-password', data),
    delete: (id: string) => ipcRenderer.invoke('users:delete', id),
  },

  // Sync
  sync: {
    status: () => ipcRenderer.invoke('sync:status'),
    trigger: () => ipcRenderer.invoke('sync:trigger'),
    listConflicts: () => ipcRenderer.invoke('sync:list-conflicts'),
    dismissConflict: (outboxId: string) => ipcRenderer.invoke('sync:dismiss-conflict', outboxId),
    retryConflict: (outboxId: string) => ipcRenderer.invoke('sync:retry-conflict', outboxId),
  },

  // Backup / Restore
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    restore: () => ipcRenderer.invoke('backup:restore'),
  },

  // Runtime config (edit .env after install)
  config: {
    getPath: () => ipcRenderer.invoke('config:get-path'),
    openFile: () => ipcRenderer.invoke('config:open-file'),
    reload: () => ipcRenderer.invoke('config:reload'),
  },

  // Auto-updater
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    onEvent: (callback: (payload: { event: string; payload?: unknown }) => void) => {
      const listener = (_: unknown, data: { event: string; payload?: unknown }) => callback(data);
      ipcRenderer.on('updater:event', listener);
      return () => ipcRenderer.removeListener('updater:event', listener);
    },
  },
} as const;

contextBridge.exposeInMainWorld('api', api);


export type DesktopAPI = typeof api;
