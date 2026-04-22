import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

// Self-hosted fonts (replaces external Google Fonts)
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/jetbrains-mono';

// Stub window.api when running outside Electron (e.g. vite dev in browser)
if (!window.api && import.meta.env.DEV) {
  /* ─── Mock data matching seeded database ─── */
  const MOCK = {
    users: [
      { id: 'user-hicham', username: 'hicham', password: 'Admin@123', display_name: 'HICHAM', role: 'admin', employee_id: null, employee_name: null, is_active: 1, must_change_password: 0, permissions: ['dashboard','purchases','stock','sales','maintenance','battery-repair','expenses','credits','bank','monthly-summary','zakat'] },
      { id: 'user-samir', username: 'samir', password: 'Admin@123', display_name: 'SAMIR', role: 'admin', employee_id: null, employee_name: null, is_active: 1, must_change_password: 0, permissions: ['dashboard','purchases','stock','sales','maintenance','battery-repair','expenses','credits','bank','monthly-summary','zakat'] },
    ] as Array<{ id: string; username: string; password: string; display_name: string; role: string; employee_id: string | null; employee_name: string | null; is_active: number; must_change_password: number; permissions: string[] }>,

    suppliers: [
      { id: 'sup-ab', code: 'AB' }, { id: 'sup-f5', code: 'F5' },
      { id: 'sup-mag', code: 'MAG' }, { id: 'sup-mc', code: 'MC' },
    ],
    boutiques: [
      { id: 'bout-mliliya', name: 'MLILIYA' }, { id: 'bout-tayret', name: 'TAYRET' },
      { id: 'bout-eplacement', name: 'EPLACEMENT' },
    ],
    categories: [
      'PP RAM','PP SSD','PP HDD','CABLES HDMI / DISPLAY','PP CHARGEUR NEUF COPY',
      'CASQUES','GSM CHARGEUR','LAPTOP HP','FLASH/SD','PP BATTERIE HP','CABLES USB','PP CLAVIER HP',
    ].map(n => ({ id: `cat-${n.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: n })),

    purchaseLots: [
      { id: 'lot-1', ref_number: 'PUR-001', date: '2026-01-15', designation: 'RAM DDR4 8GB 2666MHz', category_name: 'PP RAM', supplier_code: 'AB', boutique_name: 'MLILIYA', initial_quantity: 20, purchase_unit_cost: 350000, target_resale_price: 500000, selling_price: 480000, sold_quantity: 6, barcode: '8801643264307' },
      { id: 'lot-2', ref_number: 'PUR-002', date: '2026-01-20', designation: 'SSD NVMe 256GB Samsung', category_name: 'PP SSD', supplier_code: 'F5', boutique_name: 'MLILIYA', initial_quantity: 15, purchase_unit_cost: 450000, target_resale_price: 650000, selling_price: 620000, sold_quantity: 4, barcode: '8806090729140' },
      { id: 'lot-3', ref_number: 'PUR-003', date: '2026-02-01', designation: 'HDD 1TB Seagate 2.5"', category_name: 'PP HDD', supplier_code: 'MAG', boutique_name: 'TAYRET', initial_quantity: 10, purchase_unit_cost: 550000, target_resale_price: 750000, selling_price: null, sold_quantity: 3, barcode: '7636490078415' },
      { id: 'lot-4', ref_number: 'PUR-004', date: '2026-02-05', designation: 'Cable HDMI 2.0 1.5m', category_name: 'CABLES HDMI / DISPLAY', supplier_code: 'MC', boutique_name: 'MLILIYA', initial_quantity: 50, purchase_unit_cost: 15000, target_resale_price: 30000, selling_price: 25000, sold_quantity: 15, barcode: '' },
      { id: 'lot-5', ref_number: 'PUR-005', date: '2026-02-10', designation: 'Chargeur HP 65W 19.5V', category_name: 'PP CHARGEUR NEUF COPY', supplier_code: 'AB', boutique_name: 'TAYRET', initial_quantity: 25, purchase_unit_cost: 200000, target_resale_price: 350000, selling_price: null, sold_quantity: 7, barcode: '' },
      { id: 'lot-6', ref_number: 'PUR-006', date: '2026-02-15', designation: 'Casque Bluetooth Over-Ear', category_name: 'CASQUES', supplier_code: 'F5', boutique_name: 'MLILIYA', initial_quantity: 30, purchase_unit_cost: 180000, target_resale_price: 300000, selling_price: 280000, sold_quantity: 9, barcode: '4950344091038' },
      { id: 'lot-7', ref_number: 'PUR-007', date: '2026-02-20', designation: 'Chargeur USB-C 20W', category_name: 'GSM CHARGEUR', supplier_code: 'MC', boutique_name: 'MLILIYA', initial_quantity: 40, purchase_unit_cost: 80000, target_resale_price: 150000, selling_price: 140000, sold_quantity: 12, barcode: '' },
      { id: 'lot-8', ref_number: 'PUR-008', date: '2026-03-01', designation: 'HP ProBook 450 G10 i5/8GB/256GB', category_name: 'LAPTOP HP', supplier_code: 'AB', boutique_name: 'MLILIYA', initial_quantity: 5, purchase_unit_cost: 7500000, target_resale_price: 9500000, selling_price: null, sold_quantity: 1, barcode: '1953517916004' },
      { id: 'lot-9', ref_number: 'PUR-009', date: '2026-03-05', designation: 'Cle USB 3.0 64GB Kingston', category_name: 'FLASH/SD', supplier_code: 'MAG', boutique_name: 'TAYRET', initial_quantity: 60, purchase_unit_cost: 25000, target_resale_price: 50000, selling_price: 45000, sold_quantity: 18, barcode: '0740617301892' },
      { id: 'lot-10', ref_number: 'PUR-010', date: '2026-03-10', designation: 'Batterie HP EliteBook 840 G5', category_name: 'PP BATTERIE HP', supplier_code: 'F5', boutique_name: 'MLILIYA', initial_quantity: 12, purchase_unit_cost: 400000, target_resale_price: 600000, selling_price: null, sold_quantity: 3, barcode: '' },
      { id: 'lot-11', ref_number: 'PUR-011', date: '2026-03-12', designation: 'Cable USB-C vers USB-A 1m', category_name: 'CABLES USB', supplier_code: 'MC', boutique_name: 'TAYRET', initial_quantity: 80, purchase_unit_cost: 10000, target_resale_price: 25000, selling_price: 20000, sold_quantity: 24, barcode: '' },
      { id: 'lot-12', ref_number: 'PUR-012', date: '2026-03-15', designation: 'Clavier HP ProBook 450 G7 FR', category_name: 'PP CLAVIER HP', supplier_code: 'AB', boutique_name: 'MLILIYA', initial_quantity: 8, purchase_unit_cost: 250000, target_resale_price: 400000, selling_price: 380000, sold_quantity: 2, barcode: '' },
    ],

    saleOrders: [
      { id: 'sal-1', ref_number: 'SAL-001', date: '2026-03-16', observation: 'Client fidele', client_name: 'ABDO BENTAJ', totalAmount: 280000000, totalMargin: 95000000,
        lines: [
          { designation: 'RAM DDR4 8GB 2666MHz', category: 'PP RAM', quantity: 3, selling_unit_price: 500000, purchase_unit_cost: 350000 },
          { designation: 'SSD NVMe 256GB Samsung', category: 'PP SSD', quantity: 2, selling_unit_price: 650000, purchase_unit_cost: 450000 },
        ] },
      { id: 'sal-2', ref_number: 'SAL-002', date: '2026-03-17', observation: null, client_name: null, totalAmount: 105000000, totalMargin: 50000000,
        lines: [
          { designation: 'Cable HDMI 2.0 1.5m', category: 'CABLES HDMI / DISPLAY', quantity: 10, selling_unit_price: 30000, purchase_unit_cost: 15000 },
          { designation: 'Chargeur USB-C 20W', category: 'GSM CHARGEUR', quantity: 5, selling_unit_price: 150000, purchase_unit_cost: 80000 },
        ] },
      { id: 'sal-3', ref_number: 'SAL-003', date: '2026-03-18', observation: 'Revendeur Tayret', client_name: 'MOHAMMED ALAMI', totalAmount: 246000000, totalMargin: 76000000,
        lines: [
          { designation: 'Chargeur HP 65W 19.5V', category: 'PP CHARGEUR NEUF COPY', quantity: 3, selling_unit_price: 320000, purchase_unit_cost: 200000 },
          { designation: 'HDD 1TB Seagate 2.5"', category: 'PP HDD', quantity: 2, selling_unit_price: 750000, purchase_unit_cost: 550000 },
        ] },
      { id: 'sal-4', ref_number: 'SAL-004', date: '2026-03-20', observation: null, client_name: null, totalAmount: 1070000000, totalMargin: 268000000,
        lines: [
          { designation: 'HP ProBook 450 G10', category: 'LAPTOP HP', quantity: 1, selling_unit_price: 9500000, purchase_unit_cost: 7500000 },
          { designation: 'Casque Bluetooth Over-Ear', category: 'CASQUES', quantity: 4, selling_unit_price: 300000, purchase_unit_cost: 180000 },
        ] },
      { id: 'sal-5', ref_number: 'SAL-005', date: '2026-03-22', observation: 'Lot flash USB', client_name: 'YASSIN BENTAJ', totalAmount: 125000000, totalMargin: 67500000,
        lines: [
          { designation: 'Cle USB 3.0 64GB Kingston', category: 'FLASH/SD', quantity: 15, selling_unit_price: 50000, purchase_unit_cost: 25000 },
          { designation: 'Cable USB-C vers USB-A 1m', category: 'CABLES USB', quantity: 20, selling_unit_price: 25000, purchase_unit_cost: 10000 },
        ] },
    ],

    maintenanceJobs: [
      { id: 'mnt-1', date: '2026-03-10', designation: 'INSTALL Windows 11 + Office', price: 150000, boutique_name: 'MLILIYA' },
      { id: 'mnt-2', date: '2026-03-12', designation: 'REPARATION DELL charniere', price: 250000, boutique_name: 'MLILIYA' },
      { id: 'mnt-3', date: '2026-03-15', designation: 'INSTALL + transfert donnees', price: 200000, boutique_name: 'TAYRET' },
      { id: 'mnt-4', date: '2026-03-20', designation: 'CARCASSE HP ProBook', price: 350000, boutique_name: 'MLILIYA' },
    ],

    batteryRepairJobs: [
      { id: 'bat-1', date: '2026-03-11', description: 'BALLANCER/CHARGER/DECHARGER LES CELLULES', customer_note: 'HP EliteBook 840', amount: 10000, cost_adjustment: 0 },
      { id: 'bat-2', date: '2026-03-14', description: 'REPARATION DE LA CARTE', customer_note: 'Dell Latitude 5520', amount: 15000, cost_adjustment: 2000 },
      { id: 'bat-3', date: '2026-03-19', description: 'FLASH UNLOCK', customer_note: 'Lenovo ThinkPad', amount: 20000, cost_adjustment: 0 },
    ],

    batteryTariffs: [
      { id: 'tar-1', label: 'BALLANCER/CHARGER/DECHARGER LES CELLULES', particuliers_price: 10000, rev_price: 8000 },
      { id: 'tar-2', label: 'REPARATION DE LA CARTE', particuliers_price: 15000, rev_price: 12000 },
      { id: 'tar-3', label: 'FLASH UNLOCK', particuliers_price: 20000, rev_price: 15000 },
      { id: 'tar-4', label: 'RECONDITIONNEMENT COMPLET', particuliers_price: null, rev_price: null },
    ],

    expenses: [
      { id: 'exp-1', date: '2026-03-01', designation: 'Loyer depot mars', amount: 3000000, boutique_name: 'MLILIYA' },
      { id: 'exp-2', date: '2026-03-01', designation: 'Electricite mars', amount: 450000, boutique_name: 'MLILIYA' },
      { id: 'exp-3', date: '2026-03-05', designation: 'SDTM materiel nettoyage', amount: 120000, boutique_name: 'TAYRET' },
      { id: 'exp-4', date: '2026-03-10', designation: 'Internet fibre', amount: 350000, boutique_name: 'MLILIYA' },
      { id: 'exp-5', date: '2026-03-15', designation: 'SAC emballages', amount: 80000, boutique_name: 'TAYRET' },
    ],

    customerCredits: [
      { id: 'cc-1', date: '2026-03-08', customer_name: 'ABDO BENTAJ', designation: 'Laptop HP + RAM upgrade', quantity: 1, unit_price: 10000000, advance_paid: 5000000, total_amount: 10000000, total_payments: 0, remainingBalance: 5000000 },
      { id: 'cc-2', date: '2026-03-14', customer_name: 'YASSIN BENTAJ', designation: 'SSD 512GB + Installation', quantity: 1, unit_price: 800000, advance_paid: 300000, total_amount: 800000, total_payments: 0, remainingBalance: 500000 },
    ],

    supplierCredits: [
      { id: 'sc-1', date: '2026-02-28', supplier_code: 'AB', designation: 'Lot HP ProBook', total_amount: 15000000, advance_paid: 10000000, total_payments: 0, remainingBalance: 5000000 },
    ],

    bankMovements: [
      { id: 'bk-1', date: '2026-03-01', description: 'Virement client ABDO BENTAJ', amount_in: 5000000, amount_out: 0 },
      { id: 'bk-2', date: '2026-03-05', description: 'Paiement fournisseur AB', amount_in: 0, amount_out: 10000000 },
      { id: 'bk-3', date: '2026-03-15', description: 'Depot especes mars', amount_in: 8000000, amount_out: 0 },
      { id: 'bk-4', date: '2026-03-20', description: 'Virement client laptop', amount_in: 9500000, amount_out: 0 },
    ],

    clients: [
      { id: 'cli-1', name: 'ABDO BENTAJ', phone: null },
      { id: 'cli-2', name: 'YASSIN BENTAJ', phone: '0661234567' },
      { id: 'cli-3', name: 'MOHAMMED ALAMI', phone: null },
    ],

    employees: [
      { id: 'emp-1', name: 'OMAR BENALI', monthly_salary: 5000000, start_date: '2025-01-01', is_active: 1 },
      { id: 'emp-2', name: 'YOUSSEF WAHBI', monthly_salary: 4500000, start_date: '2025-06-15', is_active: 1 },
    ],

    salaryPayments: [
      { id: 'sp-1', date: '2026-03-01', amount: 5000000, note: 'Salaire mars', employee_id: 'emp-1', employee_name: 'OMAR BENALI' },
      { id: 'sp-2', date: '2026-03-01', amount: 4500000, note: 'Salaire mars', employee_id: 'emp-2', employee_name: 'YOUSSEF WAHBI' },
    ],

    maintenanceTypes: [
      { id: 'mt-1', name: 'INSTALL' }, { id: 'mt-2', name: 'CARCASSE' },
      { id: 'mt-3', name: 'REPARATION DELL' }, { id: 'mt-4', name: 'OFFICE' }, { id: 'mt-5', name: 'CONN TAB' },
    ],

    expenseDesignations: [
      { id: 'ed-1', name: 'CAHIER' }, { id: 'ed-2', name: 'SDTM' },
      { id: 'ed-3', name: 'SAC' }, { id: 'ed-4', name: 'AJAX+CLINIX' },
    ],
  };

  // Computed dashboard stats
  const totalStockValue = MOCK.purchaseLots.reduce((s, l) =>
    s + (l.initial_quantity - l.sold_quantity) * l.purchase_unit_cost, 0);
  const monthlySales = MOCK.saleOrders.reduce((s, o) => s + o.totalAmount, 0);
  const monthlyMargin = MOCK.saleOrders.reduce((s, o) => s + o.totalMargin, 0);
  const monthlyMaintenance = MOCK.maintenanceJobs.reduce((s, j) => s + j.price, 0);
  const monthlyExpenses = MOCK.expenses.reduce((s, e) => s + e.amount, 0);

  const api = {
    suppliers: {
      list: () => Promise.resolve(MOCK.suppliers),
      create: (data: Record<string, unknown>) => {
        const code = ((data.code as string) || '').toUpperCase();
        const existing = MOCK.suppliers.find(s => s.code === code);
        if (existing) return Promise.resolve(existing);
        const s = { id: `sup-${Date.now()}`, code };
        MOCK.suppliers.push(s);
        return Promise.resolve(s);
      },
    },
    boutiques: {
      list: () => Promise.resolve(MOCK.boutiques),
      create: (data: Record<string, unknown>) => {
        const name = ((data.name as string) || '').toUpperCase();
        const existing = MOCK.boutiques.find(b => b.name === name);
        if (existing) return Promise.resolve(existing);
        const b = { id: `bout-${Date.now()}`, name };
        MOCK.boutiques.push(b);
        return Promise.resolve(b);
      },
    },
    categories: {
      list: () => Promise.resolve(MOCK.categories),
      create: (data: Record<string, unknown>) => {
        const name = ((data.name as string) || '').toUpperCase();
        const existing = MOCK.categories.find(c => c.name === name);
        if (existing) return Promise.resolve(existing);
        const c = { id: `cat-${Date.now()}`, name };
        MOCK.categories.push(c);
        return Promise.resolve(c);
      },
    },
    subCategories: {
      list: () => Promise.resolve([]),
      create: (data: Record<string, unknown>) => {
        const sc = { id: `subcat-${Date.now()}`, name: data.name as string, category_id: data.categoryId as string };
        return Promise.resolve(sc);
      },
    },
    purchases: {
      list: () => Promise.resolve({ items: MOCK.purchaseLots, total: MOCK.purchaseLots.length, page: 1, limit: 50 }),
      create: (data: Record<string, unknown>) => {
        const id = `lot-${Date.now()}`;
        const refNumber = `PUR-${Date.now()}`;
        MOCK.purchaseLots.unshift({ id, ref_number: refNumber, date: data.date as string, designation: data.designation as string, category_name: data.category as string, supplier_code: data.supplier as string, boutique_name: data.boutique as string, initial_quantity: data.initialQuantity as number, purchase_unit_cost: data.purchaseUnitCost as number, target_resale_price: (data.targetResalePrice as number) ?? null, sold_quantity: 0 });
        return Promise.resolve({ id, refNumber });
      },
      update: (data: Record<string, unknown>) => {
        const idx = MOCK.purchaseLots.findIndex(l => l.id === data.id);
        if (idx >= 0) Object.assign(MOCK.purchaseLots[idx], { date: data.date, designation: data.designation, category_name: data.category, supplier_code: data.supplier, boutique_name: data.boutique, initial_quantity: data.initialQuantity, purchase_unit_cost: data.purchaseUnitCost, target_resale_price: data.targetResalePrice ?? null });
        return Promise.resolve({ success: true });
      },
      delete: (id: string) => {
        const idx = MOCK.purchaseLots.findIndex(l => l.id === id);
        if (idx >= 0) MOCK.purchaseLots.splice(idx, 1);
        return Promise.resolve({ success: true });
      },
    },
    stock: {
      list: () => { const items = MOCK.purchaseLots.map(l => ({
        lotId: l.id, refNumber: l.ref_number, designation: l.designation, category: l.category_name,
        remainingQuantity: l.initial_quantity - l.sold_quantity, purchaseUnitCost: l.purchase_unit_cost,
        barcode: l.barcode || null,
      })); return Promise.resolve({ items, total: items.length }); },
      lowStockAlerts: () => Promise.resolve(
        MOCK.purchaseLots
          .map(l => ({ id: l.id, designation: l.designation, category: l.category_name, remaining: l.initial_quantity - l.sold_quantity }))
          .filter(r => r.remaining > 0 && r.remaining <= 1)
      ),
      lookupBarcode: (data: Record<string, unknown>) => {
        const barcode = data.barcode as string;
        const lot = MOCK.purchaseLots.find(l => l.barcode === barcode && (l.initial_quantity - l.sold_quantity) > 0);
        if (!lot) return Promise.resolve(null);
        return Promise.resolve({
          lotId: lot.id, designation: lot.designation, category: lot.category_name,
          remainingQuantity: lot.initial_quantity - lot.sold_quantity,
          sellingPrice: lot.selling_price || null, purchaseUnitCost: lot.purchase_unit_cost,
          targetResalePrice: lot.target_resale_price || null, barcode: lot.barcode,
        });
      },
    },
    sales: {
      list: () => Promise.resolve({ items: MOCK.saleOrders, total: MOCK.saleOrders.length }),
      create: (data: Record<string, unknown>) => {
        const id = `sal-${Date.now()}`;
        const refNumber = `SAL-${Date.now()}`;
        const lines = (data.lines as Array<Record<string, unknown>>) || [];
        const totalAmount = lines.reduce((s, l) => s + (l.quantity as number) * (l.sellingUnitPrice as number), 0);
        const totalMargin = lines.reduce((s, l) => s + ((l.sellingUnitPrice as number) - 0) * (l.quantity as number), 0);
        MOCK.saleOrders.unshift({ id, ref_number: refNumber, date: data.date as string, observation: (data.observation as string) || null, client_name: (data.clientName as string) || null, totalAmount, totalMargin, lines: lines.map(l => ({ designation: '', category: '', quantity: l.quantity as number, selling_unit_price: l.sellingUnitPrice as number, purchase_unit_cost: 0 })) });
        return Promise.resolve({ id, refNumber });
      },
      update: (data: Record<string, unknown>) => {
        const idx = MOCK.saleOrders.findIndex(o => o.id === data.id);
        if (idx >= 0) Object.assign(MOCK.saleOrders[idx], { date: data.date, observation: data.observation || null, client_name: data.clientName || null });
        return Promise.resolve({ success: true });
      },
      delete: (id: string) => {
        const idx = MOCK.saleOrders.findIndex(o => o.id === id);
        if (idx >= 0) MOCK.saleOrders.splice(idx, 1);
        return Promise.resolve({ success: true });
      },
      return: (_data: Record<string, unknown>) => {
        return Promise.resolve({ id: `ret-${Date.now()}`, refNumber: `RET-${Date.now()}` });
      },
    },
    maintenance: {
      list: () => Promise.resolve({ items: MOCK.maintenanceJobs, total: MOCK.maintenanceJobs.length }),
      create: (data: Record<string, unknown>) => {
        const id = `mnt-${Date.now()}`;
        MOCK.maintenanceJobs.unshift({ id, date: data.date as string, designation: data.designation as string, price: data.price as number, boutique_name: data.boutique as string });
        return Promise.resolve({ id });
      },
      update: (data: Record<string, unknown>) => {
        const idx = MOCK.maintenanceJobs.findIndex(j => j.id === data.id);
        if (idx >= 0) Object.assign(MOCK.maintenanceJobs[idx], { date: data.date, designation: data.designation, price: data.price, boutique_name: data.boutique });
        return Promise.resolve({ success: true });
      },
      delete: (id: string) => {
        const idx = MOCK.maintenanceJobs.findIndex(j => j.id === id);
        if (idx >= 0) MOCK.maintenanceJobs.splice(idx, 1);
        return Promise.resolve({ success: true });
      },
    },
    batteryRepair: {
      list: () => Promise.resolve({ items: MOCK.batteryRepairJobs, total: MOCK.batteryRepairJobs.length }),
      create: (data: Record<string, unknown>) => {
        const id = `bat-${Date.now()}`;
        MOCK.batteryRepairJobs.unshift({ id, date: data.date as string, description: data.description as string, customer_note: (data.customerNote as string) || null, amount: data.amount as number, cost_adjustment: (data.costAdjustment as number) || 0 });
        return Promise.resolve({ id });
      },
      update: (data: Record<string, unknown>) => {
        const idx = MOCK.batteryRepairJobs.findIndex(j => j.id === data.id);
        if (idx >= 0) Object.assign(MOCK.batteryRepairJobs[idx], { date: data.date, description: data.description, customer_note: data.customerNote || null, amount: data.amount, cost_adjustment: data.costAdjustment || 0 });
        return Promise.resolve({ success: true });
      },
      delete: (id: string) => {
        const idx = MOCK.batteryRepairJobs.findIndex(j => j.id === id);
        if (idx >= 0) MOCK.batteryRepairJobs.splice(idx, 1);
        return Promise.resolve({ success: true });
      },
      tariffs: () => Promise.resolve(MOCK.batteryTariffs),
      createTariff: (data: Record<string, unknown>) => {
        const t = { id: `tar-${Date.now()}`, label: data.label as string, particuliers_price: (data.particuliersPrice as number) ?? null, rev_price: (data.revPrice as number) ?? null };
        MOCK.batteryTariffs.push(t);
        return Promise.resolve(t);
      },
      updateTariff: (data: Record<string, unknown>) => {
        const idx = MOCK.batteryTariffs.findIndex(t => t.id === data.id);
        if (idx >= 0) {
          MOCK.batteryTariffs[idx] = { ...MOCK.batteryTariffs[idx], label: data.label as string, particuliers_price: (data.particuliersPrice as number) ?? null, rev_price: (data.revPrice as number) ?? null };
        }
        return Promise.resolve({ success: true });
      },
      deleteTariff: (id: string) => {
        const idx = MOCK.batteryTariffs.findIndex(t => t.id === id);
        if (idx >= 0) MOCK.batteryTariffs.splice(idx, 1);
        return Promise.resolve({ success: true });
      },
    },
    expenses: {
      list: () => Promise.resolve({ items: MOCK.expenses, total: MOCK.expenses.length }),
      create: (data: Record<string, unknown>) => {
        const id = `exp-${Date.now()}`;
        MOCK.expenses.unshift({ id, date: data.date as string, designation: data.designation as string, amount: data.amount as number, boutique_name: data.boutique as string });
        return Promise.resolve({ id });
      },
      update: (data: Record<string, unknown>) => {
        const idx = MOCK.expenses.findIndex(e => e.id === data.id);
        if (idx >= 0) Object.assign(MOCK.expenses[idx], { date: data.date, designation: data.designation, amount: data.amount, boutique_name: data.boutique });
        return Promise.resolve({ success: true });
      },
      delete: (id: string) => {
        const idx = MOCK.expenses.findIndex(e => e.id === id);
        if (idx >= 0) MOCK.expenses.splice(idx, 1);
        return Promise.resolve({ success: true });
      },
    },
    customerCredits: {
      list: () => Promise.resolve({ items: MOCK.customerCredits, total: MOCK.customerCredits.length }),
      create: (data: Record<string, unknown>) => {
        const id = `cc-${Date.now()}`;
        const totalAmount = (data.quantity as number) * (data.unitPrice as number);
        const advancePaid = (data.advancePaid as number) || 0;
        const cc = { id, date: data.date as string, customer_name: data.customerName as string, designation: data.designation as string, quantity: data.quantity as number, unit_price: data.unitPrice as number, advance_paid: advancePaid, total_amount: totalAmount, total_payments: 0, remainingBalance: totalAmount - advancePaid };
        MOCK.customerCredits.unshift(cc);
        return Promise.resolve({ id });
      },
      update: (data: Record<string, unknown>) => {
        const idx = MOCK.customerCredits.findIndex(c => c.id === data.id);
        if (idx >= 0) {
          const cc = MOCK.customerCredits[idx];
          const totalAmount = (data.quantity as number) * (data.unitPrice as number);
          const advancePaid = (data.advancePaid as number) || 0;
          Object.assign(cc, { date: data.date, customer_name: data.customerName, designation: data.designation, quantity: data.quantity, unit_price: data.unitPrice, advance_paid: advancePaid, total_amount: totalAmount, remainingBalance: totalAmount - advancePaid - cc.total_payments });
        }
        return Promise.resolve({ success: true });
      },
      delete: (id: string) => {
        const idx = MOCK.customerCredits.findIndex(c => c.id === id);
        if (idx >= 0) MOCK.customerCredits.splice(idx, 1);
        return Promise.resolve({ success: true });
      },
      addPayment: (data: Record<string, unknown>) => {
        const id = `ccp-${Date.now()}`;
        const cc = MOCK.customerCredits.find(c => c.id === data.creditId);
        if (cc) { cc.total_payments += data.amount as number; cc.remainingBalance -= data.amount as number; }
        return Promise.resolve({ id });
      },
      deletePayment: () => Promise.resolve({ success: true }),
      history: () => Promise.resolve([]),
    },
    supplierCredits: {
      list: () => Promise.resolve({ items: MOCK.supplierCredits, total: MOCK.supplierCredits.length }),
      create: (data: Record<string, unknown>) => {
        const id = `sc-${Date.now()}`;
        const advancePaid = (data.advancePaid as number) || 0;
        const sc = { id, date: data.date as string, supplier_code: data.supplier as string, designation: data.designation as string, total_amount: data.totalAmount as number, advance_paid: advancePaid, total_payments: 0, remainingBalance: (data.totalAmount as number) - advancePaid };
        MOCK.supplierCredits.unshift(sc);
        return Promise.resolve({ id });
      },
      update: (data: Record<string, unknown>) => {
        const idx = MOCK.supplierCredits.findIndex(c => c.id === data.id);
        if (idx >= 0) {
          const sc = MOCK.supplierCredits[idx];
          const advancePaid = (data.advancePaid as number) || 0;
          Object.assign(sc, { date: data.date, supplier_code: data.supplier, designation: data.designation, total_amount: data.totalAmount, advance_paid: advancePaid, remainingBalance: (data.totalAmount as number) - advancePaid - sc.total_payments });
        }
        return Promise.resolve({ success: true });
      },
      delete: (id: string) => {
        const idx = MOCK.supplierCredits.findIndex(c => c.id === id);
        if (idx >= 0) MOCK.supplierCredits.splice(idx, 1);
        return Promise.resolve({ success: true });
      },
      addPayment: (data: Record<string, unknown>) => {
        const id = `scp-${Date.now()}`;
        const sc = MOCK.supplierCredits.find(c => c.id === data.creditId);
        if (sc) { sc.total_payments += data.amount as number; sc.remainingBalance -= data.amount as number; }
        return Promise.resolve({ id });
      },
      deletePayment: () => Promise.resolve({ success: true }),
      history: () => Promise.resolve([]),
    },
    bankMovements: {
      list: () => Promise.resolve({ items: MOCK.bankMovements, total: MOCK.bankMovements.length }),
      create: (data: Record<string, unknown>) => {
        const id = `bk-${Date.now()}`;
        MOCK.bankMovements.unshift({ id, date: data.date as string, description: data.description as string, amount_in: (data.amountIn as number) || 0, amount_out: (data.amountOut as number) || 0 });
        return Promise.resolve({ id });
      },
      update: (data: Record<string, unknown>) => {
        const idx = MOCK.bankMovements.findIndex(m => m.id === data.id);
        if (idx >= 0) Object.assign(MOCK.bankMovements[idx], { date: data.date, description: data.description, amount_in: data.amountIn || 0, amount_out: data.amountOut || 0 });
        return Promise.resolve({ success: true });
      },
      delete: (id: string) => {
        const idx = MOCK.bankMovements.findIndex(m => m.id === id);
        if (idx >= 0) MOCK.bankMovements.splice(idx, 1);
        return Promise.resolve({ success: true });
      },
      summary: () => Promise.resolve({
        totalIn: MOCK.bankMovements.reduce((s, m) => s + m.amount_in, 0),
        totalOut: MOCK.bankMovements.reduce((s, m) => s + m.amount_out, 0),
        balanceDelta: MOCK.bankMovements.reduce((s, m) => s + m.amount_in - m.amount_out, 0),
      }),
    },
    clients: {
      list: () => Promise.resolve(MOCK.clients),
      create: (data: Record<string, unknown>) => {
        const existing = MOCK.clients.find(c => c.name === (data.name as string)?.toUpperCase());
        if (existing) return Promise.resolve(existing);
        const c = { id: `cli-${Date.now()}`, name: (data.name as string).toUpperCase(), phone: (data.phone as string) || null };
        MOCK.clients.push(c);
        return Promise.resolve(c);
      },
      search: (query: string) => {
        const q = (query || '').toLowerCase();
        return Promise.resolve(MOCK.clients.filter(c => c.name.toLowerCase().includes(q)));
      },
    },
    employees: {
      list: () => Promise.resolve(MOCK.employees),
      create: (data: Record<string, unknown>) => {
        const emp = { id: `emp-${Date.now()}`, name: (data.name as string).toUpperCase(), monthly_salary: data.monthlySalary as number, start_date: data.startDate as string, is_active: 1 };
        MOCK.employees.push(emp);
        return Promise.resolve(emp);
      },
      update: (data: Record<string, unknown>) => {
        const idx = MOCK.employees.findIndex(e => e.id === data.id);
        if (idx >= 0) Object.assign(MOCK.employees[idx], { name: (data.name as string).toUpperCase(), monthly_salary: data.monthlySalary, start_date: data.startDate });
        return Promise.resolve({ success: true });
      },
      delete: (id: string) => {
        const idx = MOCK.employees.findIndex(e => e.id === id);
        if (idx >= 0) MOCK.employees.splice(idx, 1);
        return Promise.resolve({ success: true });
      },
    },
    salaryPayments: {
      list: () => Promise.resolve(MOCK.salaryPayments),
      create: (data: Record<string, unknown>) => {
        const emp = MOCK.employees.find(e => e.id === data.employeeId);
        const sp = { id: `sp-${Date.now()}`, date: data.date as string, amount: data.amount as number, note: (data.note as string) || '', employee_id: data.employeeId as string, employee_name: emp?.name || '' };
        MOCK.salaryPayments.push(sp);
        return Promise.resolve(sp);
      },
      delete: (id: string) => {
        const idx = MOCK.salaryPayments.findIndex(p => p.id === id);
        if (idx >= 0) MOCK.salaryPayments.splice(idx, 1);
        return Promise.resolve({ success: true });
      },
    },
    maintenanceTypes: {
      list: () => Promise.resolve(MOCK.maintenanceTypes),
      create: (data: Record<string, unknown>) => {
        const name = ((data.name as string) || '').toUpperCase();
        const existing = MOCK.maintenanceTypes.find(t => t.name === name);
        if (existing) return Promise.resolve(existing);
        const t = { id: `mt-${Date.now()}`, name };
        MOCK.maintenanceTypes.push(t);
        return Promise.resolve(t);
      },
    },
    expenseDesignations: {
      list: () => Promise.resolve(MOCK.expenseDesignations),
      create: (data: Record<string, unknown>) => {
        const name = ((data.name as string) || '').toUpperCase();
        const existing = MOCK.expenseDesignations.find(d => d.name === name);
        if (existing) return Promise.resolve(existing);
        const d = { id: `ed-${Date.now()}`, name };
        MOCK.expenseDesignations.push(d);
        return Promise.resolve(d);
      },
    },
    dashboard: {
      stats: () => Promise.resolve({
        stockValue: totalStockValue,
        monthlySales,
        monthlyMargin,
        monthlyMaintenance,
        monthlyExpenses,
        lowStockAlerts: MOCK.purchaseLots.filter(l => (l.initial_quantity - l.sold_quantity) <= 1 && (l.initial_quantity - l.sold_quantity) > 0).length,
        activeCredits: MOCK.customerCredits.filter(c => c.remainingBalance > 0).length,
      }),
    },
    monthlySummary: {
      get: () => Promise.resolve({ months: [] }),
    },
    zakat: {
      compute: () => Promise.resolve({
        year: 2026, closingStockValue: totalStockValue, closingBankBalance: 1250000000,
        closingCash: 500000000, totalAssets: totalStockValue + 1250000000 + 500000000,
        clientCreditDeduction: 5450000, supplierCreditDeduction: 1000000,
        zakatBase: totalStockValue + 1250000000 + 500000000 + 5450000 - 1000000,
        zakatRate: 0.025, zakatDue: Math.round((totalStockValue + 1250000000 + 500000000 + 5450000 - 1000000) * 0.025),
        advanceTotal: 0, zakatRemaining: Math.round((totalStockValue + 1250000000 + 500000000 + 5450000 - 1000000) * 0.025),
        advances: [],
      }),
      saveAdvance: () => Promise.resolve({ id: 'new' }),
      deleteAdvance: () => Promise.resolve({ ok: true }),
    },
    auth: {
      login: (data: Record<string, unknown>) => {
        const u = MOCK.users.find(u => u.username === (data.username as string)?.toLowerCase());
        if (!u || u.password !== data.password) return Promise.reject(new Error('Nom d\'utilisateur ou mot de passe incorrect'));
        if (!u.is_active) return Promise.reject(new Error('Ce compte est désactivé'));
        return Promise.resolve({
          user: { id: u.id, username: u.username, displayName: u.display_name, role: u.role, employeeId: u.employee_id },
          permissions: u.permissions,
          mustChangePassword: !!u.must_change_password,
        });
      },
      logout: () => Promise.resolve({ success: true }),
      changePassword: (data: Record<string, unknown>) => {
        const u = MOCK.users.find(u => u.id === data.userId);
        if (u) { u.password = data.newPassword as string; u.must_change_password = 0; }
        return Promise.resolve({ success: true });
      },
    },
    users: {
      list: () => Promise.resolve(MOCK.users.map(({ password: _p, ...rest }) => rest)),
      create: (data: Record<string, unknown>) => {
        const id = `user-${Date.now()}`;
        MOCK.users.push({ id, username: (data.username as string).toLowerCase(), password: data.password as string, display_name: data.displayName as string, role: data.role as string, employee_id: (data.employeeId as string) || null, employee_name: null, is_active: 1, must_change_password: 1, permissions: (data.permissions as string[]) || [] });
        return Promise.resolve({ id });
      },
      update: (data: Record<string, unknown>) => {
        const idx = MOCK.users.findIndex(u => u.id === data.id);
        if (idx >= 0) {
          if (data.displayName !== undefined) MOCK.users[idx].display_name = data.displayName as string;
          if (data.isActive !== undefined) MOCK.users[idx].is_active = (data.isActive as boolean) ? 1 : 0;
          if (data.role !== undefined) MOCK.users[idx].role = data.role as string;
          if (data.permissions !== undefined) MOCK.users[idx].permissions = data.permissions as string[];
        }
        return Promise.resolve({ success: true });
      },
      resetPassword: (data: Record<string, unknown>) => {
        const u = MOCK.users.find(u => u.id === data.userId);
        if (u) { u.password = data.newPassword as string; u.must_change_password = 1; }
        return Promise.resolve({ success: true });
      },
      delete: (id: string) => {
        const idx = MOCK.users.findIndex(u => u.id === id);
        if (idx >= 0) MOCK.users.splice(idx, 1);
        return Promise.resolve({ success: true });
      },
    },
    sync: {
      status: () => Promise.resolve({ connected: false, pendingOps: 0, lastSync: null }),
      trigger: () => Promise.resolve({ connected: false, pendingOps: 0, lastSync: null }),
      listConflicts: () => Promise.resolve([]),
      dismissConflict: () => Promise.resolve({ dismissed: true }),
      retryConflict: () => Promise.resolve({ retried: true }),
    },
    notifications: {
      unpaidCustomerCredits: () => Promise.resolve([]),
      unpaidSupplierCredits: () => Promise.resolve([]),
    },
    customerOrders: {
      list: () => Promise.resolve({ items: [], total: 0 }),
      create: () => Promise.resolve({ success: true, id: `cmd-${Date.now()}` }),
      update: () => Promise.resolve({ success: true }),
      updateStatus: () => Promise.resolve({ success: true }),
      delete: () => Promise.resolve({ success: true }),
    },
    backup: {
      create: () => Promise.resolve({ cancelled: true }),
      restore: () => Promise.resolve({ cancelled: true }),
    },
    config: {
      getPath: () => Promise.resolve('(dev) .env not available'),
      openFile: () => Promise.resolve({ path: '(dev)' }),
      reload: () => Promise.resolve({ success: true }),
    },
    updater: {
      check: () => Promise.resolve({ checked: false, reason: 'dev mode' }),
      install: () => Promise.resolve(),
      onEvent: () => () => undefined,
    },
  };
  (window as unknown as Record<string, unknown>).api = api;
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
