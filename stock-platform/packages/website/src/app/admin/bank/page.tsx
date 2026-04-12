'use client';

import React, { useEffect, useState } from 'react';
import { adminGet, adminPost, adminPut, adminDelete } from '@/lib/admin-api';
import { Modal } from '../components/Modal';
import Pagination, { PAGE_SIZE } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

/* ── Inline SVG icons ── */
const EditIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
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
  if (Number.isNaN(n) || n < 0) throw new Error(`${label}: valeur numérique invalide`);
  return Math.round(n * 100);
}

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

/* ── Types ── */
interface BankMovement {
  id: string;
  date: string;
  description: string;
  amount_in: number;
  amount_out: number;
}

interface BankSummary {
  totalIn: number;
  totalOut: number;
  balanceDelta: number;
}

/* ── Page ── */
export default function BankPage(): React.JSX.Element {
  const [items, setItems] = useState<BankMovement[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [summary, setSummary] = useState<BankSummary | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: todayLocal(), description: '', amountIn: '', amountOut: '' });
  const [confirm, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => setForm({ date: todayLocal(), description: '', amountIn: '', amountOut: '' });
  const openCreate = () => { resetForm(); setEditingId(null); setShowForm(true); };
  const openEdit = (m: BankMovement) => {
    setForm({
      date: m.date,
      description: m.description,
      amountIn: m.amount_in ? String(m.amount_in / 100) : '',
      amountOut: m.amount_out ? String(m.amount_out / 100) : '',
    });
    setEditingId(m.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); resetForm(); };

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    adminGet<{ items: BankMovement[]; total: number }>('/bank-movements?' + params.toString())
      .then((data) => {
        setItems(data.items || []);
        setTotalItems(data.total || 0);
      })
      .catch(() => addToast('Erreur lors du chargement', 'error'));
    adminGet<BankSummary>('/bank-movements/summary')
      .then((data) => setSummary(data))
      .catch(() => addToast('Erreur lors du chargement du résumé', 'error'));
  };

  useEffect(() => { load(); }, [search, page]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.description || (!form.amountIn && !form.amountOut)) {
      addToast('Veuillez remplir la description et au moins un montant', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        date: form.date,
        description: form.description,
        amountIn: form.amountIn ? parseCents(form.amountIn, 'Entrée') : 0,
        amountOut: form.amountOut ? parseCents(form.amountOut, 'Sortie') : 0,
      };
      if (editingId) {
        await adminPut('/bank-movements/' + editingId, payload);
      } else {
        await adminPost('/bank-movements', payload);
      }
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
    if (!await confirm('Supprimer ce mouvement ?')) return;
    setDeleting(true);
    try {
      await adminDelete('/bank-movements/' + id);
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Banque</h2>
        <span className="subtitle">Mouvements bancaires — entrees et sorties</span>
        <div className="header-accent" />
      </div>

      <div className="page-toolbar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <span className="badge">{totalItems} mouvements</span>
        {summary && (
          <>
            <span className="badge" style={{ color: 'var(--success)' }}>Entrees: {fm(summary.totalIn)}</span>
            <span className="badge" style={{ color: 'var(--danger)' }}>Sorties: {fm(summary.totalOut)}</span>
            <span className="badge" style={{ color: summary.balanceDelta >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              Solde: {fm(summary.balanceDelta)}
            </span>
          </>
        )}
        <div className="toolbar-spacer" />
        <button className="btn btn-primary" onClick={openCreate}>
          + Nouveau mouvement
        </button>
      </div>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Modifier mouvement' : 'Nouveau mouvement'}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Description</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Entree</label>
              <input type="number" step="0.01" min="0" value={form.amountIn} onChange={e => setForm({ ...form, amountIn: e.target.value })} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Sortie</label>
              <input type="number" step="0.01" min="0" value={form.amountOut} onChange={e => setForm({ ...form, amountOut: e.target.value })} placeholder="0.00" />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-cancel" onClick={closeForm}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'En cours...' : editingId ? 'Modifier' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>

      <div className="card-table">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th className="text-right">Entree</th>
                <th className="text-right">Sortie</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                    </div>
                    <div className="empty-title">Aucun mouvement</div>
                    <div className="empty-desc">Enregistrez vos operations bancaires ici.</div>
                  </div>
                </td></tr>
              )}
              {items.map(m => (
                <tr key={m.id}>
                  <td className="col-mono">{m.date}</td>
                  <td className="col-bold">{m.description}</td>
                  <td className="text-right col-mono">{m.amount_in > 0 ? <span className="text-success">{fm(m.amount_in)}</span> : '—'}</td>
                  <td className="text-right col-mono">{m.amount_out > 0 ? <span className="text-danger">{fm(m.amount_out)}</span> : '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-icon" title="Modifier" onClick={() => openEdit(m)}>{EditIcon}</button>
                      <button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDelete(m.id)}>{TrashIcon}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination total={totalItems} page={page} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
