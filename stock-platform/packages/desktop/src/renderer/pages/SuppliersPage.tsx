import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../components/Modal.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';

interface Supplier {
  id: string;
  code: string;
  created_at: string;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

export function SuppliersPage(): React.JSX.Element {
  const { addToast } = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [items, setItems] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [formCode, setFormCode] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.suppliers.list() as Supplier[];
      setItems(data);
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setFormCode('');
    setShowModal(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setFormCode(s.code);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const trimmed = formCode.trim();
    if (!trimmed) {
      addToast('Le code fournisseur est requis', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await window.api.suppliers.update({ id: editing.id, code: trimmed });
        addToast('Fournisseur mis à jour', 'success');
      } else {
        await window.api.suppliers.create({ code: trimmed });
        addToast('Fournisseur créé', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!await confirm(`Supprimer le fournisseur « ${s.code} » ?`)) return;
    try {
      await window.api.suppliers.delete(s.id);
      addToast('Fournisseur supprimé', 'success');
      loadData();
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur', 'error');
    }
  };

  const filtered = items.filter(s => s.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Fournisseurs</h2>
        <span className="subtitle">Gérez la liste des fournisseurs</span>
        <div className="header-accent" />
      </div>

      <div className="page-toolbar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="toolbar-spacer" />
        <span className="badge">{filtered.length} fournisseur{filtered.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-primary" onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouveau fournisseur
        </button>
      </div>

      <div className="card-table">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Créé le</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3}><div className="empty-state"><div className="empty-title">Chargement…</div></div></td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <div className="empty-state">
                      <div className="empty-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                      </div>
                      <div className="empty-title">Aucun fournisseur</div>
                      <div className="empty-desc">{search ? `Aucun résultat pour « ${search} »` : 'Cliquez sur Nouveau fournisseur pour commencer.'}</div>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filtered.map(s => (
                <tr key={s.id}>
                  <td className="col-bold">{s.code}</td>
                  <td>{formatDate(s.created_at)}</td>
                  <td className="text-right">
                    <button className="user-action-btn" onClick={() => openEdit(s)} title="Modifier">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button className="user-action-btn danger" onClick={() => handleDelete(s)} title="Supprimer" style={{ marginLeft: 4 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal open={true} title={editing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Code fournisseur</label>
              <input type="text" value={formCode} onChange={e => setFormCode(e.target.value)} required autoFocus />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
