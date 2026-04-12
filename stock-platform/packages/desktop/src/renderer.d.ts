/** Type declarations for the preload bridge API exposed via contextBridge */

interface DesktopAPI {
  suppliers: {
    list: () => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
  };
  boutiques: {
    list: () => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
  };
  categories: {
    list: () => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
  };
  subCategories: {
    list: (params?: Record<string, unknown>) => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
  };
  clients: {
    list: () => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    search: (query: string) => Promise<unknown>;
  };
  employees: {
    list: () => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  salaryPayments: {
    list: (params?: Record<string, unknown>) => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  purchases: {
    list: (params: Record<string, unknown>) => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  stock: {
    list: (params: Record<string, unknown>) => Promise<unknown>;
    lowStockAlerts: () => Promise<unknown>;
    lookupBarcode: (data: Record<string, unknown>) => Promise<unknown>;
  };
  sales: {
    list: (params?: Record<string, unknown>) => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
    return: (data: Record<string, unknown>) => Promise<unknown>;
  };
  maintenance: {
    list: (params?: Record<string, unknown>) => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  maintenanceTypes: {
    list: () => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
  };
  expenseDesignations: {
    list: () => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
  };
  batteryRepair: {
    list: (params?: Record<string, unknown>) => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
    tariffs: () => Promise<unknown>;
    createTariff: (data: Record<string, unknown>) => Promise<unknown>;
    updateTariff: (data: Record<string, unknown>) => Promise<unknown>;
    deleteTariff: (id: string) => Promise<unknown>;
  };
  expenses: {
    list: (params?: Record<string, unknown>) => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  customerCredits: {
    list: (params?: Record<string, unknown>) => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
    addPayment: (data: Record<string, unknown>) => Promise<unknown>;
    deletePayment: (id: string) => Promise<unknown>;
    history: (name: string) => Promise<unknown>;
  };
  supplierCredits: {
    list: (params?: Record<string, unknown>) => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
    addPayment: (data: Record<string, unknown>) => Promise<unknown>;
    deletePayment: (id: string) => Promise<unknown>;
    history: (code: string) => Promise<unknown>;
  };
  notifications: {
    unpaidCustomerCredits: () => Promise<unknown>;
    unpaidSupplierCredits: () => Promise<unknown>;
  };
  customerOrders: {
    list: (params?: Record<string, unknown>) => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (data: Record<string, unknown>) => Promise<unknown>;
    updateStatus: (data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  bankMovements: {
    list: (params?: Record<string, unknown>) => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
    summary: () => Promise<unknown>;
  };
  auth: {
    login: (data: Record<string, unknown>) => Promise<unknown>;
    logout: () => Promise<unknown>;
    changePassword: (data: Record<string, unknown>) => Promise<unknown>;
  };
  users: {
    list: () => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (data: Record<string, unknown>) => Promise<unknown>;
    resetPassword: (data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  sync: {
    status: () => Promise<{ connected: boolean; pendingOps: number; lastSync: string | null }>;
    trigger: () => Promise<unknown>;
    listConflicts: () => Promise<Array<{
      id: string;
      entity_type: string;
      entity_id: string;
      operation: string;
      payload: string;
      version: number;
      created_at: string;
      status: string;
    }>>;
    dismissConflict: (outboxId: string) => Promise<{ dismissed: boolean }>;
    retryConflict: (outboxId: string) => Promise<{ retried: boolean; reason?: string }>;
  };
  backup: {
    create: () => Promise<{ success?: boolean; cancelled?: boolean; path?: string }>;
    restore: () => Promise<{ success?: boolean; cancelled?: boolean }>;
  };
  dashboard: {
    stats: () => Promise<unknown>;
  };
  monthlySummary: {
    get: (params?: Record<string, unknown>) => Promise<unknown>;
  };
  zakat: {
    compute: (params?: Record<string, unknown>) => Promise<unknown>;
    saveAdvance: (data: Record<string, unknown>) => Promise<unknown>;
    deleteAdvance: (id: string) => Promise<unknown>;
  };
}

declare global {
  interface Window {
    api: DesktopAPI;
  }
}

export { };
