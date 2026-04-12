/**
 * Preload script — exposes a safe API from main process to renderer.
 * Uses contextBridge for security isolation.
 */

import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Master Data
  suppliers: {
    list: () => ipcRenderer.invoke('suppliers:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('suppliers:create', data),
  },
  boutiques: {
    list: () => ipcRenderer.invoke('boutiques:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('boutiques:create', data),
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('categories:create', data),
  },
  subCategories: {
    list: (params?: Record<string, unknown>) => ipcRenderer.invoke('sub-categories:list', params),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('sub-categories:create', data),
  },
  clients: {
    list: () => ipcRenderer.invoke('clients:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('clients:create', data),
    search: (query: string) => ipcRenderer.invoke('clients:search', query),
  },

  // Employees & Salary
  employees: {
    list: () => ipcRenderer.invoke('employees:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('employees:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('employees:update', data),
    delete: (id: string) => ipcRenderer.invoke('employees:delete', id),
  },
  salaryPayments: {
    list: (params?: Record<string, unknown>) => ipcRenderer.invoke('salary-payments:list', params),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('salary-payments:create', data),
    delete: (id: string) => ipcRenderer.invoke('salary-payments:delete', id),
  },

  // Purchases
  purchases: {
    list: (params: Record<string, unknown>) => ipcRenderer.invoke('purchases:list', params),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('purchases:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('purchases:update', data),
    delete: (id: string) => ipcRenderer.invoke('purchases:delete', id),
  },

  // Stock
  stock: {
    list: (params: Record<string, unknown>) => ipcRenderer.invoke('stock:list', params),
    lowStockAlerts: () => ipcRenderer.invoke('stock:low-stock-alerts'),
    lookupBarcode: (data: Record<string, unknown>) => ipcRenderer.invoke('stock:lookup-barcode', data),
  },

  // Sales
  sales: {
    list: (params?: Record<string, unknown>) => ipcRenderer.invoke('sales:list', params),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('sales:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('sales:update', data),
    delete: (id: string) => ipcRenderer.invoke('sales:delete', id),
    return: (data: Record<string, unknown>) => ipcRenderer.invoke('sales:return', data),
  },

  // Maintenance
  maintenance: {
    list: (params?: Record<string, unknown>) => ipcRenderer.invoke('maintenance:list', params),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('maintenance:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('maintenance:update', data),
    delete: (id: string) => ipcRenderer.invoke('maintenance:delete', id),
  },

  // Maintenance Service Types
  maintenanceTypes: {
    list: () => ipcRenderer.invoke('maintenance-types:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('maintenance-types:create', data),
  },

  // Expense Designations
  expenseDesignations: {
    list: () => ipcRenderer.invoke('expense-designations:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('expense-designations:create', data),
  },

  // Battery Repair
  batteryRepair: {
    list: (params?: Record<string, unknown>) => ipcRenderer.invoke('battery-repair:list', params),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('battery-repair:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('battery-repair:update', data),
    delete: (id: string) => ipcRenderer.invoke('battery-repair:delete', id),
    tariffs: () => ipcRenderer.invoke('battery-repair:tariffs'),
    createTariff: (data: Record<string, unknown>) => ipcRenderer.invoke('battery-tariffs:create', data),
    updateTariff: (data: Record<string, unknown>) => ipcRenderer.invoke('battery-tariffs:update', data),
    deleteTariff: (id: string) => ipcRenderer.invoke('battery-tariffs:delete', id),
  },

  // Expenses
  expenses: {
    list: (params?: Record<string, unknown>) => ipcRenderer.invoke('expenses:list', params),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('expenses:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('expenses:update', data),
    delete: (id: string) => ipcRenderer.invoke('expenses:delete', id),
  },

  // Customer Credits
  customerCredits: {
    list: (params?: Record<string, unknown>) => ipcRenderer.invoke('customer-credits:list', params),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('customer-credits:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('customer-credits:update', data),
    delete: (id: string) => ipcRenderer.invoke('customer-credits:delete', id),
    addPayment: (data: Record<string, unknown>) => ipcRenderer.invoke('customer-credits:add-payment', data),
    deletePayment: (id: string) => ipcRenderer.invoke('customer-credits:delete-payment', id),
    history: (name: string) => ipcRenderer.invoke('customer-credits:history', name),
  },

  // Supplier Credits
  supplierCredits: {
    list: (params?: Record<string, unknown>) => ipcRenderer.invoke('supplier-credits:list', params),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('supplier-credits:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('supplier-credits:update', data),
    delete: (id: string) => ipcRenderer.invoke('supplier-credits:delete', id),
    addPayment: (data: Record<string, unknown>) => ipcRenderer.invoke('supplier-credits:add-payment', data),
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
    list: (params?: Record<string, unknown>) => ipcRenderer.invoke('customer-orders:list', params),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('customer-orders:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('customer-orders:update', data),
    updateStatus: (data: Record<string, unknown>) => ipcRenderer.invoke('customer-orders:update-status', data),
    delete: (id: string) => ipcRenderer.invoke('customer-orders:delete', id),
  },

  // Bank Movements
  bankMovements: {
    list: (params?: Record<string, unknown>) => ipcRenderer.invoke('bank-movements:list', params),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('bank-movements:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('bank-movements:update', data),
    delete: (id: string) => ipcRenderer.invoke('bank-movements:delete', id),
    summary: () => ipcRenderer.invoke('bank-movements:summary'),
  },

  // Dashboard
  dashboard: {
    stats: () => ipcRenderer.invoke('dashboard:stats'),
  },

  // Monthly Summary
  monthlySummary: {
    get: (params: Record<string, unknown>) => ipcRenderer.invoke('monthly-summary:get', params),
  },

  // Zakat
  zakat: {
    compute: (params: Record<string, unknown>) => ipcRenderer.invoke('zakat:compute', params),
    saveAdvance: (data: Record<string, unknown>) => ipcRenderer.invoke('zakat:save-advance', data),
    deleteAdvance: (id: string) => ipcRenderer.invoke('zakat:delete-advance', id),
  },

  // Auth
  auth: {
    login: (data: Record<string, unknown>) => ipcRenderer.invoke('auth:login', data),
    logout: () => ipcRenderer.invoke('auth:logout'),
    changePassword: (data: Record<string, unknown>) => ipcRenderer.invoke('auth:change-password', data),
  },

  // Users
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('users:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('users:update', data),
    resetPassword: (data: Record<string, unknown>) => ipcRenderer.invoke('users:reset-password', data),
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
} as const;

contextBridge.exposeInMainWorld('api', api);


export type DesktopAPI = typeof api;
