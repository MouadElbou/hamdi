import React, { useEffect, useState } from 'react';
import { Modal } from '../components/Modal.js';
import { EditIcon, TrashIcon } from '../components/Icons.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';
import Pagination, { PAGE_SIZE } from '../components/Pagination.js';
import { SearchableSelect } from '../components/SearchableSelect.js';
import { useReferenceData } from '../components/ReferenceDataContext.js';
import { parseCents, todayLocal } from '../utils.js';

interface MaintenanceJob {
  id: string; date: string; designation: string; price: number; boutique_name: string;
}

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

export function MaintenancePage(): React.JSX.Element {
  const { maintenanceTypes, boutiques, addMaintenanceType, addBoutique } = useReferenceData();
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

  const load = () => {
    window.api.maintenance.list({ search: debouncedSearch || undefined, page, limit: PAGE_SIZE }).then((r: unknown) => {
      const data = r as { items: MaintenanceJob[]; total: number };
      setJobs(data.items || []);
      setTotalJobs(data.total || 0);
    }).catch(() => addToast('Erreur lors du chargement', 'error'));
  };
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    load();
  }, [debouncedSearch, page]);

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
      await window.api.maintenance.update({ id: editingId, ...payload });
    } else {
      await window.api.maintenance.create(payload);
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
    if (!await confirm('Supprimer cette intervention ?')) return;
    setDeleting(true);
    try {
      await window.api.maintenance.delete(id);
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
                options={maintenanceTypes.map(t => ({ value: t.name, label: t.name }))}
                value={form.designation}
                onChange={v => setForm({ ...form, designation: v })}
                placeholder="Choisir ou ajouter"
                required
                creatable
                onCreate={async (name) => { await addMaintenanceType(name); }}
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
                onCreate={async (name) => { await addBoutique(name); }}
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
