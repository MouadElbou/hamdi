'use client';

import React, { useEffect, useState } from 'react';
import { adminGet, adminPost, adminPut, adminDelete } from '@/lib/admin-api';
import { Modal } from '../components/Modal';
import Pagination, { PAGE_SIZE } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

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

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

/* ── Types ── */
interface Job { id: string; date: string; description: string; customer_note: string | null; amount: number; cost_adjustment: number }
interface Tariff { id: string; label: string; particuliers_price: number | null; rev_price: number | null }

export default function BatteryRepairPage(): React.JSX.Element {
  const [confirm, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: todayLocal(), description: '', customerNote: '', amount: '', costAdjustment: '' });

  /* ── Tariff state (read + inline edit only, no add/delete) ── */
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);
  const [tariffForm, setTariffForm] = useState({ label: '', particuliers: '', rev: '' });

  const resetForm = () => setForm({ date: todayLocal(), description: '', customerNote: '', amount: '', costAdjustment: '' });
  const openCreate = () => { resetForm(); setEditingId(null); setShowForm(true); };
  const openEdit = (j: Job) => {
    setForm({ date: j.date, description: j.description, customerNote: j.customer_note || '', amount: String(j.amount / 100), costAdjustment: j.cost_adjustment ? String(j.cost_adjustment / 100) : '' });
    setEditingId(j.id); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); resetForm(); };

  /* ── Load tariffs ── */
  const loadTariffs = () => {
    adminGet<Tariff[]>('/battery-repair/tariffs').then(setTariffs).catch(() => {});
  };
  useEffect(() => { loadTariffs(); }, []);

  /* ── Load jobs ── */
  const load = async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const data = await adminGet<{ items: Job[]; total: number }>(`/battery-repair?${params.toString()}`);
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

  useEffect(() => { load(); }, [debouncedSearch, page]);

  /* ── Submit job ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.description || !form.amount) { addToast('Veuillez remplir la description et le montant', 'error'); return; }
    setSubmitting(true);
    try {
      const payload = {
        date: form.date, description: form.description, customerNote: form.customerNote || undefined,
        amount: parseCents(form.amount, 'Montant'), costAdjustment: form.costAdjustment ? parseCents(form.costAdjustment, 'Ajustement coût') : 0,
      };
      if (editingId) {
        await adminPut('/battery-repair/' + editingId, payload);
      } else {
        await adminPost('/battery-repair', payload);
      }
      closeForm();
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete job ── */
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async (id: string) => {
    if (deleting) return;
    if (!await confirm('Supprimer cette reparation ?')) return;
    setDeleting(true);
    try {
      await adminDelete('/battery-repair/' + id);
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const total = jobs.reduce((s, j) => s + j.amount, 0);

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Réparation Batteries</h2>
        <div className="subtitle">Service de réparation et maintenance de batteries</div>
        <div className="header-accent" />
      </div>

      {/* ── Tariff grid (inline edit only, no add/delete) ── */}
      {tariffs.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Grille tarifaire</div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Service</th><th className="text-right">Particulier</th><th className="text-right">Revendeur</th><th style={{ width: 80 }}></th></tr>
              </thead>
              <tbody>
                {tariffs.map(t => (
                  editingTariffId === t.id ? (
                    <tr key={t.id}>
                      <td><input type="text" value={tariffForm.label} onChange={e => setTariffForm({ ...tariffForm, label: e.target.value })} style={{ width: '100%' }} /></td>
                      <td><input type="number" step="0.01" value={tariffForm.particuliers} onChange={e => setTariffForm({ ...tariffForm, particuliers: e.target.value })} placeholder="Sur devis" style={{ width: 100, textAlign: 'right' }} /></td>
                      <td><input type="number" step="0.01" value={tariffForm.rev} onChange={e => setTariffForm({ ...tariffForm, rev: e.target.value })} placeholder="Sur devis" style={{ width: 100, textAlign: 'right' }} /></td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-icon" title="Sauvegarder" onClick={async () => {
                            try {
                              await adminPut('/battery-repair/tariffs/' + t.id, { label: tariffForm.label, particuliersPrice: tariffForm.particuliers !== '' ? parseCents(tariffForm.particuliers, 'Prix particuliers') : null, revPrice: tariffForm.rev !== '' ? parseCents(tariffForm.rev, 'Prix revendeur') : null });
                              setEditingTariffId(null); loadTariffs();
                            } catch (err) { addToast((err as Error).message || 'Erreur lors de la mise à jour du tarif', 'error'); }
                          }}>✓</button>
                          <button className="btn-icon" title="Annuler" onClick={() => { setEditingTariffId(null); setTariffForm({ label: '', particuliers: '', rev: '' }); }}>{CancelIcon}</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.id}>
                      <td className="col-bold">{t.label}</td>
                      <td className="text-right col-mono">{t.particuliers_price != null ? fm(t.particuliers_price) : 'Sur devis'}</td>
                      <td className="text-right col-mono">{t.rev_price != null ? fm(t.rev_price) : 'Sur devis'}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-icon" title="Modifier" onClick={() => {
                            setTariffForm({ label: t.label, particuliers: t.particuliers_price != null ? String(t.particuliers_price / 100) : '', rev: t.rev_price != null ? String(t.rev_price / 100) : '' });
                            setEditingTariffId(t.id);
                          }}>{EditIcon}</button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="page-toolbar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Nouvelle reparation
        </button>
        <div className="toolbar-spacer" />
        <span className="badge">{totalJobs} interventions</span>
        <span className="badge">Total: {fm(total)}</span>
      </div>

      {/* ── Modal form ── */}
      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Modifier intervention' : 'Nouvelle intervention'}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Description</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Type de reparation" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Montant</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Cout / Ajustement</label>
              <input type="number" step="0.01" value={form.costAdjustment} onChange={e => setForm({ ...form, costAdjustment: e.target.value })} placeholder="0" />
            </div>
            <div className="form-group">
              <label>Note client</label>
              <input type="text" value={form.customerNote} onChange={e => setForm({ ...form, customerNote: e.target.value })} placeholder="Optionnel" />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-cancel" onClick={closeForm}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'En cours...' : editingId ? 'Modifier' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Jobs table ── */}
      <div className="card-table">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th><th>Description</th><th>Note</th>
                <th className="text-right">Montant</th><th className="text-right">Cout</th><th className="text-right">Profit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a4 4 0 0 0-8 0v2" /><line x1="12" y1="11" x2="12" y2="15" /></svg>
                    </div>
                    <div className="empty-title">Aucune réparation</div>
                    <div className="empty-desc">Les interventions de réparation de batteries apparaîtront ici.</div>
                  </div>
                </td></tr>
              )}
              {jobs.map(j => (
                <tr key={j.id}>
                  <td className="col-mono">{j.date}</td>
                  <td className="col-bold">{j.description}</td>
                  <td className="text-muted">{j.customer_note || '—'}</td>
                  <td className="text-right col-mono">{fm(j.amount)}</td>
                  <td className="text-right col-mono">{j.cost_adjustment ? fm(j.cost_adjustment) : '—'}</td>
                  <td className="text-right col-mono col-bold">{fm(j.amount - (j.cost_adjustment || 0))}</td>
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
