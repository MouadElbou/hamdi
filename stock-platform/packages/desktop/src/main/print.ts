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
  rib?: string | null; bank_name?: string | null; footer_note?: string | null; logo?: string | null;
}

const DOC_TITLE: Record<string, string> = { facture: 'FACTURE', devis: 'DEVIS', bon_livraison: 'BON DE LIVRAISON', ticket: 'TICKET' };
const PRICED: Record<string, boolean> = { facture: true, devis: true, ticket: true, bon_livraison: false };

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]!);
}
function dh(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
}
function frDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
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
    .totals table { border-collapse: collapse; min-width: 240px; }
    .totals td { padding: 8px 12px; }
    .totals .grand { font-size: 15px; font-weight: 700; border-top: 2px solid #222; }
    .obs { margin-top: 18px; color: #333; }
    .foot { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; color: #555; font-size: 10.5px; line-height: 1.6; }
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

    ${priced ? `<div class="totals"><table><tr class="grand"><td>TOTAL</td><td class="r">${dh(doc.total)}</td></tr></table></div>` : ''}

    ${doc.observation ? `<div class="obs"><strong>Observation:</strong> ${esc(doc.observation)}</div>` : ''}

    <div class="foot">
      ${c.footer_note ? esc(c.footer_note) + '<br>' : ''}
      ${c.rib ? 'RIB: ' + esc(c.rib) + (c.bank_name ? ' (' + esc(c.bank_name) + ')' : '') : ''}
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
    body { width: 72mm; margin: 0 auto; padding: 4mm 2mm; font-family: 'Courier New', monospace; font-size: 11px; color: #000; }
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
      <div class="co">${esc(c.name || '')}</div>
      ${c.address ? `<div class="sm">${esc(c.address)}</div>` : ''}
      ${c.phone ? `<div class="sm">Tél: ${esc(c.phone)}</div>` : ''}
      ${c.ice ? `<div class="sm">ICE: ${esc(c.ice)}</div>` : ''}
    </div>
    <div class="hr"></div>
    <div class="row"><span>${esc(DOC_TITLE[doc.doc_type] || '')} ${esc(doc.ref_number)}</span></div>
    <div class="row sm"><span>${frDate(doc.date)}</span>${doc.client_name ? `<span>${esc(doc.client_name)}</span>` : ''}</div>
    <div class="hr"></div>
    ${rows}
    <div class="hr"></div>
    ${priced ? `<div class="tot"><span>TOTAL</span><span>${dh(doc.total)}</span></div>` : ''}
    <div class="hr"></div>
    <div class="ct sm">${c.footer_note ? esc(c.footer_note) : 'Merci de votre visite'}</div>
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
