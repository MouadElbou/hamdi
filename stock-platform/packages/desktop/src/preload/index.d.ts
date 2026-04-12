/**
 * Preload script — exposes a safe API from main process to renderer.
 * Uses contextBridge for security isolation.
 */
declare const api: {
    readonly suppliers: {
        readonly list: () => Promise<any>;
    };
    readonly boutiques: {
        readonly list: () => Promise<any>;
    };
    readonly categories: {
        readonly list: () => Promise<any>;
    };
    readonly purchases: {
        readonly list: (params: Record<string, unknown>) => Promise<any>;
        readonly create: (data: Record<string, unknown>) => Promise<any>;
        readonly update: (data: Record<string, unknown>) => Promise<any>;
        readonly delete: (id: string) => Promise<any>;
    };
    readonly stock: {
        readonly list: (params: Record<string, unknown>) => Promise<any>;
        readonly lowStockAlerts: () => Promise<any>;
    };
    readonly sales: {
        readonly list: () => Promise<any>;
        readonly create: (data: Record<string, unknown>) => Promise<any>;
        readonly update: (data: Record<string, unknown>) => Promise<any>;
        readonly delete: (id: string) => Promise<any>;
    };
    readonly maintenance: {
        readonly list: () => Promise<any>;
        readonly create: (data: Record<string, unknown>) => Promise<any>;
        readonly update: (data: Record<string, unknown>) => Promise<any>;
        readonly delete: (id: string) => Promise<any>;
    };
    readonly batteryRepair: {
        readonly list: () => Promise<any>;
        readonly create: (data: Record<string, unknown>) => Promise<any>;
        readonly update: (data: Record<string, unknown>) => Promise<any>;
        readonly delete: (id: string) => Promise<any>;
        readonly tariffs: () => Promise<any>;
    };
    readonly expenses: {
        readonly list: () => Promise<any>;
        readonly create: (data: Record<string, unknown>) => Promise<any>;
        readonly update: (data: Record<string, unknown>) => Promise<any>;
        readonly delete: (id: string) => Promise<any>;
    };
    readonly customerCredits: {
        readonly list: () => Promise<any>;
        readonly create: (data: Record<string, unknown>) => Promise<any>;
        readonly update: (data: Record<string, unknown>) => Promise<any>;
        readonly delete: (id: string) => Promise<any>;
        readonly addPayment: (data: Record<string, unknown>) => Promise<any>;
    };
    readonly supplierCredits: {
        readonly list: () => Promise<any>;
        readonly create: (data: Record<string, unknown>) => Promise<any>;
        readonly update: (data: Record<string, unknown>) => Promise<any>;
        readonly delete: (id: string) => Promise<any>;
        readonly addPayment: (data: Record<string, unknown>) => Promise<any>;
    };
    readonly bankMovements: {
        readonly list: () => Promise<any>;
        readonly create: (data: Record<string, unknown>) => Promise<any>;
        readonly update: (data: Record<string, unknown>) => Promise<any>;
        readonly delete: (id: string) => Promise<any>;
        readonly summary: () => Promise<any>;
    };
    readonly dashboard: {
        readonly stats: () => Promise<any>;
    };
    readonly monthlySummary: {
        readonly get: (params: Record<string, unknown>) => Promise<any>;
    };
    readonly zakat: {
        readonly compute: (params: Record<string, unknown>) => Promise<any>;
        readonly saveAdvance: (data: Record<string, unknown>) => Promise<any>;
    };
    readonly sync: {
        readonly status: () => Promise<any>;
        readonly trigger: () => Promise<any>;
    };
};
export type DesktopAPI = typeof api;
export {};
