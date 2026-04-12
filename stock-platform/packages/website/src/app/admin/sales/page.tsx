'use client';

import React, { useEffect, useRef, useState } from 'react';
import { adminGet, adminPost, adminDelete } from '@/lib/admin-api';
import { Modal } from '../components/Modal';
import Pagination, { PAGE_SIZE } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { SearchableSelect } from '../components/SearchableSelect';

/* ── Inline SVG icons ── */
const TrashIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const CancelIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ── Inline helpers ── */
function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseCents(value: string, label: string): number {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n) || n < 0) throw new Error(`${label} invalide`);
  return Math.round(n * 100);
}

function parsePositiveInt(value: string, label: string): number {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) throw new Error(`${label} doit être un entier positif`);
  return n;
}

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

/* ── Types ── */
interface StockItem {
  lotId: string; refNumber: string; designation: string; category: string;
  remainingQuantity: number; purchaseUnitCost: number;
}
interface SaleLine { lotId: string; quantity: string; sellingUnitPrice: string; }
interface SaleOrder {
  id: string; ref_number: string; date: string; observation: string | null;
  client_name: string | null;
  totalAmount: number; totalMargin: number;
  lines: Array<{ lot_id: string; designation: string; category: string; quantity: number; selling_unit_price: number; purchase_unit_cost: number }>;
}

export default function SalesPage(): React.JSX.Element {
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(todayLocal());
  const [observation, setObservation] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<Array<{ id: string; name: string }>>([]);
  const clientSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lines, setLines] = useState<SaleLine[]>([{ lotId: '', quantity: '', sellingUnitPrice: '' }]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirm, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    adminGet<{ items: SaleOrder[]; total: number }>('/sales?' + params.toString())
      .then((data) => {
        setOrders(data.items || []);
        setTotalOrders(data.total || 0);
      })
      .catch(() => addToast('Erreur lors du chargement des ventes', 'error'));
    adminGet<{ items: StockItem[] }>('/stock?inStockOnly=true&limit=10000')
      .then((data) => {
        setStock(data.items || []);
      })
      .catch(() => addToast('Erreur lors du chargement du stock', 'error'));
  };
  useEffect(load, [search, page]);

  const resetForm = () => {
    setDate(todayLocal());
    setObservation('');
    setClientName('');
    setClientSuggestions([]);
    setLines([{ lotId: '', quantity: '', sellingUnitPrice: '' }]);
  };

  const openCreate = () => { resetForm(); setShowForm(true); };
  const closeForm = () => { setShowForm(false); resetForm(); };

  const addLine = () => setLines([...lines, { lotId: '', quantity: '', sellingUnitPrice: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof SaleLine, value: string) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value } as SaleLine;
    setLines(updated);
  };

  const lineMargin = (line: SaleLine): number | null => {
    const lot = stock.find(s => s.lotId === line.lotId);
    if (!lot || !line.quantity || !line.sellingUnitPrice) return null;
    const sellCents = Math.round(parseFloat(line.sellingUnitPrice) * 100);
    return (sellCents - lot.purchaseUnitCost) * parseInt(line.quantity);
  };

  const totalFormMargin = (): number | null => {
    const margins = lines.map(lineMargin).filter((m): m is number => m !== null);
    return margins.length > 0 ? margins.reduce((a, b) => a + b, 0) : null;
  };

  const hasNegativeMargin = lines.some(l => {
    const m = lineMargin(l);
    return m !== null && m < 0;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const validLines = lines.filter(l => l.lotId && l.quantity && l.sellingUnitPrice);
    if (validLines.length === 0) return;

    if (hasNegativeMargin) {
      const ok = await confirm('Attention: une ou plusieurs lignes ont une marge negative (vente en dessous du prix d\'achat). Continuer ?');
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const payload = {
        date,
        observation: observation || undefined,
        clientName: clientName.trim() || undefined,
        lines: validLines.map(l => ({
          lotId: l.lotId,
          quantity: parsePositiveInt(l.quantity, 'Quantité'),
          sellingUnitPrice: parseCents(l.sellingUnitPrice, 'Prix de vente'),
        })),
      };

      await adminPost('/sales', payload);
      closeForm();
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const [deleting, setDeleting] = useState(false);
  const handleDelete = async (id: string) => {
    if (deleting) return;
    const ok = await confirm('Supprimer cette vente ? Cette action est irreversible.');
    if (!ok) return;
    setDeleting(true);
    try {
      await adminDelete('/sales/' + id);
      load();
    } catch {
      addToast('Erreur lors de la suppression', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Ventes</h2>
        <span className="subtitle">Enregistrer et consulter les ventes liees aux lots</span>
        <div className="header-accent" />
      </div>

      <div className="page-toolbar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <span className="badge">{totalOrders} ventes</span>
        <div className="toolbar-spacer" />
        <button className="btn btn-primary" onClick={openCreate}>
          + Nouvelle vente
        </button>
      </div>

      <Modal open={showForm} onClose={closeForm} title="Nouvelle vente" width="720px">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Observation</label>
              <input type="text" value={observation} onChange={e => setObservation(e.target.value)} placeholder="Optionnel" />
            </div>
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Client (optionnel)</label>
              <input type="text" value={clientName} onChange={e => {
                const v = e.target.value;
                setClientName(v);
                if (clientSearchTimer.current) clearTimeout(clientSearchTimer.current);
                if (v.length >= 2) {
                  clientSearchTimer.current = setTimeout(() => {
                    adminGet<Array<{ id: string; name: string }>>('/clients?search=' + encodeURIComponent(v))
                      .then(r => setClientSuggestions(r))
                      .catch(err => console.error('[Load]', err));
                  }, 300);
                } else {
                  setClientSuggestions([]);
                }
              }} placeholder="Nom du client" />
              {clientSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', zIndex: 10, maxHeight: 150, overflowY: 'auto' }}>
                  {clientSuggestions.map(c => (
                    <div key={c.id} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13 }} onClick={() => { setClientName(c.name); setClientSuggestions([]); }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 12, marginBottom: 8, color: 'var(--text-primary)' }}>Lignes de vente</div>
          {lines.map((line, i) => {
            const selectedLot = stock.find(s => s.lotId === line.lotId);
            const margin = lineMargin(line);
            return (
              <div key={i}>
                <div className="form-row" style={{ alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 3 }}>
                    <label>Lot</label>
                    <SearchableSelect
                      value={line.lotId}
                      onChange={val => updateLine(i, 'lotId', val)}
                      placeholder="-- Rechercher un lot --"
                      required
                      options={stock.map(s => ({
                        value: s.lotId,
                        label: `${s.designation} (${s.category}) — dispo: ${s.remainingQuantity} — PA: ${(s.purchaseUnitCost / 100).toFixed(2)}`,
                      }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Qte{selectedLot ? ` (max ${selectedLot.remainingQuantity})` : ''}</label>
                    <input type="number" min="1" max={selectedLot?.remainingQuantity} value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Prix vente unitaire</label>
                    <input type="number" step="0.01" min="0" value={line.sellingUnitPrice} onChange={e => updateLine(i, 'sellingUnitPrice', e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ flex: 'none' }}>
                    {lines.length > 1 && (
                      <button type="button" className="btn btn-secondary" onClick={() => removeLine(i)} style={{ padding: '6px 10px' }}>{CancelIcon}</button>
                    )}
                  </div>
                </div>
                {margin !== null && (
                  <div style={{
                    fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: -6, marginBottom: 8, paddingLeft: 4,
                    color: margin >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {margin < 0 ? '⚠ ' : ''}Marge: {fm(margin)}
                    {selectedLot && <span style={{ color: 'var(--text-muted)', marginLeft: 12 }}>PA: {fm(selectedLot.purchaseUnitCost)}</span>}
                  </div>
                )}
              </div>
            );
          })}

          {totalFormMargin() !== null && (
            <div style={{
              fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600,
              padding: '8px 12px', marginBottom: 8, borderRadius: 'var(--radius-sm)',
              background: totalFormMargin()! >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              color: totalFormMargin()! >= 0 ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${totalFormMargin()! >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              Marge totale estimee: {fm(totalFormMargin()!)}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>+ Ajouter ligne</button>
            <div className="toolbar-spacer" />
            <button type="button" className="btn btn-cancel" onClick={closeForm}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'En cours...' : 'Enregistrer la vente'}</button>
          </div>
        </form>
      </Modal>

      <div className="card-table">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Date</th>
                <th>Client</th>
                <th>Observation</th>
                <th className="text-right">Montant</th>
                <th className="text-right">Marge</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
                    </div>
                    <div className="empty-title">Aucune vente enregistree</div>
                    <div className="empty-desc">Creez une vente pour commencer.</div>
                  </div>
                </td></tr>
              )}
              {orders.map(o => (
                <React.Fragment key={o.id}>
                  <tr>
                    <td className="col-mono col-bold">{o.ref_number}</td>
                    <td className="col-mono">{o.date}</td>
                    <td className="text-muted">{o.client_name || '—'}</td>
                    <td className="text-muted">{o.observation || '—'}</td>
                    <td className="text-right col-mono col-bold">{fm(o.totalAmount)}</td>
                    <td className={`text-right col-mono col-bold ${o.totalMargin >= 0 ? 'text-success' : 'text-danger'}`}>{fm(o.totalMargin)}</td>
                    <td className="text-center">
                      <div className="row-actions">
                        <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(o.id)} title="Supprimer">{TrashIcon}</button>
                      </div>
                    </td>
                  </tr>
                  {o.lines.map((l, i) => (
                    <tr key={i} className="row-detail">
                      <td></td>
                      <td className="text-muted">{l.category}</td>
                      <td colSpan={2}>{l.designation}</td>
                      <td className="text-right col-mono">{l.quantity} x {fm(l.selling_unit_price)}</td>
                      <td className={`text-right col-mono ${(l.selling_unit_price - l.purchase_unit_cost) >= 0 ? 'text-success' : 'text-danger'}`}>{fm((l.selling_unit_price - l.purchase_unit_cost) * l.quantity)}</td>
                      <td></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <Pagination total={totalOrders} page={page} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
