/**
 * Canonical master data constants seeded from the business workbook.
 * These are the single source of truth for valid supplier, boutique,
 * category, and service values across all packages.
 */

// ─── Suppliers ───────────────────────────────────────────────────────────────

export const SUPPLIERS = ['AB', 'F5', 'MAG', 'MC'] as const;
export type Supplier = (typeof SUPPLIERS)[number];

// ─── Boutiques ───────────────────────────────────────────────────────────────

export const BOUTIQUES = ['MLILIYA', 'TAYRET', 'UNASSIGNED'] as const;
export type Boutique = (typeof BOUTIQUES)[number];

/** Maps raw spreadsheet boutique values to canonical boutiques. */
export const BOUTIQUE_ALIASES: Record<string, Boutique> = {
  tayret: 'TAYRET',
  '0': 'UNASSIGNED',
};

// ─── Categories ──────────────────────────────────────────────────────────────

export const CATEGORIES = [
  'ACCESS-DIAPO',
  'ACCESS-HUB',
  'ACCESS-LECTEUR CARTE',
  'ACCESS-OTG',
  'ACCESS-SEGARE',
  'ADAPTATEURS',
  'ALIMENTATIONS',
  'AUDIO/VIDEO CABLE',
  'BUR RAM',
  'BUR-CLAVIER',
  'BUR-ECRAN',
  'BUR-HDD',
  'BUR-RAM',
  'BUR-SOURIS/TAPIS',
  'CABLE IMPRIMANTE',
  'CABLE VGA',
  'CABLES DIVERS',
  'CABLES HDMI / DISPLAY',
  'CABLES USB',
  'CADY',
  'CASE HDD 2,5 ET CABLE',
  'CASE M2/NVME',
  'CASQUES',
  'CHARGEUR 5V/12V',
  'CHARGEUR TV',
  'FLASH/SD',
  'GAMING',
  'GRAVEUR EXTERNE',
  'GSM',
  'GSM BATTERIE',
  'GSM CABLES',
  'GSM CHARGEUR',
  'GSM KIT',
  'GSM NEUF',
  'GSM PRISE',
  'HAUT PARLEUR',
  'HDD EXTERNE',
  'LAPTOP ACER',
  'LAPTOP ASUS',
  'LAPTOP AUTRE',
  'LAPTOP DELL',
  'LAPTOP HP',
  'LAPTOP LENOVO',
  'LAPTOP NEUF',
  'LAPTOP SURFACE',
  'MAC CABLES',
  'MAC CHARGEUR',
  'MAC CLAVIER',
  'MAC COQUES',
  'MAC OUTILLE',
  'MAC PIECES',
  'MAC SOURIS',
  'MICRO',
  'ORAIMO',
  'ORYX',
  'PATHE',
  'PILES',
  'PLAY',
  'PP AFFICHEUR 10',
  'PP AFFICHEUR 11.6',
  'PP AFFICHEUR 12',
  'PP AFFICHEUR 13',
  'PP AFFICHEUR 14',
  'PP AFFICHEUR 15',
  'PP AFFICHEUR 16"',
  'PP AFFICHEUR 17.3',
  'PP AFFICHEUR OCC',
  'PP BATTERIE ACER',
  'PP BATTERIE ASUS',
  'PP BATTERIE CABLES',
  'PP BATTERIE DELL',
  'PP BATTERIE HP',
  'PP BATTERIE LENOVO',
  'PP BATTERIE MAC',
  'PP BATTERIE TOSHIBA',
  'PP CACHE CAMERA',
  'PP CARTABLES',
  'PP CHARGEUR ADAPTATEUR',
  'PP CHARGEUR NEUF COPY',
  'PP CHARGEUR NEUF OR',
  'PP CHARGEUR ORG OCCAS',
  'PP CLAVIER ACER',
  'PP CLAVIER ASUS',
  'PP CLAVIER DELL',
  'PP CLAVIER HP',
  'PP CLAVIER LEN',
  'PP CLAVIER SAM',
  'PP CLAVIER TOSHIBA',
  'PP COVER',
  'PP HDD',
  'PP HDD NAPPE',
  'PP PIECES',
  'PP RAM',
  'PP REPARATION',
  'PP SSD',
  'PP-TABLE',
  'RESEAUX',
  'TONER',
  'TV',
  'VIDEOPROJECTEUR',
  'XIAOMI',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Maps raw spreadsheet category aliases (trimmed trailing spaces, typos) to canonical. */
export const CATEGORY_ALIASES: Record<string, Category> = {
  'PILES ': 'PILES',
  'PP BATTERIE DELL ': 'PP BATTERIE DELL',
  'PP CLAVIER DELL ': 'PP CLAVIER DELL',
  'PP CLAVIER HP ': 'PP CLAVIER HP',
  'PP CLAVIER LEN ': 'PP CLAVIER LEN',
  'PP CLAVIER TOSH ': 'PP CLAVIER TOSHIBA',
};

// ─── Maintenance service types ───────────────────────────────────────────────

export const MAINTENANCE_SERVICE_TYPES = [
  'INSTALL',
  'CARCASSE',
  'REPARATION DELL',
  'OFFICE',
  'CONN TAB',
] as const;

export type MaintenanceServiceType = (typeof MAINTENANCE_SERVICE_TYPES)[number];

// ─── Battery repair tariffs ──────────────────────────────────────────────────

export const BATTERY_TARIFF_LABELS = [
  'BALLANCER/CHARGER/DECHARGER LES CELLULES',
  'FLASH UNLOCK',
  'REPARATION DE LA CARTE',
  'CHANGEMNENT DES CELLULES',
] as const;

export type BatteryTariffLabel = (typeof BATTERY_TARIFF_LABELS)[number];

export interface BatteryTariffDefaults {
  particuliers: number | null; // null = quotation only
  rev: number | null;
}

export const BATTERY_TARIFF_DEFAULTS: Record<BatteryTariffLabel, BatteryTariffDefaults> = {
  'BALLANCER/CHARGER/DECHARGER LES CELLULES': { particuliers: 100, rev: 50 },
  'FLASH UNLOCK': { particuliers: 200, rev: 100 },
  'REPARATION DE LA CARTE': { particuliers: 150, rev: 100 },
  'CHANGEMNENT DES CELLULES': { particuliers: null, rev: null },
};

// ─── Expense designations ────────────────────────────────────────────────────

export const EXPENSE_DESIGNATIONS = ['CAHIER', 'SDTM', 'SAC', 'AJAX+CLINIX'] as const;
export type ExpenseDesignation = (typeof EXPENSE_DESIGNATIONS)[number];

export const EXPENSE_ALIASES: Record<string, ExpenseDesignation> = {
  sdtm: 'SDTM',
};

// ─── Customer names (seed data from workbook) ────────────────────────────────

export const SEED_CUSTOMER_NAMES = ['ABDO BENTAJ', 'YASSIN BENTAJ'] as const;

// ─── Monthly summary labels ──────────────────────────────────────────────────

export const MONTHLY_REVENUE_LABELS = [
  'Totaux des Achats',
  'Totaux des ventes',
  'Bce Vente',
  'Maintenance',
  'FIBRE K',
  'FIBRE S',
  'Totaux Bce',
  'TAUX BCE',
] as const;

export const MONTHLY_EXPENSE_LABELS = [
  'Loyer DEPOT',
  'Sécurité DEPOT',
  'Sécurité MLILIYA',
  'WC',
  'Impôts/COMPTA',
  'Charges divers',
  'Charges Banque',
  'Electricité',
  'Téléphone/INTERNET',
  'PARKING',
  'CNSS',
  'CHARGE MARCHE PUB',
  'LOCATION',
  'TAYRET ELECT+EAU+INT',
  'PUBLICITE ET BOOSTAGE',
  'Totaux',
] as const;

export const MONTHLY_SALARY_LABELS = [
  'Bénéfice',
  'HICHAM',
  'SAMIR',
  'TOTAUX',
  'Solde annuel',
] as const;

// ─── Zakat rate ──────────────────────────────────────────────────────────────

export const ZAKAT_RATE = 0.025;
