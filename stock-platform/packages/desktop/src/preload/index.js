/**
 * Preload script — exposes a safe API from main process to renderer.
 * Uses contextBridge for security isolation.
 */
import { contextBridge, ipcRenderer } from 'electron';
const api = {
    // Master Data
    suppliers: { list: () => ipcRenderer.invoke('suppliers:list') },
    boutiques: { list: () => ipcRenderer.invoke('boutiques:list') },
    categories: { list: () => ipcRenderer.invoke('categories:list') },
    // Purchases
    purchases: {
        list: (params) => ipcRenderer.invoke('purchases:list', params),
        create: (data) => ipcRenderer.invoke('purchases:create', data),
    },
    // Stock
    stock: {
        list: (params) => ipcRenderer.invoke('stock:list', params),
    },
    // Sales
    sales: {
        list: () => ipcRenderer.invoke('sales:list'),
        create: (data) => ipcRenderer.invoke('sales:create', data),
        delete: (id) => ipcRenderer.invoke('sales:delete', id),
    },
    // Maintenance
    maintenance: {
        create: (data) => ipcRenderer.invoke('maintenance:create', data),
    },
    // Battery Repair
    batteryRepair: {
        create: (data) => ipcRenderer.invoke('battery-repair:create', data),
        tariffs: () => ipcRenderer.invoke('battery-repair:tariffs'),
    },
    // Expenses
    expenses: {
        create: (data) => ipcRenderer.invoke('expenses:create', data),
    },
    // Customer Credits
    customerCredits: {
        list: () => ipcRenderer.invoke('customer-credits:list'),
        create: (data) => ipcRenderer.invoke('customer-credits:create', data),
    },
    // Supplier Credits
    supplierCredits: {
        create: (data) => ipcRenderer.invoke('supplier-credits:create', data),
    },
    // Bank Movements
    bankMovements: {
        create: (data) => ipcRenderer.invoke('bank-movements:create', data),
        summary: () => ipcRenderer.invoke('bank-movements:summary'),
    },
    // Sync
    sync: {
        status: () => ipcRenderer.invoke('sync:status'),
        trigger: () => ipcRenderer.invoke('sync:trigger'),
    },
};
contextBridge.exposeInMainWorld('api', api);
//# sourceMappingURL=index.js.map