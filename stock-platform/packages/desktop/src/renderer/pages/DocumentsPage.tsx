import React, { useEffect, useState } from 'react';
import { Modal } from '../components/Modal.js';
import { EditIcon, TrashIcon, CancelIcon } from '../components/Icons.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';
import { SearchableSelect } from '../components/SearchableSelect.js';
import Pagination, { PAGE_SIZE } from '../components/Pagination.js';
import { parseCents, parsePositiveInt, todayLocal } from '../utils.js';

type DocType = 'facture' | 'devis' | 'bon_livraison' | 'ticket';

interface StockItem {
  lotId: string; designation: string; category: string; remainingQuantity: number;
  sellingPrice: number | null; barcode: string | null;
}
interface DocLine {
  id?: string; lot_id: string | null; designation: string; barcode: string | null;
  quantity: number; selling_unit_price: number; line_total: number;
}
interface Doc {
  id: string; doc_type: DocType; ref_number: string; date: string;
  client_id: string | null; client_name: string | null; client_address: string | null;
  client_ice: string | null; client_phone: string | null; status: string;
  payment_type: string | null; observation: string | null; valid_until: string | null;
  sale_order_id: string | null; total: number;
  lines: DocLine[];
}
interface FormLine { lotId: string | null; designation: string; barcode: string | null; quantity: string; price: string; }

const DOC_TABS: Array<{ type: DocType; label: string }> = [
  { type: 'facture', label: 'Factures' },
  { type: 'devis', label: 'Devis' },
  { type: 'bon_livraison', label: 'Bons de livraison' },
  { type: 'ticket', label: 'Tickets' },
];
const DOC_SINGULAR: Record<DocType, string> = { facture: 'Facture', devis: 'Devis', bon_livraison: 'Bon de livraison', ticket: 'Ticket' };
const DEFAULT_STATUS: Record<DocType, string> = { facture: 'unpaid', devis: 'draft', bon_livraison: 'pending', ticket: 'issued' };
const SHOW_PRICE: Record<DocType, boolean> = { facture: true, devis: true, bon_livraison: false, ticket: true };

const STATUS_OPTIONS: Record<DocType, Array<{ value: string; label: string; cls: string }>> = {
  devis: [
    { value: 'draft', label: 'Brouillon', cls: 'badge-warning' },
    { value: 'sent', label: 'Envoyé', cls: 'badge-info' },
    { value: 'accepted', label: 'Accepté', cls: 'badge-success' },
    { value: 'refused', label: 'Refusé', cls: 'badge-danger' },
    { value: 'expired', label: 'Expiré', cls: 'badge-danger' },
  ],
  facture: [
    { value: 'unpaid', label: 'Non payée', cls: 'badge-warning' },
    { value: 'partial', label: 'Partiel', cls: 'badge-info' },
    { value: 'paid', label: 'Payée', cls: 'badge-success' },
  ],
  bon_livraison: [
    { value: 'pending', label: 'En préparation', cls: 'badge-warning' },
    { value: 'delivered', label: 'Livré', cls: 'badge-success' },
  ],
  ticket: [{ value: 'issued', label: 'Émis', cls: 'badge-info' }],
};

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
const statusInfo = (type: DocType, value: string) => STATUS_OPTIONS[type].find(s => s.value === value) || { value, label: value, cls: 'badge-info' };

export function DocumentsPage(): React.JSX.Element {
  const { addToast } = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [docType, setDocType] = useState<DocType>('facture');
  const [items, setItems] = useState<Doc[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [stock, setStock] = useState<StockItem[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    date: todayLocal(), clientName: '', clientAddress: '', clientIce: '', clientPhone: '',
    paymentType: 'comptant', validUntil: '', observation: '', status: 'unpaid',
  });
  const [lines, setLines] = useState<FormLine[]>([]);

  const [showFromSale, setShowFromSale] = useState(false);

  const load = () => {
    window.api.documents.list({ docType, search: search || undefined, page, limit: PAGE_SIZE })
      .then((r: unknown) => { const d = r as { items: Doc[]; total: number }; setItems(d.items || []); setTotal(d.total || 0); })
      .catch(() => addToast('Erreur lors du chargement des documents', 'error'));
  };
  useEffect(load, [docType, search, page]);

  const loadStock = () => {
    window.api.stock.list({ inStockOnly: false, limit: 5000 })
      .then((r: unknown) => setStock(((r as { items: StockItem[] }).items) || []))
      .catch(() => { /* optional */ });
  };

  const resetForm = () => {
    setForm({ date: todayLocal(), clientName: '', clientAddress: '', clientIce: '', clientPhone: '', paymentType: 'comptant', validUntil: '', observation: '', status: DEFAULT_STATUS[docType] });
    setLines([]);
  };
  const openCreate = () => { resetForm(); setEditingId(null); setShowForm(true); loadStock(); };
  const openEdit = async (id: string) => {
    loadStock();
    try {
      const doc = await window.api.documents.get(id) as Doc | null;
      if (!doc) { addToast('Document introuvable', 'error'); return; }
      setForm({
        date: doc.date, clientName: doc.client_name || '', clientAddress: doc.client_address || '',
        clientIce: doc.client_ice || '', clientPhone: doc.client_phone || '',
        paymentType: doc.payment_type || 'comptant', validUntil: doc.valid_until || '',
        observation: doc.observation || '', status: doc.status,
      });
      setLines(doc.lines.map(l => ({ lotId: l.lot_id, designation: l.designation, barcode: l.barcode, quantity: String(l.quantity), price: (l.selling_unit_price / 100).toFixed(2) })));
      setEditingId(id);
      setShowForm(true);
    } catch { addToast('Erreur lors du chargement', 'error'); }
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); resetForm(); };

  const addBlankLine = () => setLines(ls => [...ls, { lotId: null, designation: '', barcode: null, quantity: '1', price: '' }]);
  const addStockLine = (lotId: string) => {
    const lot = stock.find(s => s.lotId === lotId);
    if (!lot) return;
    setLines(ls => [...ls, {
      lotId: lot.lotId, designation: lot.designation, barcode: lot.barcode,
      quantity: '1', price: lot.sellingPrice != null ? (lot.sellingPrice / 100).toFixed(2) : '',
    }]);
  };
  const updateLine = (i: number, field: keyof FormLine, value: string) => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  const removeLine = (i: number) => setLines(ls => ls.filter((_, idx) => idx !== i));

  const formTotal = lines.reduce((sum, l) => {
    const p = parseFloat(l.price) || 0; const q = parseInt(l.quantity) || 0;
    return sum + Math.round(p * 100) * q;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const valid = lines.filter(l => l.designation.trim());
    if (valid.length === 0) { addToast('Au moins une ligne avec désignation est requise', 'error'); return; }
    setSubmitting(true);
    try {
      const payload = {
        docType,
        date: form.date,
        clientName: form.clientName.trim() || undefined,
        clientAddress: form.clientAddress.trim() || undefined,
        clientIce: form.clientIce.trim() || undefined,
        clientPhone: form.clientPhone.trim() || undefined,
        status: form.status,
        paymentType: docType === 'facture' || docType === 'ticket' ? form.paymentType : undefined,
        validUntil: docType === 'devis' && form.validUntil ? form.validUntil : undefined,
        observation: form.observation.trim() || undefined,
        lines: valid.map(l => ({
          lotId: l.lotId,
          designation: l.designation.trim(),
          barcode: l.barcode,
          quantity: parsePositiveInt(l.quantity, 'Quantité'),
          sellingUnitPrice: l.price ? parseCents(l.price, 'Prix unitaire') : 0,
        })),
      };
      if (editingId) await window.api.documents.update({ id: editingId, ...payload });
      else await window.api.documents.create(payload);
      closeForm();
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally { setSubmitting(false); }
  };

  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const withBusy = async (id: string, fn: () => Promise<void>) => {
    if (busyIds.has(id)) return;
    setBusyIds(p => new Set(p).add(id));
    try { await fn(); } finally { setBusyIds(p => { const n = new Set(p); n.delete(id); return n; }); }
  };

  const handleDelete = (id: string) => withBusy(id, async () => {
    if (!await confirm('Supprimer ce document ?')) return;
    try { await window.api.documents.delete(id); load(); }
    catch (err) { addToast((err as Error).message || 'Erreur lors de la suppression', 'error'); }
  });
  const handleStatus = async (id: string, status: string) => {
    try { await window.api.documents.updateStatus({ id, status }); load(); }
    catch (err) { addToast((err as Error).message || 'Erreur', 'error'); }
  };
  const handleExport = (id: string) => withBusy(id, async () => {
    try {
      const r = await window.api.documents.exportPdf({ id, target: docType === 'ticket' ? 'thermal' : 'a4' }) as { saved?: boolean; canceled?: boolean };
      if (r?.saved) addToast('PDF enregistré', 'success');
    } catch (err) { addToast((err as Error).message || "Erreur lors de l'export PDF", 'error'); }
  });
  const handlePrint = (id: string) => withBusy(id, async () => {
    try { await window.api.documents.print({ id, target: docType === 'ticket' ? 'thermal' : 'a4' }); }
    catch (err) { addToast((err as Error).message || "Erreur lors de l'impression", 'error'); }
  });

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Documents</h2>
        <span className="subtitle">Factures, devis, bons de livraison et tickets</span>
        <div className="header-accent" />
      </div>

      <div className="sale-toggle" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {DOC_TABS.map(t => (
          <button key={t.type} type="button" className={docType === t.type ? 'active' : ''}
            onClick={() => { setDocType(t.type); setPage(1); setSearch(''); }}>{t.label}</button>
        ))}
      </div>

      <div className="page-toolbar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <span className="badge">{total} {DOC_SINGULAR[docType].toLowerCase()}(s)</span>
        <div className="toolbar-spacer" />
        {docType !== 'devis' && (
          <button className="btn btn-secondary" onClick={() => setShowFromSale(true)}>Depuis une vente</button>
        )}
        <button className="btn btn-primary" onClick={openCreate}>+ {DOC_SINGULAR[docType]}</button>
      </div>

      <div className="card-table">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Réf</th>
                <th>Date</th>
                <th>Client</th>
                <th className="text-right">Total</th>
                <th>Statut</th>
                <th style={{ width: 150 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-title">Aucun document</div>
                    <div className="empty-desc">Créez un {DOC_SINGULAR[docType].toLowerCase()} pour commencer.</div>
                  </div>
                </td></tr>
              )}
              {items.map(d => {
                const si = statusInfo(docType, d.status);
                return (
                  <tr key={d.id}>
                    <td className="col-mono col-bold">{d.ref_number}</td>
                    <td className="col-mono">{d.date}</td>
                    <td className="text-muted">{d.client_name || '—'}</td>
                    <td className="text-right col-mono col-bold">{fm(d.total)}</td>
                    <td>
                      <select className={`status-badge ${si.cls}`} style={{ border: 'none', cursor: 'pointer' }}
                        value={d.status} onChange={e => handleStatus(d.id, e.target.value)}>
                        {STATUS_OPTIONS[docType].map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="text-center">
                      <div className="row-actions">
                        <button className="btn-icon" title="Imprimer" disabled={busyIds.has(d.id)} onClick={() => handlePrint(d.id)}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                        </button>
                        <button className="btn-icon" title="Exporter en PDF" disabled={busyIds.has(d.id)} onClick={() => handleExport(d.id)}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 18 15 15" /></svg>
                        </button>
                        <button className="btn-icon" title="Modifier" onClick={() => openEdit(d.id)}>{EditIcon}</button>
                        <button className="btn-icon btn-icon-danger" title="Supprimer" disabled={busyIds.has(d.id)} onClick={() => handleDelete(d.id)}>{TrashIcon}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination total={total} page={page} onPageChange={setPage} />
        </div>
      </div>

      {/* Create / edit modal */}
      <Modal open={showForm} onClose={closeForm} title={`${editingId ? 'Modifier' : 'Nouveau'} ${DOC_SINGULAR[docType].toLowerCase()}`} width="820px">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label>Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
            <div className="form-group" style={{ flex: 2 }}><label>Client</label><input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} placeholder="Nom du client" /></div>
            <div className="form-group"><label>Téléphone</label><input value={form.clientPhone} onChange={e => setForm({ ...form, clientPhone: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}><label>Adresse client</label><input value={form.clientAddress} onChange={e => setForm({ ...form, clientAddress: e.target.value })} placeholder="Optionnel" /></div>
            <div className="form-group"><label>ICE client</label><input value={form.clientIce} onChange={e => setForm({ ...form, clientIce: e.target.value })} placeholder="Optionnel" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Statut</label>
              <select className="toolbar-filter" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTIONS[docType].map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {(docType === 'facture' || docType === 'ticket') && (
              <div className="form-group"><label>Paiement</label>
                <select className="toolbar-filter" value={form.paymentType} onChange={e => setForm({ ...form, paymentType: e.target.value })}>
                  <option value="comptant">Comptant</option>
                  <option value="credit">Crédit</option>
                </select>
              </div>
            )}
            {docType === 'devis' && (
              <div className="form-group"><label>Valable jusqu'au</label><input type="date" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} /></div>
            )}
            <div className="form-group" style={{ flex: 2 }}><label>Observation</label><input value={form.observation} onChange={e => setForm({ ...form, observation: e.target.value })} placeholder="Optionnel" /></div>
          </div>

          <div className="sale-lines-header">
            <span className="sale-lines-title">Articles</span>
            <div className="toolbar-spacer" />
            <div style={{ minWidth: 240 }}>
              <SearchableSelect value="" onChange={(v) => v && addStockLine(v)} placeholder="+ Article du stock…"
                options={stock.map(s => ({ value: s.lotId, label: `${s.designation} ${s.category}${s.barcode ? ` ${s.barcode}` : ''}`, display: { main: s.designation, sub: [s.category, s.barcode].filter(Boolean).join(' · '), meta: [{ label: 'Dispo', value: String(s.remainingQuantity), tone: (s.remainingQuantity > 0 ? 'success' : 'danger') as 'success' | 'danger' }] } }))} />
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addBlankLine}>+ Ligne libre</button>
          </div>

          {lines.map((line, i) => (
            <div className="form-row" key={i} style={{ alignItems: 'flex-end', marginBottom: 6 }}>
              <div className="form-group" style={{ flex: 3 }}>
                {i === 0 && <label>Désignation</label>}
                <input value={line.designation} onChange={e => updateLine(i, 'designation', e.target.value)} placeholder="Désignation" required />
              </div>
              <div className="form-group" style={{ width: 80 }}>
                {i === 0 && <label>Qté</label>}
                <input type="number" min="1" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} required />
              </div>
              {SHOW_PRICE[docType] && (
                <div className="form-group" style={{ width: 130 }}>
                  {i === 0 && <label>P.U. (DH)</label>}
                  <input type="number" step="0.01" min="0" value={line.price} onChange={e => updateLine(i, 'price', e.target.value)} />
                </div>
              )}
              <div className="form-group" style={{ flex: 'none' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeLine(i)}>{CancelIcon}</button>
              </div>
            </div>
          ))}
          {lines.length === 0 && <p className="text-muted" style={{ fontSize: 13, padding: '4px 0' }}>Ajoutez un article du stock ou une ligne libre.</p>}

          {SHOW_PRICE[docType] && formTotal > 0 && (
            <div className="sale-summary"><span>Total: {fm(formTotal)}</span></div>
          )}

          <div className="form-actions">
            <div className="toolbar-spacer" />
            <button type="button" className="btn btn-cancel" onClick={closeForm}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'En cours…' : editingId ? 'Modifier' : 'Créer'}</button>
          </div>
        </form>
      </Modal>

      <FromSaleModal open={showFromSale} docType={docType} onClose={() => setShowFromSale(false)} onDone={() => { setShowFromSale(false); load(); }} />
    </div>
  );
}

function FromSaleModal({ open, docType, onClose, onDone }: { open: boolean; docType: DocType; onClose: () => void; onDone: () => void }): React.JSX.Element {
  const { addToast } = useToast();
  const [sales, setSales] = useState<Array<{ id: string; ref_number: string; date: string; client_name: string | null; totalAmount: number }>>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    window.api.sales.list({ search: search || undefined, page: 1, limit: 30 })
      .then((r: unknown) => setSales((r as { items: typeof sales }).items || []))
      .catch(() => addToast('Erreur lors du chargement des ventes', 'error'));
  }, [open, search]);

  const generate = async (saleOrderId: string) => {
    if (busy) return;
    setBusy(saleOrderId);
    try {
      await window.api.documents.fromSale({ saleOrderId, docType });
      addToast(`${DOC_SINGULAR[docType]} créé(e) depuis la vente`, 'success');
      onDone();
    } catch (err) { addToast((err as Error).message || 'Erreur', 'error'); }
    finally { setBusy(null); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Générer ${DOC_SINGULAR[docType].toLowerCase()} depuis une vente`} width="680px">
      <div className="search-input-wrap" style={{ marginBottom: 12 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input type="text" placeholder="Rechercher une vente…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Réf</th><th>Date</th><th>Client</th><th className="text-right">Montant</th><th></th></tr></thead>
          <tbody>
            {sales.length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-title">Aucune vente</div></div></td></tr>}
            {sales.map(s => (
              <tr key={s.id}>
                <td className="col-mono col-bold">{s.ref_number}</td>
                <td className="col-mono">{s.date}</td>
                <td className="text-muted">{s.client_name || '—'}</td>
                <td className="text-right col-mono">{fm(s.totalAmount)}</td>
                <td className="text-right"><button className="btn btn-primary btn-sm" disabled={busy === s.id} onClick={() => generate(s.id)}>{busy === s.id ? '…' : 'Générer'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
