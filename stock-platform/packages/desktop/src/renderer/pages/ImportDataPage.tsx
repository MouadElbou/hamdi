import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from '../components/Modal.js';
import { useToast } from '../components/Toast.js';

function normalize(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function toISODate(v: unknown, format: 'dmy' | 'mdy' = 'dmy'): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'number' && Number.isFinite(v) && v > 10000 && v < 80000) {
    const jsDate = new Date((v - 25569) * 86400 * 1000);
    if (!isNaN(jsDate.getTime())) {
      const y = jsDate.getUTCFullYear();
      const m = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(jsDate.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const raw = String(v).replace(/ /g, ' ').trim();
  if (raw === '') return null;
  const s = raw.split(/\s+/)[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const tryParse = (input: string): string | null => {
    const match = input.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!match) return null;
    const a = match[1];
    const b = match[2];
    let c = match[3];
    if (c.length === 2) c = Number(c) >= 50 ? `19${c}` : `20${c}`;
    const day = format === 'dmy' ? a.padStart(2, '0') : b.padStart(2, '0');
    const month = format === 'dmy' ? b.padStart(2, '0') : a.padStart(2, '0');
    const dn = Number(day);
    const mn = Number(month);
    if (dn < 1 || dn > 31 || mn < 1 || mn > 12) return null;
    return `${c}-${month}-${day}`;
  };
  const direct = tryParse(s);
  if (direct) return direct;
  if (/[Oo]/.test(s)) {
    const fixed = tryParse(s.replace(/[Oo]/g, '0'));
    if (fixed) return fixed;
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function dateError(v: unknown): string {
  const s = String(v ?? '').replace(/ /g, ' ').trim();
  if (!s) return 'date manquante';
  const shown = s.length > 40 ? `${s.slice(0, 40)}…` : s;
  return `date invalide: "${shown}"`;
}

function toNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const raw = String(v).trim();
  if (raw === '' || raw === '-') return null;
  const cleaned = raw.replace(/\s/g, '').replace(/[^\d,.\-]/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toTrimString(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function hasContent(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

function isBlankRow(row: unknown[] | undefined): boolean {
  if (!row || row.length === 0) return true;
  return row.every((c) => c === undefined || c === null || String(c).trim() === '');
}

function boundedRange(sheet: XLSX.WorkSheet, maxCol = 25, maxRow = 5000): string {
  const ref = sheet['!ref'] || 'A1';
  const r = XLSX.utils.decode_range(ref);
  r.s.c = 0;
  r.s.r = 0;
  r.e.c = Math.min(r.e.c, maxCol);
  r.e.r = Math.min(r.e.r, maxRow);
  return XLSX.utils.encode_range(r);
}

function findHeaderRow(rows: unknown[][], signature: string[], maxScan = 10): number {
  const sig = signature.map(normalize);
  const limit = Math.min(maxScan, rows.length);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] || [];
    const cells = row.map(normalize);
    if (sig.every((s) => cells.some((c) => c.includes(s)))) return r;
  }
  return -1;
}

function extractDataRows(
  rows: unknown[][],
  startIndex: number,
  dateCol: number,
  maxRows = 5000,
  blankRunLimit = 15,
): Array<{ row: unknown[]; origIndex: number }> {
  const out: Array<{ row: unknown[]; origIndex: number }> = [];
  let blankRun = 0;
  for (let r = startIndex; r < rows.length && out.length < maxRows; r++) {
    const row = rows[r] ?? [];
    if (isBlankRow(row) || !hasContent(row[dateCol])) {
      blankRun++;
      if (blankRun >= blankRunLimit) break;
      continue;
    }
    blankRun = 0;
    out.push({ row, origIndex: r });
  }
  return out;
}

export type SheetKind =
  | 'achat'
  | 'maintenance'
  | 'charges'
  | 'credits-client'
  | 'credits-frs'
  | 'banque'
  | 'vente'
  | 'ap-bat';

interface ParseResult {
  data?: Record<string, unknown>;
  error?: string;
}

interface SheetConfig {
  kind: SheetKind;
  label: string;
  nameAliases: string[];
  headerSignature: string[];
  dateCol: number;
  parseRow: (row: unknown[]) => ParseResult;
}

const SHEET_CONFIGS: SheetConfig[] = [
  {
    kind: 'achat',
    label: 'Achats',
    nameAliases: ['achat', 'achats'],
    headerSignature: ['date', 'designation', 'fournisseur'],
    dateCol: 2,
    parseRow: (row) => {
      const date = toISODate(row[2], 'dmy');
      const category = toTrimString(row[3]);
      const designation = toTrimString(row[4]);
      const supplier = toTrimString(row[5]);
      const boutique = toTrimString(row[6]);
      const initialQuantity = toNumber(row[7]);
      const purchaseUnitCost = toNumber(row[8]);
      const targetResalePrice = toNumber(row[9]);

      if (!date) {
        if (
          !category &&
          !designation &&
          !supplier &&
          !boutique &&
          initialQuantity === null &&
          purchaseUnitCost === null
        ) {
          return {};
        }
        return { error: dateError(row[2]) };
      }
      if (initialQuantity === 0) return {};
      if (!category) return { error: 'catégorie manquante' };
      if (!designation) return { error: 'désignation manquante' };
      if (!boutique) return { error: 'boutique manquante' };
      if (initialQuantity === null || initialQuantity < 0) return { error: 'quantité invalide' };
      if (purchaseUnitCost === null || purchaseUnitCost < 0) return { error: "prix d'achat invalide" };

      return {
        data: {
          date,
          category,
          designation,
          supplier: supplier || undefined,
          boutique,
          initialQuantity,
          purchaseUnitCost,
          targetResalePrice,
          blockPrice: null,
          sellingPrice: null,
          subCategory: null,
        },
      };
    },
  },
  {
    kind: 'maintenance',
    label: 'Entretien / Maintenance',
    nameAliases: ['maintenance', 'entretien'],
    headerSignature: ['date', 'designation', 'prix', 'boutique'],
    dateCol: 1,
    parseRow: (row) => {
      const date = toISODate(row[1], 'mdy');
      const designation = toTrimString(row[2]);
      const price = toNumber(row[3]);
      const boutique = toTrimString(row[4]);
      if (!date) return {};
      if (!designation) return { error: 'désignation manquante' };
      if (price === null || price < 0) return { error: 'prix invalide' };
      return { data: { date, designation, price, boutique: boutique || 'HAMDI' } };
    },
  },
  {
    kind: 'charges',
    label: 'Charges / Dépenses',
    nameAliases: ['les charges', 'charges', 'depenses', 'depense'],
    headerSignature: ['date', 'designation', 'montant', 'boutique'],
    dateCol: 2,
    parseRow: (row) => {
      const date = toISODate(row[2], 'mdy');
      const designation = toTrimString(row[3]);
      const amount = toNumber(row[4]);
      const boutique = toTrimString(row[5]);
      if (!date) return {};
      if (!designation) return { error: 'désignation manquante' };
      if (amount === null || amount < 0) return { error: 'montant invalide' };
      return { data: { date, designation, amount, boutique: boutique || 'HAMDI' } };
    },
  },
  {
    kind: 'credits-client',
    label: 'Crédits clients',
    nameAliases: ['credits client', 'credits clients', 'credit client'],
    headerSignature: ['date', 'client', 'designation', 'prix'],
    dateCol: 1,
    parseRow: (row) => {
      const date = toISODate(row[1], 'mdy');
      const customerName = toTrimString(row[2]);
      const designation = toTrimString(row[3]);
      const quantity = toNumber(row[4]);
      const unitPrice = toNumber(row[5]);
      const advance = toNumber(row[7]);
      if (!date) {
        if (!customerName && !designation && quantity === null && unitPrice === null) return {};
        return { error: dateError(row[1]) };
      }
      if (!customerName) return { error: 'client manquant' };
      if (!designation) {
        if (quantity === null && unitPrice === null) return {};
        return { error: 'désignation manquante' };
      }
      if (quantity === null || quantity <= 0) return { error: 'quantité invalide' };
      if (unitPrice === null || unitPrice < 0) return { error: 'prix unitaire invalide' };
      return {
        data: {
          date,
          customerName,
          designation,
          quantity,
          unitPrice,
          advancePaid: advance !== null && advance > 0 ? advance : undefined,
        },
      };
    },
  },
  {
    kind: 'credits-frs',
    label: 'Crédits fournisseurs',
    nameAliases: ['credits frs', 'credits fournisseurs', 'credit frs', 'credit fournisseurs'],
    headerSignature: ['date', 'fournisseur', 'montant', 'avance'],
    dateCol: 1,
    parseRow: (row) => {
      const date = toISODate(row[1], 'mdy');
      const supplier = toTrimString(row[2]);
      const designation = toTrimString(row[3]);
      const totalAmount = toNumber(row[4]);
      const advance = toNumber(row[5]);
      if (!date) {
        if (!supplier && !designation && totalAmount === null) return {};
        return { error: dateError(row[1]) };
      }
      if (!supplier) return { error: 'fournisseur manquant' };
      if (!designation) {
        if (totalAmount === null) return {};
        return { error: 'désignation manquante' };
      }
      if (totalAmount === null || totalAmount < 0) return { error: 'montant total invalide' };
      return {
        data: {
          date,
          supplier,
          designation,
          totalAmount,
          advancePaid: advance !== null && advance > 0 ? advance : undefined,
        },
      };
    },
  },
  {
    kind: 'banque',
    label: 'Mouvements bancaires',
    nameAliases: [
      'entree & sortie banque',
      'entree et sortie banque',
      'entree sortie banque',
      'banque',
    ],
    headerSignature: ['date', 'description', 'entr', 'sortie'],
    dateCol: 2,
    parseRow: (row) => {
      const date = toISODate(row[2], 'mdy');
      const description = toTrimString(row[3]);
      const amountIn = toNumber(row[4]);
      const amountOut = toNumber(row[5]);
      if (!date) {
        if (!description && amountIn === null && amountOut === null) return {};
        return { error: dateError(row[2]) };
      }
      if (!description) return { error: 'description manquante' };
      const hasIn = amountIn !== null && amountIn > 0;
      const hasOut = amountOut !== null && amountOut > 0;
      if (!hasIn && !hasOut) return { error: 'entrée ou sortie requise' };
      return {
        data: {
          date,
          description,
          amountIn: hasIn ? amountIn : undefined,
          amountOut: hasOut ? amountOut : undefined,
        },
      };
    },
  },
  {
    kind: 'vente',
    label: 'Ventes',
    nameAliases: ['vente', 'ventes', 'fiche des ventes'],
    headerSignature: ['date', 'designation', 'qte', 'p.v'],
    dateCol: 2,
    parseRow: (row) => {
      const date = toISODate(row[2], 'mdy');
      const designation = toTrimString(row[3]);
      const sellingUnitPrice = toNumber(row[9]);
      const quantity = toNumber(row[10]);
      const boutique = toTrimString(row[13]);
      const observation = toTrimString(row[14]);
      if (!date) {
        if (!designation && quantity === null && sellingUnitPrice === null && !boutique) return {};
        return { error: dateError(row[2]) };
      }
      if (!designation) {
        if (quantity === null && sellingUnitPrice === null) return {};
        return { error: 'désignation manquante' };
      }
      if (quantity === null || quantity <= 0) return { error: 'quantité invalide' };
      if (sellingUnitPrice === null || sellingUnitPrice < 0) {
        return { error: 'prix de vente invalide' };
      }
      return {
        data: {
          date,
          designation,
          quantity,
          sellingUnitPrice,
          boutique: boutique || undefined,
          observation: observation || undefined,
        },
      };
    },
  },
  {
    kind: 'ap-bat',
    label: 'Réparations batterie',
    nameAliases: ['ap bat', 'ap-bat', 'apbat'],
    headerSignature: ['bce rep bat', 'date'],
    dateCol: 8,
    parseRow: (row) => {
      const amount = toNumber(row[7]);
      const date = toISODate(row[8], 'mdy');
      const note = toTrimString(row[9]);
      if (!date) return {};
      if (amount === null) return { error: 'montant invalide' };
      return {
        data: {
          date,
          description: 'Réparation batterie',
          amount,
          customerNote: note || undefined,
        },
      };
    },
  },
];

function findSheetName(allNames: string[], aliases: string[]): string | null {
  const indexed = allNames.map((n) => ({ orig: n, norm: normalize(n) }));
  for (const alias of aliases) {
    const target = normalize(alias);
    const exact = indexed.find((n) => n.norm === target);
    if (exact) return exact.orig;
  }
  for (const alias of aliases) {
    const target = normalize(alias);
    const partial = indexed.find((n) => n.norm.includes(target));
    if (partial) return partial.orig;
  }
  return null;
}

export interface SheetPreview {
  kind: SheetKind;
  label: string;
  sheetName: string;
  headerRow: number;
  totalRows: number;
  validRows: Array<Record<string, unknown>>;
  errors: Array<{ row: number; message: string }>;
}

export interface ParsedWorkbook {
  fileName: string;
  sheets: SheetPreview[];
  missing: string[];
}

export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheets: SheetPreview[] = [];
  const missing: string[] = [];

  for (const cfg of SHEET_CONFIGS) {
    const name = findSheetName(wb.SheetNames, cfg.nameAliases);
    if (!name) {
      missing.push(cfg.label);
      continue;
    }
    const sheet = wb.Sheets[name];
    const ref = boundedRange(sheet);
    const allRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: true,
      range: ref,
    }) as unknown[][];
    const headerIdx = findHeaderRow(allRows, cfg.headerSignature);
    if (headerIdx < 0) {
      sheets.push({
        kind: cfg.kind,
        label: cfg.label,
        sheetName: name,
        headerRow: -1,
        totalRows: 0,
        validRows: [],
        errors: [{ row: 0, message: 'En-têtes introuvables dans les 10 premières lignes.' }],
      });
      continue;
    }
    const dataRows = extractDataRows(allRows, headerIdx + 1, cfg.dateCol);
    const validRows: Array<Record<string, unknown>> = [];
    const errors: Array<{ row: number; message: string }> = [];
    for (const { row, origIndex } of dataRows) {
      const excelRow = origIndex + 1;
      const result = cfg.parseRow(row);
      if (result.error) {
        errors.push({ row: excelRow, message: result.error });
      } else if (result.data) {
        validRows.push(result.data);
      }
    }
    sheets.push({
      kind: cfg.kind,
      label: cfg.label,
      sheetName: name,
      headerRow: headerIdx + 1,
      totalRows: dataRows.length,
      validRows,
      errors,
    });
  }

  return { fileName: file.name, sheets, missing };
}

async function runImportForKind(
  kind: SheetKind,
  payload: { rows: Array<Record<string, unknown>> },
): Promise<{ created: number; errors: Array<{ row: number; message: string }> }> {
  switch (kind) {
    case 'achat':
      return window.api.purchases.importExcel(payload);
    case 'maintenance':
      return window.api.maintenance.importExcel(payload);
    case 'charges':
      return window.api.expenses.importExcel(payload);
    case 'credits-client':
      return window.api.customerCredits.importExcel(payload);
    case 'credits-frs':
      return window.api.supplierCredits.importExcel(payload);
    case 'banque':
      return window.api.bankMovements.importExcel(payload);
    case 'vente':
      return window.api.sales.importExcel(payload);
    case 'ap-bat':
      return window.api.batteryRepair.importExcel(payload);
  }
}

export interface ImportWorkbookResult {
  totalCreated: number;
  totalErrors: number;
  perSheet: Array<{ kind: SheetKind; label: string; created: number; errors: number }>;
  failures: Array<{ kind: SheetKind; label: string; message: string }>;
}

export async function importParsedWorkbook(
  preview: ParsedWorkbook,
): Promise<ImportWorkbookResult> {
  let totalCreated = 0;
  let totalErrors = 0;
  const perSheet: ImportWorkbookResult['perSheet'] = [];
  const failures: ImportWorkbookResult['failures'] = [];

  for (const sheet of preview.sheets) {
    if (sheet.validRows.length === 0) continue;
    try {
      const result = await runImportForKind(sheet.kind, { rows: sheet.validRows });
      totalCreated += result.created;
      totalErrors += result.errors.length;
      perSheet.push({
        kind: sheet.kind,
        label: sheet.label,
        created: result.created,
        errors: result.errors.length,
      });
      console.log(
        `[ImportData] ${sheet.label}: ${result.created} créé(s), ${result.errors.length} erreur(s) ${JSON.stringify(result.errors)}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      totalErrors += sheet.validRows.length;
      failures.push({ kind: sheet.kind, label: sheet.label, message: msg });
      console.error(`[ImportData] ${sheet.label} failed`, err);
    }
  }

  return { totalCreated, totalErrors, perSheet, failures };
}

const SUPPORTED_SHEETS: Array<{ tag: string; title: string; description: string }> = [
  { tag: 'ACHAT', title: 'Achats', description: "Stock initial, prix d'achat, prix revendeur." },
  { tag: 'VENTE', title: 'Ventes', description: 'Ventes FIFO par désignation et boutique.' },
  { tag: 'MAINTENANCE', title: 'Entretien', description: 'Frais d’entretien et de maintenance.' },
  { tag: 'AP BAT', title: 'Réparations batterie', description: 'Suivi des réparations batterie.' },
  { tag: 'LES CHARGES', title: 'Dépenses', description: 'Charges et dépenses courantes.' },
  { tag: 'CREDITS CLIENT', title: 'Crédits clients', description: 'Ventes à crédit avec avances.' },
  { tag: 'CREDITS FRS', title: 'Crédits fournisseurs', description: 'Dettes fournisseurs et avances.' },
  { tag: 'BANQUE', title: 'Mouvements bancaires', description: 'Entrées et sorties bancaires.' },
];

const UploadIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const FileSpreadsheetIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
    <line x1="10" y1="9" x2="10" y2="9" />
  </svg>
);

const CheckCircleIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const XCircleIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const AlertTriangleIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export function ImportDataPage() {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<ParsedWorkbook | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function parseFile(file: File) {
    setParsing(true);
    try {
      const parsed = await parseWorkbook(file);
      setPreview(parsed);
      setPreviewOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ImportData] parse error', err);
      addToast(`Erreur lors de la lecture du fichier: ${msg}`, 'error');
    } finally {
      setParsing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void parseFile(file);
    if (e.target) e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void parseFile(file);
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const result = await importParsedWorkbook(preview);
      for (const failure of result.failures) {
        addToast(`${failure.label}: échec — ${failure.message}`, 'error');
      }
      setPreviewOpen(false);
      setPreview(null);
      if (result.totalErrors === 0 && result.failures.length === 0) {
        addToast(`Import terminé: ${result.totalCreated} ligne(s) importée(s)`, 'success');
      } else {
        addToast(
          `Import terminé: ${result.totalCreated} créé(s), ${result.totalErrors} erreur(s)`,
          'warning',
        );
      }
    } finally {
      setImporting(false);
    }
  }

  const totalValid = preview?.sheets.reduce((s, x) => s + x.validRows.length, 0) ?? 0;
  const totalErrors = preview?.sheets.reduce((s, x) => s + x.errors.length, 0) ?? 0;

  const dropzoneClass = [
    'import-dropzone',
    dragActive ? 'drag-active' : '',
    parsing ? 'parsing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Import depuis Excel</h1>
          <p className="text-muted">
            Déposez le classeur COMPTA.xlsx du client. L'application détectera automatiquement
            chaque feuille et importera les lignes valides dans les modules correspondants.
          </p>
        </div>
      </div>

      <div className="card">
        <div
          className={dropzoneClass}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => !parsing && fileInputRef.current?.click()}
        >
          <div className="import-dropzone-icon">{UploadIcon}</div>
          <div className="import-dropzone-title">
            {parsing
              ? 'Lecture du fichier…'
              : dragActive
                ? 'Relâchez pour analyser'
                : 'Glissez-déposez ou cliquez pour choisir un fichier'}
          </div>
          <div className="import-dropzone-hint">.xlsx · .xls · max 5000 lignes/feuille</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={parsing}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Feuilles prises en charge</div>
        <div className="import-sheets-grid">
          {SUPPORTED_SHEETS.map((sheet) => (
            <div key={sheet.tag} className="import-sheet-hint">
              <span className="import-sheet-hint-tag">{sheet.tag}</span>
              <div className="import-sheet-hint-body">
                <span className="import-sheet-hint-title">{sheet.title}</span>
                <span className="import-sheet-hint-desc">{sheet.description}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="import-ignored-note">
          <strong>Feuilles ignorées</strong> (calculées ou non compatibles) : GESTION DE STOCK,
          Recette&amp;Dépense, ZAKAT.
        </p>
      </div>

      <Modal
        open={previewOpen}
        onClose={() => {
          if (!importing) {
            setPreviewOpen(false);
            setPreview(null);
          }
        }}
        title={`Aperçu — ${preview?.fileName ?? ''}`}
        width={900}
      >
        {preview && (
          <div>
            <div className="import-preview-summary">
              <div className="stat-card">
                <div className="stat-icon green">{CheckCircleIcon}</div>
                <div className="stat-content">
                  <div className="stat-label">Lignes valides</div>
                  <div className="stat-value">{totalValid}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon red">{XCircleIcon}</div>
                <div className="stat-content">
                  <div className="stat-label">Erreurs</div>
                  <div className="stat-value">{totalErrors}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon amber">{FileSpreadsheetIcon}</div>
                <div className="stat-content">
                  <div className="stat-label">Feuilles détectées</div>
                  <div className="stat-value">{preview.sheets.length}</div>
                </div>
              </div>
            </div>

            {preview.missing.length > 0 && (
              <div className="import-banner">
                <span className="import-banner-icon">{AlertTriangleIcon}</span>
                <div>
                  <strong>Feuilles manquantes :</strong> {preview.missing.join(', ')}
                </div>
              </div>
            )}

            <div className="import-sheet-list">
              {preview.sheets.map((s) => (
                <div key={s.kind} className="import-sheet-item">
                  <div className="import-sheet-item-header">
                    <div className="import-sheet-item-title">
                      <strong>{s.label}</strong>
                      <span className="import-sheet-item-meta">
                        feuille «{s.sheetName}»
                        {s.headerRow > 0 ? ` · en-têtes ligne ${s.headerRow}` : ''}
                      </span>
                    </div>
                    <div className="import-sheet-item-badges">
                      <span className="badge badge-success">
                        {s.validRows.length} valide{s.validRows.length > 1 ? 's' : ''}
                      </span>
                      {s.errors.length > 0 && (
                        <span className="badge badge-danger">
                          {s.errors.length} erreur{s.errors.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {s.validRows.length > 0 && (
                    <details className="import-details">
                      <summary>Aperçu des 5 premières lignes valides</summary>
                      <pre className="import-preview-json">
                        {JSON.stringify(s.validRows.slice(0, 5), null, 2)}
                      </pre>
                    </details>
                  )}

                  {s.errors.length > 0 && (
                    <details className="import-details">
                      <summary className="errors">Voir les erreurs ({s.errors.length})</summary>
                      <div className="import-error-list">
                        {s.errors.slice(0, 50).map((e, i) => (
                          <div key={i}>
                            Ligne {e.row} : {e.message}
                          </div>
                        ))}
                        {s.errors.length > 50 && (
                          <div className="import-error-list-more">
                            … et {s.errors.length - 50} de plus
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>

            <div className="import-actions">
              <button
                className="btn btn-secondary"
                type="button"
                disabled={importing}
                onClick={() => {
                  setPreviewOpen(false);
                  setPreview(null);
                }}
              >
                Annuler
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={importing || totalValid === 0}
                onClick={handleConfirmImport}
              >
                {importing ? 'Import en cours…' : `Importer ${totalValid} ligne(s)`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
