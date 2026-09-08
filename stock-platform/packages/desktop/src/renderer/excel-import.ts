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

export interface IgnoredColumn {
  /** Original header text of the column that was matched but then discarded. */
  header: string;
  /** French, user-facing explanation. */
  reason: string;
  /** Which field the header had matched before being discarded (lets the UI say what the rows lose). */
  field?: PurchaseField;
}

export interface ParsedSheet {
  /** 0-based index of the detected header row within the grid returned by sheet_to_json. */
  headerRowIndex: number;
  columnMap: ColumnMatch[];
  /** Data rows in file order (never reordered). */
  rows: ParsedRow[];
  /**
   * Rows whose mapped business fields were all empty (summary/filler rows)
   * sitting BETWEEN data rows — skipped silently. Trailing blank rows below the
   * last data row (formatted-but-empty filler) are not counted.
   */
  skippedEmpty: number;
  /**
   * Rows that reached the boutique check with a blank/placeholder boutique cell
   * (or with no boutique column at all). Counted whether or not a default was
   * applied, so the dialog can say "N ligne(s) sans boutique".
   */
  missingBoutiqueRows: number;
  /** Rows whose boutique was filled in from options.defaultBoutique. */
  defaultBoutiqueApplied: number;
  /** Header-matched columns that were dropped because their content was not what the header claimed. */
  ignoredColumns: IgnoredColumn[];
}

export interface ErrorSummaryEntry {
  error: string;
  count: number;
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
  ['barcode', ['code barres', 'code-barres', 'codebarre', 'codebarres', 'cb', 'ean', 'barcode', 'code barre', 'code-barre']],
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

/**
 * Excel writes a dimension like "A3:I43" when rows 1-2 are truly empty, and
 * sheet_to_json then iterates from that first row — so grid row 0 would be
 * Excel row 3 and every displayed row number would be off by two. Anchor the
 * range at A1 so grid indices always equal Excel's own row numbers.
 */
export function anchorSheetRangeAtA1(sheet: XLSX.WorkSheet): void {
  const ref = sheet['!ref'] as string | undefined;
  if (!ref) return;
  let range: XLSX.Range;
  try {
    range = XLSX.utils.decode_range(ref);
  } catch {
    return;
  }
  if (range.s.r === 0 && range.s.c === 0) return;
  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: range.e });
}

// ─── Value coercion ─────────────────────────────────────────────────

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === '';
}

// Filler tokens hand-typed sheets use for "nothing here". Compared after
// normalizeHeader (lowercase, accents stripped, trimmed), so "N/A", "Aucun "
// and "—" all match. Numeric 0 is covered too (String(0) === '0').
// Deliberately NOT "x" / "na": supplier codes are 1–3 letter codes (F5, AB,
// MC…), so a supplier genuinely named "X" or "NA" must survive.
const PLACEHOLDER_TOKENS: ReadonlySet<string> = new Set([
  '0', '-', '—', '–', '_', 'n/a', 'aucun', 'aucune', 'null', 'none',
]);

/** Blank, numeric 0, or a filler token ("-", "n/a", "aucun"…) — i.e. "no value" for optional text cells. */
export function isPlaceholder(v: unknown): boolean {
  if (isBlank(v)) return true;
  if (typeof v === 'number') return v === 0;
  return PLACEHOLDER_TOKENS.has(normalizeHeader(v));
}

/** Human-readable rendering of a raw sheet cell for the preview (never Date.toString()). */
export function formatRawCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '—';
    const d = String(v.getDate()).padStart(2, '0');
    const m = String(v.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${v.getFullYear()}`;
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v);
    return v.toLocaleString('fr-FR', { useGrouping: false, maximumFractionDigits: 6 });
  }
  const s = String(v).trim();
  return s === '' ? '—' : s;
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

// ─── Column sanity checks ───────────────────────────────────────────

const ROW_NUMBER_MIN_SAMPLES = 10;
const ROW_NUMBER_ALIGNED_RATIO = 0.95;
const ROW_NUMBER_REASON = 'contient des numéros de ligne, pas des codes-barres';

/** Plain integer as a number or as un-padded digits ("12" yes, "0012" no — that is a code). */
function plainInteger(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  const s = String(v ?? '').trim();
  return /^(0|[1-9]\d*)$/.test(s) ? Number(s) : null;
}

/**
 * True when the column's integer cells are the sheet's own row counter: each
 * value equals its position below the header (1, 2, 3… — the hand-typed habit)
 * or its Excel row number (=ROW()). Alignment with the grid position, not
 * adjacency, so blank cells, "TOTAL" footers and gaps cost nothing, while
 * sequential internal codes (1001, 1002…), padded codes ("0001") and real
 * numeric barcodes (EAN) never match.
 */
function looksLikeRowNumbers(grid: unknown[][], headerRowIndex: number, columnIndex: number): boolean {
  let integers = 0;
  let fromHeader = 0;
  let excelRow = 0;
  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const n = plainInteger(grid[r]?.[columnIndex]);
    if (n === null) continue;
    integers++;
    if (n === r - headerRowIndex) fromHeader++;
    if (n === r + 1) excelRow++;
  }
  if (integers < ROW_NUMBER_MIN_SAMPLES) return false;
  return Math.max(fromHeader, excelRow) >= integers * ROW_NUMBER_ALIGNED_RATIO;
}

/**
 * Drop a "code-barres" column whose cells are really the sheet's row numbers
 * (a common layout in hand-made sheets) so hundreds of lots don't get barcodes
 * 1, 2, 3… Returns the surviving column map and what was discarded.
 */
function dropRowNumberBarcode(
  grid: unknown[][],
  headerRowIndex: number,
  columnMap: ColumnMatch[]
): { columnMap: ColumnMatch[]; ignoredColumns: IgnoredColumn[] } {
  const barcodeCol = columnMap.find(c => c.field === 'barcode');
  if (!barcodeCol) return { columnMap, ignoredColumns: [] };
  if (!looksLikeRowNumbers(grid, headerRowIndex, barcodeCol.columnIndex)) return { columnMap, ignoredColumns: [] };
  return {
    columnMap: columnMap.filter(c => c.field !== 'barcode'),
    ignoredColumns: [{ header: barcodeCol.header, reason: ROW_NUMBER_REASON, field: 'barcode' }],
  };
}

// ─── Error summary ──────────────────────────────────────────────────

/** Distinct error messages with their occurrence count, most frequent first (ties keep first-seen order). */
export function summarizeErrors(rows: ParsedRow[]): ErrorSummaryEntry[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.error === null) continue;
    counts.set(row.error, (counts.get(row.error) ?? 0) + 1);
  }
  return Array.from(counts, ([error, count]) => ({ error, count })).sort((a, b) => b.count - a.count);
}

// ─── Sheet parsing ──────────────────────────────────────────────────

export function parsePurchaseSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  options?: { defaultBoutique?: string }
): ParsedSheet {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    return {
      headerRowIndex: 0, columnMap: [], rows: [], skippedEmpty: 0,
      missingBoutiqueRows: 0, defaultBoutiqueApplied: 0, ignoredColumns: [],
    };
  }

  clampSheetRange(sheet);
  anchorSheetRangeAtA1(sheet);
  // raw:true keeps genuine date cells as Date objects (cellDates:true at read
  // time) instead of US-ordered display text ("7/24/16"); blankrows:true keeps
  // grid row indices equal to the sheet's real row numbers.
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true, blankrows: true });
  const detected = detectHeaderRow(grid);
  const headerRowIndex = detected.headerRowIndex;
  const { columnMap, ignoredColumns } = dropRowNumberBarcode(grid, headerRowIndex, detected.columnMap);

  const colIndex = new Map<PurchaseField, number>();
  for (const c of columnMap) colIndex.set(c.field, c.columnIndex);
  const defaultBoutique = options?.defaultBoutique?.trim() || '';
  const hasBoutiqueCol = colIndex.has('boutique');

  const rows: ParsedRow[] = [];
  let skippedEmpty = 0;
  // Blank rows seen since the last data row: only counted once another data
  // row follows, so the formatted-but-empty tail of a sheet is not reported.
  let trailingBlank = 0;
  let missingBoutiqueRows = 0;
  let defaultBoutiqueApplied = 0;

  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const raw = grid[r] ?? [];
    const cell = (field: PurchaseField): unknown => {
      const idx = colIndex.get(field);
      return idx === undefined ? null : raw[idx] ?? null;
    };

    // Summary/filler rows (only a row number and/or a computed total in
    // unmapped columns) carry no business data at all — skip silently.
    if (BUSINESS_FIELDS.every(f => isBlank(cell(f)))) {
      trailingBlank++;
      continue;
    }
    skippedEmpty += trailingBlank;
    trailingBlank = 0;

    const index = r + 1;

    const date = toISODate(cell('date'));
    if (!date) { rows.push({ index, data: null, error: 'Date invalide ou manquante', raw }); continue; }

    // A category cell of "0" / "-" is filler, not a category to auto-create.
    const cat = isPlaceholder(cell('category')) ? '' : String(cell('category')).trim();
    if (!cat) { rows.push({ index, data: null, error: 'Catégorie manquante', raw }); continue; }

    const desig = isBlank(cell('designation')) ? '' : String(cell('designation')).trim();
    if (!desig) { rows.push({ index, data: null, error: 'Désignation manquante', raw }); continue; }

    // A blank or placeholder boutique cell ("0", "-", "n/a"…) counts as
    // missing — never create a boutique literally named "0". The default,
    // when set, fills in per row, whether the column exists or not.
    let bout = '';
    const boutCell = cell('boutique');
    if (hasBoutiqueCol && !isPlaceholder(boutCell)) {
      bout = String(boutCell).trim();
    } else {
      missingBoutiqueRows++;
      if (defaultBoutique) {
        bout = defaultBoutique;
        defaultBoutiqueApplied++;
      }
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
    // Placeholder supplier ("0", "-") → undefined so the handler applies its own
    // default. Same for sub-category and barcode: a column of 0 / "-" must not
    // create a sub-category named "0" or give hundreds of lots barcode "0".
    const supplier = isPlaceholder(cell('supplier')) ? '' : String(cell('supplier')).trim();
    const subCat = isPlaceholder(cell('subCategory')) ? '' : String(cell('subCategory')).trim();
    const barcode = isPlaceholder(cell('barcode')) ? '' : String(cell('barcode')).trim();

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

  return { headerRowIndex, columnMap, rows, skippedEmpty, missingBoutiqueRows, defaultBoutiqueApplied, ignoredColumns };
}
