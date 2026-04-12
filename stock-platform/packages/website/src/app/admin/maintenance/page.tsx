'use client';

import React, { useEffect, useState } from 'react';
import { adminGet, adminPost, adminPut, adminDelete } from '@/lib/admin-api';
import { Modal } from '../components/Modal';
import Pagination, { PAGE_SIZE } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { SearchableSelect } from '../components/SearchableSelect';

/* ── Inline SVG icons ── */
const EditIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

/* ── Types ── */
interface MaintenanceJob {
  id: string; date: string; designation: string; price: number; boutique_name: string;
}

export default function MaintenancePage(): React.JSX.Element {
  /* ── Reference data ── */
  const [boutiques, setBoutiques] = useState<Array<{ name: string }>>([]);
  useEffect(() => {
    adminGet<Array<{ name: string }>>('/reference/boutiques').then(setBoutiques).catch(() => {});
  }, []);

  /* ── Page state ── */
  const [jobs, setJobs] = useState<MaintenanceJob[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: todayLocal(), designation: '' as string, price: '', boutique: '' });
  const [confirm, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => setForm({ date: todayLocal(), designation: '', price: '', boutique: '' });
  const openCreate = () => { resetForm(); setEditingId(null); setShowForm(true); };
  const openEdit = (j: MaintenanceJob) => {
    setForm({ date: j.date, designation: j.designation, price: String(j.price / 100), boutique: j.boutique_name });
    setEditingId(j.id); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); resetForm(); };

  /* ── Load data ── */
  const load = async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const data = await adminGet<{ items: MaintenanceJob[]; total: number }>(`/maintenance?${params.toString()}`);
      setJobs(data.items || []);
      setTotalJobs(data.total || 0);
    } catch {
      addToast('Erreur lors du chargement', 'error');
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    load();
  }, [debouncedSearch, page]);

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.price || !form.boutique) { addToast('Veuillez remplir le prix et la boutique', 'error'); return; }
    setSubmitting(true);
    try {
      const payload = {
        date: form.date,
        designation: form.designation,
        price: parseCents(form.price, 'Prix'),
        boutique: form.boutique,
      };
      if (editingId) {
        await adminPut('/maintenance/' + editingId, payload);
      } else {
        await adminPost('/maintenance', payload);
      }
      closeForm();
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete ── */
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async (id: string) => {
    if (deleting) return;
    if (!await confirm('Supprimer cette intervention ?')) return;
    setDeleting(true);
    try {
      await adminDelete('/maintenance/' + id);
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const total = jobs.reduce((s, j) => s + j.price, 0);

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Maintenance</h2>
        <span className="subtitle">Revenus de service — installation, reparation, etc.</span>
        <div className="header-accent" />
      </div>

      <div className="page-toolbar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <span className="badge">{totalJobs} interventions</span>
        <span className="badge">Total: {fm(total)}</span>
        <div className="toolbar-spacer" />
        <button className="btn btn-primary" onClick={openCreate}>
          + Nouvelle intervention
        </button>
      </div>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Modifier intervention' : 'Nouvelle intervention'}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Type de service</label>
              <SearchableSelect
                options={[]}
                value={form.designation}
                onChange={v => setForm({ ...form, designation: v })}
                placeholder="Choisir ou ajouter"
                required
                creatable
                onCreate={async () => {}}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Prix</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Boutique</label>
              <SearchableSelect
                options={boutiques.map(b => ({ value: b.name, label: b.name }))}
                value={form.boutique}
                onChange={v => setForm({ ...form, boutique: v })}
                placeholder="Choisir ou ajouter"
                required
                creatable
                onCreate={async (name) => { setBoutiques(prev => [...prev, { name }]); }}
              />
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
                <th>Designation</th>
                <th>Boutique</th>
                <th className="text-right">Prix</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                    </div>
                    <div className="empty-title">Aucune intervention</div>
                    <div className="empty-desc">Enregistrez une intervention de maintenance pour commencer.</div>
                  </div>
                </td></tr>
              )}
              {jobs.map(j => (
                <tr key={j.id}>
                  <td className="col-mono">{j.date}</td>
                  <td className="col-bold">{j.designation}</td>
                  <td>{j.boutique_name}</td>
                  <td className="text-right col-mono col-bold">{fm(j.price)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-icon" title="Modifier" onClick={() => openEdit(j)}>{EditIcon}</button>
                      <button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDelete(j.id)}>{TrashIcon}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination total={totalJobs} page={page} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
