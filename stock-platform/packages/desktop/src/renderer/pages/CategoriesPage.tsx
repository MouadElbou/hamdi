import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../components/Modal.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';

interface Category {
  id: string;
  name: string;
  created_at: string;
}

interface SubCategory {
  id: string;
  name: string;
  category_id: string;
  created_at: string;
}

export function CategoriesPage(): React.JSX.Element {
  const { addToast } = useToast();
  const [confirm, confirmDialog] = useConfirm();

  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchCat, setSearchCat] = useState('');
  const [searchSub, setSearchSub] = useState('');

  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');

  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<SubCategory | null>(null);
  const [subName, setSubName] = useState('');
  const [subCatId, setSubCatId] = useState('');

  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, subs] = await Promise.all([
        window.api.categories.list() as Promise<Category[]>,
        window.api.subCategories.list() as Promise<SubCategory[]>,
      ]);
      setCategories(cats);
      setSubCategories(subs);
      if (!selectedCatId && cats.length > 0) {
        setSelectedCatId(cats[0].id);
      }
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, selectedCatId]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ─── Category CRUD ─────────────────────────────────────────
  const openCreateCat = () => {
    setEditingCat(null);
    setCatName('');
    setShowCatModal(true);
  };

  const openEditCat = (c: Category) => {
    setEditingCat(c);
    setCatName(c.name);
    setShowCatModal(true);
  };

  const saveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const trimmed = catName.trim();
    if (!trimmed) { addToast('Le nom est requis', 'error'); return; }
    setSaving(true);
    try {
      if (editingCat) {
        await window.api.categories.update({ id: editingCat.id, name: trimmed });
        addToast('Catégorie mise à jour', 'success');
      } else {
        await window.api.categories.create({ name: trimmed });
        addToast('Catégorie créée', 'success');
      }
      setShowCatModal(false);
      loadData();
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteCat = async (c: Category) => {
    const subCount = subCategories.filter(s => s.category_id === c.id).length;
    const msg = subCount > 0
      ? `Supprimer la catégorie « ${c.name} » et ses ${subCount} sous-catégorie${subCount !== 1 ? 's' : ''} ?`
      : `Supprimer la catégorie « ${c.name} » ?`;
    if (!await confirm(msg)) return;
    try {
      await window.api.categories.delete(c.id);
      addToast('Catégorie supprimée', 'success');
      if (selectedCatId === c.id) setSelectedCatId(null);
      loadData();
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur', 'error');
    }
  };

  // ─── Sub-Category CRUD ─────────────────────────────────────
  const openCreateSub = () => {
    if (!selectedCatId) { addToast('Sélectionnez une catégorie', 'error'); return; }
    setEditingSub(null);
    setSubName('');
    setSubCatId(selectedCatId);
    setShowSubModal(true);
  };

  const openEditSub = (s: SubCategory) => {
    setEditingSub(s);
    setSubName(s.name);
    setSubCatId(s.category_id);
    setShowSubModal(true);
  };

  const saveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const trimmed = subName.trim();
    if (!trimmed) { addToast('Le nom est requis', 'error'); return; }
    if (!subCatId) { addToast('Catégorie parente requise', 'error'); return; }
    setSaving(true);
    try {
      if (editingSub) {
        await window.api.subCategories.update({ id: editingSub.id, name: trimmed, categoryId: subCatId });
        addToast('Sous-catégorie mise à jour', 'success');
      } else {
        await window.api.subCategories.create({ name: trimmed, categoryId: subCatId });
        addToast('Sous-catégorie créée', 'success');
      }
      setShowSubModal(false);
      loadData();
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteSub = async (s: SubCategory) => {
    if (!await confirm(`Supprimer la sous-catégorie « ${s.name} » ?`)) return;
    try {
      await window.api.subCategories.delete(s.id);
      addToast('Sous-catégorie supprimée', 'success');
      loadData();
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur', 'error');
    }
  };

  const filteredCats = categories.filter(c => c.name.toLowerCase().includes(searchCat.toLowerCase()));
  const visibleSubs = subCategories
    .filter(s => !selectedCatId || s.category_id === selectedCatId)
    .filter(s => s.name.toLowerCase().includes(searchSub.toLowerCase()));
  const selectedCat = categories.find(c => c.id === selectedCatId) || null;

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Catégories</h2>
        <span className="subtitle">Gérez les catégories et sous-catégories</span>
        <div className="header-accent" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* ── Categories Column ── */}
        <div>
          <div className="page-toolbar" style={{ marginBottom: 12 }}>
            <div className="search-input-wrap" style={{ flex: 1 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="Rechercher catégorie…" value={searchCat} onChange={e => setSearchCat(e.target.value)} />
            </div>
            <span className="badge">{filteredCats.length}</span>
            <button className="btn btn-primary" onClick={openCreateCat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nouvelle
            </button>
          </div>
          <div className="card-table">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Catégorie</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (<tr><td colSpan={2}><div className="empty-state"><div className="empty-title">Chargement…</div></div></td></tr>)}
                  {!loading && filteredCats.length === 0 && (
                    <tr><td colSpan={2}><div className="empty-state"><div className="empty-title">Aucune catégorie</div></div></td></tr>
                  )}
                  {!loading && filteredCats.map(c => (
                    <tr key={c.id} className={selectedCatId === c.id ? 'row-selected' : ''} style={{ cursor: 'pointer' }} onClick={() => setSelectedCatId(c.id)}>
                      <td className="col-bold">{c.name}</td>
                      <td className="text-right">
                        <button className="user-action-btn" onClick={e => { e.stopPropagation(); openEditCat(c); }} title="Modifier">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button className="user-action-btn danger" onClick={e => { e.stopPropagation(); deleteCat(c); }} title="Supprimer" style={{ marginLeft: 4 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Sub-Categories Column ── */}
        <div>
          <div className="page-toolbar" style={{ marginBottom: 12 }}>
            <div className="search-input-wrap" style={{ flex: 1 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="Rechercher sous-catégorie…" value={searchSub} onChange={e => setSearchSub(e.target.value)} />
            </div>
            <span className="badge">{visibleSubs.length}</span>
            <button className="btn btn-primary" onClick={openCreateSub} disabled={!selectedCatId}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nouvelle
            </button>
          </div>
          <div className="card-table">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sous-catégorie {selectedCat && <span style={{ fontWeight: 400, opacity: 0.6 }}>· {selectedCat.name}</span>}</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (<tr><td colSpan={2}><div className="empty-state"><div className="empty-title">Chargement…</div></div></td></tr>)}
                  {!loading && !selectedCatId && (
                    <tr><td colSpan={2}><div className="empty-state"><div className="empty-title">Sélectionnez une catégorie</div></div></td></tr>
                  )}
                  {!loading && selectedCatId && visibleSubs.length === 0 && (
                    <tr><td colSpan={2}><div className="empty-state"><div className="empty-title">Aucune sous-catégorie</div></div></td></tr>
                  )}
                  {!loading && selectedCatId && visibleSubs.map(s => (
                    <tr key={s.id}>
                      <td className="col-bold">{s.name}</td>
                      <td className="text-right">
                        <button className="user-action-btn" onClick={() => openEditSub(s)} title="Modifier">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button className="user-action-btn danger" onClick={() => deleteSub(s)} title="Supprimer" style={{ marginLeft: 4 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showCatModal && (
        <Modal open={true} title={editingCat ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClose={() => setShowCatModal(false)}>
          <form onSubmit={saveCat}>
            <div className="form-group">
              <label>Nom</label>
              <input type="text" value={catName} onChange={e => setCatName(e.target.value)} required autoFocus />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCatModal(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : editingCat ? 'Mettre à jour' : 'Créer'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showSubModal && (
        <Modal open={true} title={editingSub ? 'Modifier la sous-catégorie' : 'Nouvelle sous-catégorie'} onClose={() => setShowSubModal(false)}>
          <form onSubmit={saveSub}>
            <div className="form-group">
              <label>Catégorie parente</label>
              <select value={subCatId} onChange={e => setSubCatId(e.target.value)} required>
                <option value="">-- Choisir --</option>
                {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
            <div className="form-group">
              <label>Nom</label>
              <input type="text" value={subName} onChange={e => setSubName(e.target.value)} required autoFocus />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowSubModal(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : editingSub ? 'Mettre à jour' : 'Créer'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
