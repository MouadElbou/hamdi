/**
 * Document printing / PDF generation.
 *
 * The renderer is sandboxed with a strict CSP (no inline styles), and window.open
 * is denied — so we render documents in a HIDDEN, throwaway BrowserWindow loaded
 * from a self-contained data: URL (its own session, not bound to the app CSP), then
 * use webContents.printToPDF() / print(). Logo is embedded as a base64 data: URI.
 */

import { BrowserWindow } from 'electron';

export type PrintTarget = 'a4' | 'thermal';

export interface PrintDocLine {
  designation: string; barcode: string | null;
  quantity: number; selling_unit_price: number; line_total: number;
}
export interface PrintDoc {
  doc_type: string; ref_number: string; date: string;
  client_name: string | null; client_address: string | null; client_ice: string | null; client_phone: string | null;
  payment_type: string | null; observation: string | null; valid_until: string | null; total: number;
  lines: PrintDocLine[];
}
export interface PrintCompany {
  name?: string | null; address?: string | null; phone?: string | null; email?: string | null;
  ice?: string | null; rc?: string | null; if_num?: string | null; patente?: string | null; cnss?: string | null;
  rib?: string | null; bank_name?: string | null; header_note?: string | null; footer_note?: string | null; logo?: string | null;
}

const DOC_TITLE: Record<string, string> = { facture: 'FACTURE', devis: 'DEVIS', bon_livraison: 'BON DE LIVRAISON', ticket: 'TICKET' };
const PRICED: Record<string, boolean> = { facture: true, devis: true, ticket: true, bon_livraison: false };

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]!);
}
// Escape first (XSS-safe), then turn the client's literal newlines into line breaks so
// multi-line header/footer notes render as typed.
function multiline(v: unknown): string {
  return esc(v).replace(/\r?\n/g, '<br>');
}
function dh(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
}
function frDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// TVA (Moroccan VAT). Prices stored on documents are treated as HT (hors taxe);
// the 20% tax is added on top to obtain the TTC total shown on Factures / Devis.
const TVA_RATE = 0.20;
const TVA_DOC_TYPES = new Set(['facture', 'devis']);

function computeTotals(totalHt: number, withTva: boolean): { ht: number; tva: number; ttc: number } {
  const tva = withTva ? Math.round(totalHt * TVA_RATE) : 0;
  return { ht: totalHt, tva, ttc: totalHt + tva };
}

// ── Montant en toutes lettres (French number-to-words) ────────────
const FR_UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
];
const FR_TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

// 0..99. `noPlural` suppresses the plural "s" on "quatre-vingts" when the word is
// followed by another scale word (e.g. "quatre-vingt mille").
function frTwoDigits(n: number, noPlural = false): string {
  if (n < 20) return FR_UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7 || t === 9) {
    const base = t === 7 ? 'soixante' : 'quatre-vingt';
    if (t === 7 && u === 1) return 'soixante et onze';
    return base + '-' + FR_UNITS[10 + u];
  }
  if (u === 0) return t === 8 && !noPlural ? 'quatre-vingts' : FR_TENS[t];
  if (u === 1 && t !== 8) return FR_TENS[t] + ' et un';
  return FR_TENS[t] + '-' + FR_UNITS[u];
}

// 0..999. "cent" takes a plural "s" only when it ends the number (deux cents),
// not when followed by another word (deux cent un, deux cent mille → noPlural).
function frThreeDigits(n: number, noPlural = false): string {
  if (n < 100) return frTwoDigits(n, noPlural);
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (r === 0) return h === 1 ? 'cent' : FR_UNITS[h] + (noPlural ? ' cent' : ' cents');
  const head = h === 1 ? 'cent' : FR_UNITS[h] + ' cent';
  return head + ' ' + frTwoDigits(r, noPlural);
}

function frInteger(n: number): string {
  if (n <= 0) return 'zéro';
  const parts: string[] = [];
  const milliards = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (milliards > 0) parts.push(frThreeDigits(milliards) + (milliards === 1 ? ' milliard' : ' milliards'));
  if (millions > 0) parts.push(frThreeDigits(millions) + (millions === 1 ? ' million' : ' millions'));
  if (thousands > 0) parts.push(thousands === 1 ? 'mille' : frThreeDigits(thousands, true) + ' mille');
  if (rest > 0) parts.push(frThreeDigits(rest));
  return parts.join(' ');
}

// e.g. 72050 → "SEPT CENT VINGT DIRHAMS ET CINQUANTE CENTIMES"
function amountInWords(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  const dirhams = Math.floor(safe / 100);
  const centimes = safe % 100;
  let out = frInteger(dirhams) + (dirhams <= 1 ? ' dirham' : ' dirhams');
  if (centimes > 0) out += ' et ' + frInteger(centimes) + (centimes === 1 ? ' centime' : ' centimes');
  return out.toUpperCase();
}

function legalLine(c: PrintCompany): string {
  const parts: Array<[string, string | null | undefined]> = [['ICE', c.ice], ['RC', c.rc], ['IF', c.if_num], ['Patente', c.patente], ['CNSS', c.cnss]];
  return parts.filter(([, v]) => v).map(([k, v]) => `${k}: ${esc(v)}`).join(' &nbsp;•&nbsp; ');
}

export function buildDocumentHtml(doc: PrintDoc, company: PrintCompany, target: PrintTarget): string {
  return target === 'thermal' ? buildThermal(doc, company) : buildA4(doc, company);
}

function buildA4(doc: PrintDoc, c: PrintCompany): string {
  const priced = PRICED[doc.doc_type] ?? true;
  const title = DOC_TITLE[doc.doc_type] ?? 'DOCUMENT';
  const rows = doc.lines.map((l, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(l.designation)}${l.barcode ? `<div class="muted">${esc(l.barcode)}</div>` : ''}</td>
      <td class="r">${l.quantity}</td>
      ${priced ? `<td class="r">${dh(l.selling_unit_price)}</td><td class="r">${dh(l.line_total)}</td>` : ''}
    </tr>`).join('');
  const legal = legalLine(c);
  const withTva = priced && TVA_DOC_TYPES.has(doc.doc_type);
  const t = computeTotals(doc.total, withTva);
  const totalsBlock = !priced ? '' : withTva
    ? `<div class="totals"><table>
        <tr><td>Total HT</td><td class="r">${dh(t.ht)}</td></tr>
        <tr><td>TVA (20%)</td><td class="r">${dh(t.tva)}</td></tr>
        <tr class="grand"><td>Total TTC</td><td class="r">${dh(t.ttc)}</td></tr>
      </table></div>`
    : `<div class="totals"><table><tr class="grand"><td>TOTAL</td><td class="r">${dh(doc.total)}</td></tr></table></div>`;
  const wordsBlock = withTva && t.ttc > 0
    ? `<div class="amount-words">${doc.doc_type === 'facture'
        ? 'LA PRÉSENTE FACTURE EST ARRÊTÉE À LA SOMME DE'
        : 'LE PRÉSENT DEVIS EST ARRÊTÉ À LA SOMME DE'} : <strong>${amountInWords(t.ttc)}</strong></div>`
    : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 12px; margin: 0; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #222; padding-bottom: 10px; }
    .co-logo { max-height: 64px; max-width: 200px; object-fit: contain; }
    .co-name { font-size: 18px; font-weight: 700; }
    .co-meta { color: #444; line-height: 1.5; margin-top: 4px; }
    .doc-box { text-align: right; }
    .doc-title { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
    .doc-ref { margin-top: 4px; color: #333; }
    .parties { display: flex; justify-content: space-between; margin: 18px 0; gap: 20px; }
    .client { border: 1px solid #ccc; border-radius: 6px; padding: 10px 12px; min-width: 240px; }
    .client h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: .5px; }
    .client .nm { font-weight: 700; font-size: 13px; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 6px; }
    table.items th { background: #222; color: #fff; padding: 7px 8px; text-align: left; font-size: 11px; }
    table.items td { padding: 7px 8px; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
    .r { text-align: right; } .c { text-align: center; width: 28px; }
    .muted { color: #888; font-size: 10px; }
    .totals { display: flex; justify-content: flex-end; margin-top: 14px; }
    .totals table { border-collapse: collapse; min-width: 260px; }
    .totals td { padding: 6px 12px; }
    .totals .grand { font-size: 15px; font-weight: 700; border-top: 2px solid #222; }
    .amount-words { margin-top: 14px; font-size: 12px; line-height: 1.5; }
    .amount-words strong { font-weight: 700; }
    .obs { margin-top: 18px; color: #333; }
    .subhead { margin-top: 10px; color: #333; font-size: 11.5px; line-height: 1.5; white-space: normal; overflow-wrap: anywhere; }
    .foot { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; color: #555; font-size: 10.5px; line-height: 1.6; overflow-wrap: anywhere; }
  </style></head><body>
    <div class="head">
      <div>
        ${c.logo ? `<img class="co-logo" src="${esc(c.logo)}" alt="logo">` : `<div class="co-name">${esc(c.name || 'Votre société')}</div>`}
        ${c.logo && c.name ? `<div class="co-name" style="margin-top:6px">${esc(c.name)}</div>` : ''}
        <div class="co-meta">
          ${c.address ? esc(c.address) + '<br>' : ''}
          ${[c.phone ? 'Tél: ' + esc(c.phone) : '', c.email ? esc(c.email) : ''].filter(Boolean).join(' &nbsp;•&nbsp; ')}
          ${legal ? '<br>' + legal : ''}
        </div>
      </div>
      <div class="doc-box">
        <div class="doc-title">${title}</div>
        <div class="doc-ref"><strong>N° ${esc(doc.ref_number)}</strong></div>
        <div class="doc-ref">Date: ${frDate(doc.date)}</div>
        ${doc.valid_until ? `<div class="doc-ref">Valable jusqu'au: ${frDate(doc.valid_until)}</div>` : ''}
        ${doc.payment_type ? `<div class="doc-ref">Paiement: ${doc.payment_type === 'credit' ? 'Crédit' : 'Comptant'}</div>` : ''}
      </div>
    </div>

    ${c.header_note ? `<div class="subhead" dir="auto">${multiline(c.header_note)}</div>` : ''}

    <div class="parties">
      <div class="client">
        <h4>Client</h4>
        <div class="nm">${esc(doc.client_name || '—')}</div>
        ${doc.client_address ? `<div>${esc(doc.client_address)}</div>` : ''}
        ${doc.client_phone ? `<div>Tél: ${esc(doc.client_phone)}</div>` : ''}
        ${doc.client_ice ? `<div>ICE: ${esc(doc.client_ice)}</div>` : ''}
      </div>
    </div>

    <table class="items">
      <thead><tr><th class="c">#</th><th>Désignation</th><th class="r">Qté</th>${priced ? '<th class="r">P.U.</th><th class="r">Total</th>' : ''}</tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="c muted">Aucune ligne</td></tr>'}</tbody>
    </table>

    ${totalsBlock}
    ${wordsBlock}

    ${doc.observation ? `<div class="obs"><strong>Observation:</strong> ${esc(doc.observation)}</div>` : ''}

    <div class="foot" dir="auto">
      ${[
        c.footer_note ? multiline(c.footer_note) : '',
        c.rib ? 'RIB: ' + esc(c.rib) + (c.bank_name ? ' (' + esc(c.bank_name) + ')' : '') : '',
      ].filter(Boolean).join('<br>')}
    </div>
  </body></html>`;
}

function buildThermal(doc: PrintDoc, c: PrintCompany): string {
  const priced = PRICED[doc.doc_type] ?? true;
  const rows = doc.lines.map(l => `
    <div class="ln">
      <div class="d">${esc(l.designation)}</div>
      <div class="q">${l.quantity} x ${priced ? dh(l.selling_unit_price) : ''}${priced ? `<span class="t">${dh(l.line_total)}</span>` : ''}</div>
    </div>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: 72mm; margin: 0 auto; padding: 4mm 2mm; font-family: 'Courier New', monospace; font-size: 11px; color: #000; overflow-wrap: anywhere; }
    .ct { text-align: center; }
    .co { font-size: 14px; font-weight: 700; }
    .sm { font-size: 10px; }
    .hr { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; }
    .ln { margin: 3px 0; }
    .ln .d { font-weight: 600; }
    .ln .q { display: flex; justify-content: space-between; }
    .ln .t { font-weight: 700; }
    .tot { display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; margin-top: 4px; }
    .logo { max-width: 50mm; max-height: 18mm; object-fit: contain; }
  </style></head><body>
    <div class="ct">
      ${c.logo ? `<img class="logo" src="${esc(c.logo)}"><br>` : ''}
      ${c.name ? `<div class="co">${esc(c.name)}</div>` : ''}
      ${c.address ? `<div class="sm">${esc(c.address)}</div>` : ''}
      ${c.phone ? `<div class="sm">Tél: ${esc(c.phone)}</div>` : ''}
      ${c.ice ? `<div class="sm">ICE: ${esc(c.ice)}</div>` : ''}
      ${c.header_note ? `<div class="sm" style="margin-top:3px" dir="auto">${multiline(c.header_note)}</div>` : ''}
    </div>
    <div class="hr"></div>
    <div class="row"><span>${esc(DOC_TITLE[doc.doc_type] || '')} ${esc(doc.ref_number)}</span></div>
    <div class="row sm"><span>${frDate(doc.date)}</span>${doc.client_name ? `<span>${esc(doc.client_name)}</span>` : ''}</div>
    <div class="hr"></div>
    ${rows}
    <div class="hr"></div>
    ${priced ? `<div class="tot"><span>TOTAL</span><span>${dh(doc.total)}</span></div>` : ''}
    <div class="hr"></div>
    <div class="ct sm" dir="auto">${c.footer_note ? multiline(c.footer_note) : 'Merci de votre visite'}</div>
  </body></html>`;
}

async function withHiddenWindow<T>(html: string, fn: (win: BrowserWindow) => Promise<T>): Promise<T> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false },
  });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return await fn(win);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

export async function renderToPdf(html: string, target: PrintTarget): Promise<Buffer> {
  return withHiddenWindow(html, async (win) => {
    // Thermal: let the HTML's `@page { size: 80mm auto }` drive page size — printToPDF's
    // numeric pageSize is interpreted in inches, so a microns-style {width:80000} would yield
    // an enormous page. preferCSSPageSize gives a true 80mm-wide, variable-height receipt.
    const opts = target === 'thermal'
      ? { printBackground: true, preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } }
      : { printBackground: true, pageSize: 'A4' as const, margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } };
    return await win.webContents.printToPDF(opts as Electron.PrintToPDFOptions);
  });
}

export async function printHtml(html: string, target: PrintTarget, deviceName?: string): Promise<void> {
  return withHiddenWindow(html, async (win) => {
    await new Promise<void>((resolve, reject) => {
      const opts = {
        silent: !!deviceName,
        printBackground: true,
        margins: { marginType: 'none' as const },
        ...(deviceName ? { deviceName } : {}),
        ...(target === 'thermal' ? { pageSize: { width: 80000, height: 297000 } } : { pageSize: 'A4' as const }),
      };
      win.webContents.print(opts as Electron.WebContentsPrintOptions, (success, failureReason) => {
        // Treat a user-cancelled print dialog as a no-op, not an error.
        if (success || !failureReason || /cancel/i.test(failureReason)) resolve();
        else reject(new Error(failureReason));
      });
    });
  });
}
