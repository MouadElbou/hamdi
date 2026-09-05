// Pure Excel parsing for the purchases import (no React, no DOM, no window).
// Kept side-effect-free so it can be exercised from a plain node test.
import * as XLSX from 'xlsx';

export interface ExcelRow {
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

export interface ParsedRow {
  /** 1-based row number in the sheet grid (blank rows included), matching Excel's own numbering. */
  index: number;
  data: ExcelRow | null;
  error: string | null;
  raw: unknown[];
}

export type PurchaseField =
  | 'date'
  | 'category'
  | 'designation'
  | 'supplier'
  | 'boutique'
  | 'quantity'
  | 'purchasePrice'
  | 'resalePrice'
  | 'sellingPrice'
  | 'subCategory'
  | 'barcode';

export interface ColumnMatch {
  field: PurchaseField;
  columnIndex: number;
  /** Original header text (whitespace collapsed), for display. */
  header: string;
}

export interface ParsedSheet {
  /** 0-based index of the detected header row within the grid returned by sheet_to_json. */
  headerRowIndex: number;
  columnMap: ColumnMatch[];
  rows: ParsedRow[];
  /** Rows whose mapped business fields were all empty (summary/filler rows) — skipped silently. */
  skippedEmpty: number;
}

export const FIELD_LABELS: Record<PurchaseField, string> = {
  date: 'Date',
  category: 'Catégorie',
  designation: 'Désignation',
  supplier: 'Fournisseur',
  boutique: 'Boutique',
  quantity: 'Quantité',
  purchasePrice: "Prix d'achat",
  resalePrice: 'PV revendeur',
  sellingPrice: 'PV public',
  subCategory: 'Sous-catégorie',
  barcode: 'Code-barres',
};

// ─── Header matching ────────────────────────────────────────────────

const HEADER_SYNONYMS: Array<[PurchaseField, string[]]> = [
  ['date', ['date', 'date achat', "date d'achat", 'date dachat']],
  ['category', ['categorie', 'categories', 'famille']],
  ['designation', ['designation', 'produit', 'article', 'nom', 'libelle']],
  ['supplier', ['fournisseur', 'frs']],
  ['boutique', ['boutique', 'magasin', 'depot']],
  ['quantity', ['stock initial', 'stock', 'quantite', 'qte', 'qty', 'quantity', 'nbr', 'nombre']],
  ['purchasePrice', ['pa', 'prix achat', "prix d'achat", 'cout', 'prix achat unitaire', 'pa unit', 'pa unitaire']],
  ['resalePrice', ['pv rev', 'pv revendeur', 'prix revendeur', 'prix rev', 'prix de vente revendeur', 'prix bloc']],
  ['sellingPrice', ['pv', 'pvp', 'pv pub', 'prix vente', 'prix de vente', 'prix vente public', 'prix de vente public', 'pv unit']],
  ['subCategory', ['sous categorie', 'sous-categorie', 'sous cat']],
  ['barcode', ['code barres', 'code-barres', 'codebarre', 'cb', 'ean', 'barcode', 'code barre']],
];

/** lowercase, strip accents, collapse whitespace (incl. \r\n), trim, drop trailing colons. */
export function normalizeHeader(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/:+$/, '')
    .trim();
}

const SYNONYM_MAP: Map<string, PurchaseField> = (() => {
  const map = new Map<string, PurchaseField>();
  for (const [field, synonyms] of HEADER_SYNONYMS) {
    for (const syn of synonyms) map.set(normalizeHeader(syn), field);
  }
  return map;
})();

function matchHeaderRow(row: unknown[]): ColumnMatch[] {
  const matches: ColumnMatch[] = [];
  const seen = new Set<PurchaseField>();
  for (let c = 0; c < row.length; c++) {
    const norm = normalizeHeader(row[c]);
    if (!norm) continue;
    const field = SYNONYM_MAP.get(norm);
    if (field && !seen.has(field)) {
      seen.add(field);
      matches.push({ field, columnIndex: c, header: String(row[c]).replace(/\s+/g, ' ').trim() });
    }
  }
  return matches;
}

const HEADER_SCAN_LIMIT = 40;

function detectHeaderRow(grid: unknown[][]): { headerRowIndex: number; columnMap: ColumnMatch[] } {
  const limit = Math.min(grid.length, HEADER_SCAN_LIMIT);
  for (let r = 0; r < limit; r++) {
    const columnMap = matchHeaderRow(grid[r] ?? []);
    if (columnMap.length >= 2 && columnMap.some(c => c.field === 'date')) {
      return { headerRowIndex: r, columnMap };
    }
  }
  // Fallback: treat the first row as the header.
  return { headerRowIndex: 0, columnMap: matchHeaderRow(grid[0] ?? []) };
}

// ─── Range clamp ────────────────────────────────────────────────────

// Above this many declared cells, recompute the real used range from the
// actual cell keys. Sheets with stray formatting can declare ranges like
// A1:XFD8282 (~135M cells) which would freeze sheet_to_json.
const RANGE_CLAMP_THRESHOLD = 100_000;

/** Shrink an absurdly large declared !ref to the sheet's real used range. */
export function clampSheetRange(sheet: XLSX.WorkSheet): void {
  const ref = sheet['!ref'] as string | undefined;
  if (!ref) return;
  let declared: XLSX.Range;
  try {
    declared = XLSX.utils.decode_range(ref);
  } catch {
    return;
  }
  const declaredCells = (declared.e.r - declared.s.r + 1) * (declared.e.c - declared.s.c + 1);
  if (declaredCells <= RANGE_CLAMP_THRESHOLD) return;
  let maxRow = 0;
  let maxCol = 0;
  let found = false;
  for (const key of Object.keys(sheet)) {
    if (key.startsWith('!')) continue;
    let cell: XLSX.CellAddress;
    try {
      cell = XLSX.utils.decode_cell(key);
    } catch {
      continue;
    }
    if (cell.r < 0 || cell.c < 0) continue;
    if (cell.r > maxRow) maxRow = cell.r;
    if (cell.c > maxCol) maxCol = cell.c;
    found = true;
  }
  if (!found) {
    // No real cells at all — the declared range is pure formatting bloat.
    sheet['!ref'] = 'A1:A1';
    return;
  }
  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
}

// ─── Value coercion ─────────────────────────────────────────────────

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === '';
}

/** Excel serial date (1900 epoch) → ISO string; null when out of plausible range. */
function excelSerialToISO(n: number): string | null {
  if (!Number.isFinite(n) || n < 15000 || n > 60000) return null;
  const d = new Date(Math.round((n - 25569) * 86400000));
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Round-trip check rejecting calendar-impossible dates ("2020-02-31"). */
function calendarValid(iso: string): string | null {
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export function toISODate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'number') return excelSerialToISO(v);
  let s = String(v).trim();
  if (!s) return null;
  // Common typo in hand-typed sheets: letter O instead of zero ("26/12/2O2O").
  if (/^[0-9oO][0-9oO/\-. ]*$/.test(s)) s = s.replace(/[oO]/g, '0');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return calendarValid(s.slice(0, 10));
  const match = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (match && match[1] && match[2] && match[3]) {
    const dNum = Number(match[1]);
    const moNum = Number(match[2]);
    if (dNum < 1 || dNum > 31 || moNum < 1 || moNum > 12) return null;
    let y = match[3];
    // Two-digit years follow Excel's pivot: 00-29 → 20xx, 30-99 → 19xx.
    if (y.length === 2) y = (Number(y) >= 30 ? '19' : '20') + y;
    if (y.length === 3) return null;
    return calendarValid(`${y}-${String(moNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`);
  }
  // Raw Excel serial that arrived as text (General-formatted date cell).
  if (/^\d+(\.\d+)?$/.test(s)) return excelSerialToISO(Number(s));
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return toISODate(parsed);
  return null;
}

export function toNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function toCents(v: unknown): number | null {
  const n = toNumber(v);
  if (n === null) return null;
  return Math.round(n * 100);
}

// ─── Public API ─────────────────────────────────────────────────────

export function listSheets(wb: XLSX.WorkBook): string[] {
  return wb.SheetNames.slice();
}

/** First sheet whose name contains "achat" (accent/case-insensitive), else the first sheet. */
export function pickDefaultSheet(sheetNames: string[]): string | null {
  const match = sheetNames.find(n => normalizeHeader(n).includes('achat'));
  return match ?? sheetNames[0] ?? null;
}

const BUSINESS_FIELDS: PurchaseField[] = [
  'date', 'category', 'designation', 'supplier', 'boutique', 'quantity', 'purchasePrice', 'resalePrice', 'sellingPrice',
];

export function parsePurchaseSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  options?: { defaultBoutique?: string }
): ParsedSheet {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { headerRowIndex: 0, columnMap: [], rows: [], skippedEmpty: 0 };

  clampSheetRange(sheet);
  // raw:true keeps genuine date cells as Date objects (cellDates:true at read
  // time) instead of US-ordered display text ("7/24/16"); blankrows:true keeps
  // grid row indices equal to the sheet's real row numbers.
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true, blankrows: true });
  const { headerRowIndex, columnMap } = detectHeaderRow(grid);

  const colIndex = new Map<PurchaseField, number>();
  for (const c of columnMap) colIndex.set(c.field, c.columnIndex);
  const defaultBoutique = options?.defaultBoutique?.trim() || '';

  const rows: ParsedRow[] = [];
  let skippedEmpty = 0;

  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const raw = grid[r] ?? [];
    const cell = (field: PurchaseField): unknown => {
      const idx = colIndex.get(field);
      return idx === undefined ? null : raw[idx] ?? null;
    };

    // Summary/filler rows (only a row number and/or a computed total in
    // unmapped columns) carry no business data at all — skip silently.
    if (BUSINESS_FIELDS.every(f => isBlank(cell(f)))) {
      skippedEmpty++;
      continue;
    }

    const index = r + 1;

    const date = toISODate(cell('date'));
    if (!date) { rows.push({ index, data: null, error: 'Date invalide ou manquante', raw }); continue; }

    const cat = isBlank(cell('category')) ? '' : String(cell('category')).trim();
    if (!cat) { rows.push({ index, data: null, error: 'Catégorie manquante', raw }); continue; }

    const desig = isBlank(cell('designation')) ? '' : String(cell('designation')).trim();
    if (!desig) { rows.push({ index, data: null, error: 'Désignation manquante', raw }); continue; }

    let bout = '';
    if (colIndex.has('boutique')) {
      bout = isBlank(cell('boutique')) ? '' : String(cell('boutique')).trim();
    } else {
      bout = defaultBoutique;
    }
    if (!bout) { rows.push({ index, data: null, error: 'Boutique manquante', raw }); continue; }

    const qtyNum = toNumber(cell('quantity'));
    if (qtyNum === null || !Number.isInteger(qtyNum) || qtyNum < 0) {
      rows.push({ index, data: null, error: 'Quantité invalide', raw });
      continue;
    }

    const pucCents = toCents(cell('purchasePrice'));
    if (pucCents === null || pucCents < 0) {
      rows.push({ index, data: null, error: "Prix d'achat invalide", raw });
      continue;
    }

    const resaleCents = toCents(cell('resalePrice'));
    const sellingCents = toCents(cell('sellingPrice'));
    const supplier = isBlank(cell('supplier')) ? '' : String(cell('supplier')).trim();
    const subCat = isBlank(cell('subCategory')) ? '' : String(cell('subCategory')).trim();
    const barcode = isBlank(cell('barcode')) ? '' : String(cell('barcode')).trim();

    const data: ExcelRow = {
      date,
      category: cat,
      designation: desig,
      supplier: supplier || undefined,
      boutique: bout,
      initialQuantity: qtyNum,
      purchaseUnitCost: pucCents,
      // 0 means "pas de prix" — the backend rejects 0 as a price, so map it to null.
      targetResalePrice: resaleCents !== null && resaleCents > 0 ? resaleCents : null,
      blockPrice: null,
      sellingPrice: sellingCents !== null && sellingCents > 0 ? sellingCents : null,
      subCategory: subCat || null,
      barcode: barcode || undefined,
    };
    rows.push({ index, data, error: null, raw });
  }

  return { headerRowIndex, columnMap, rows, skippedEmpty };
}
