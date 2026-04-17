import React, { useEffect, useState } from 'react';
import { Modal } from '../components/Modal.js';
import { EditIcon, TrashIcon } from '../components/Icons.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';
import Pagination, { PAGE_SIZE } from '../components/Pagination.js';
import { SearchableSelect } from '../components/SearchableSelect.js';
import { useReferenceData } from '../components/ReferenceDataContext.js';
import { useAuth } from '../components/AuthContext.js';
import { parseCents, parsePositiveInt, todayLocal } from '../utils.js';

export function PurchasesPage(): React.JSX.Element {
  const { categories, suppliers, boutiques, subCategories, addCategory, addSupplier, addBoutique, addSubCategory } = useReferenceData();
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    date: todayLocal(), category: '', subCategory: '', designation: '',
    supplier: '', boutique: '', initialQuantity: '', purchaseUnitCost: '', targetResalePrice: '', sellingPrice: '', barcode: '',
  });

  const resetForm = () => setForm({ date: todayLocal(), category: '', subCategory: '', designation: '', supplier: '', boutique: '', initialQuantity: '', purchaseUnitCost: '', targetResalePrice: '', sellingPrice: '', barcode: '' });

  const openCreate = () => { resetForm(); setEditingId(null); setShowForm(true); };
  const openEdit = (item: Record<string, unknown>) => {
    const sp = item['selling_price'] as number | null;
    setForm({
      date: item['date'] as string,
      category: item['category_name'] as string,
      subCategory: (item['sub_category_name'] as string) || '',
      designation: item['designation'] as string,
      supplier: item['supplier_code'] as string,
      boutique: item['boutique_name'] as string,
      initialQuantity: String(item['initial_quantity']),
      purchaseUnitCost: String((item['purchase_unit_cost'] as number) / 100),
      targetResalePrice: item['target_resale_price'] ? String((item['target_resale_price'] as number) / 100) : '',
      sellingPrice: sp ? String(sp / 100) : '',
      barcode: (item['barcode'] as string) || '',
    });
    setEditingId(item['id'] as string);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); resetForm(); };

  const filteredSubCategories = form.category
    ? subCategories.filter(sc => {
        const cat = categories.find(c => c.name === form.category);
        return cat && sc.category_id === cat.id;
      })
    : [];

  const filterSubCategoryOptions = filterCategory
    ? subCategories.filter(sc => {
        const cat = categories.find(c => c.name === filterCategory);
        return cat && sc.category_id === cat.id;
      })
    : [];

  const load = async () => {
    try {
      const result = await window.api.purchases.list({ page, limit: PAGE_SIZE, search: search || undefined, category: filterCategory || undefined, subCategory: filterSubCategory || undefined }) as { items: Array<Record<string, unknown>>; total: number };
      if (result?.items) setItems(result.items);
      setTotalItems(result?.total || 0);
    } catch (err) { console.error('[Load]', err); addToast('Erreur lors du chargement des achats', 'error'); }
  };

  useEffect(() => {
    load();
  }, [search, page, filterCategory, filterSubCategory]);

  const fm = (centimes: number) => (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
    const qty = parsePositiveInt(form.initialQuantity, 'Quantité');
    const unitCostCents = isAdmin ? parseCents(form.purchaseUnitCost, 'Coût unitaire') : 0;
    const payload = {
      date: form.date,
      category: form.category,
      subCategory: form.subCategory || null,
      designation: form.designation,
      supplier: form.supplier || undefined,
      boutique: form.boutique,
      initialQuantity: qty,
      purchaseUnitCost: unitCostCents,
      targetResalePrice: form.targetResalePrice ? parseCents(form.targetResalePrice, 'Prix revente') : null,
      blockPrice: null,
      sellingPrice: form.sellingPrice ? parseCents(form.sellingPrice, 'Prix de vente') : null,
      barcode: form.barcode || undefined,
    };
    if (editingId) {
      await window.api.purchases.update({ id: editingId, ...payload });
    } else {
      await window.api.purchases.create(payload);
    }
    closeForm();
    load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return;
    if (!await confirm('Supprimer cet achat ?')) return;
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await window.api.purchases.delete(id);
      load();
    } catch (err) {
      console.error('[Delete]', err);
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Achats</h2>
        <span className="subtitle">Lots d'achat enregistres</span>
        <div className="header-accent" />
      </div>

      <div className="page-toolbar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="toolbar-filter" value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setFilterSubCategory(''); setPage(1); }}>
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        {filterCategory && filterSubCategoryOptions.length > 0 && (
          <select className="toolbar-filter" value={filterSubCategory} onChange={e => { setFilterSubCategory(e.target.value); setPage(1); }}>
            <option value="">Toutes sous-cat.</option>
            {filterSubCategoryOptions.map(sc => <option key={sc.id} value={sc.name}>{sc.name}</option>)}
          </select>
        )}
        <span className="badge">{totalItems} lots</span>
        <div className="toolbar-spacer" />
        <button className="btn btn-primary" onClick={openCreate}>
          + Nouvel achat
        </button>
      </div>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Modifier achat' : 'Nouvel achat'} width="720px">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Categorie</label>
              <SearchableSelect
                options={categories.map(c => ({ value: c.name, label: c.name }))}
                value={form.category}
                onChange={v => setForm({ ...form, category: v, subCategory: '' })}
                placeholder="Choisir ou ajouter"
                required
                creatable
                onCreate={async (name) => { await addCategory(name); }}
              />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Sous-categorie</label>
              <SearchableSelect
                options={filteredSubCategories.map(sc => ({ value: sc.name, label: sc.name }))}
                value={form.subCategory}
                onChange={v => setForm({ ...form, subCategory: v })}
                placeholder="Optionnel"
                creatable
                onCreate={async (name) => {
                  const cat = categories.find(c => c.name === form.category);
                  if (cat) await addSubCategory(name, cat.id);
                }}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Designation</label>
              <input type="text" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Code-barres</label>
              <input type="text" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="Scanner ou saisir" />
            </div>
            {isAdmin && (
              <div className="form-group">
                <label>Fournisseur</label>
                <SearchableSelect
                  options={suppliers.map(s => ({ value: s.code, label: s.code }))}
                  value={form.supplier}
                  onChange={v => setForm({ ...form, supplier: v })}
                  placeholder="Choisir ou ajouter"
                  required
                  creatable
                  onCreate={async (code) => { await addSupplier(code); }}
                />
              </div>
            )}
          </div>
          <div className="form-row">
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
            <div className="form-group">
              <label>Quantite</label>
              <input type="number" min="1" value={form.initialQuantity} onChange={e => setForm({ ...form, initialQuantity: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            {isAdmin && (
              <div className="form-group">
                <label>Prix achat unitaire</label>
                <input type="number" step="0.01" min="0" value={form.purchaseUnitCost} onChange={e => setForm({ ...form, purchaseUnitCost: e.target.value })} required />
              </div>
            )}
            {isAdmin && (
              <div className="form-group">
                <label>Prix de vente en bloc</label>
                <input type="number" step="0.01" min="0" value={form.targetResalePrice} onChange={e => setForm({ ...form, targetResalePrice: e.target.value })} />
              </div>
            )}
            <div className="form-group">
              <label>Prix de vente</label>
              <input type="number" step="0.01" min="0" value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })} placeholder="Optionnel" />
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
                <th>Categorie</th>
                <th>Designation</th>
                <th>Code-barres</th>
                {isAdmin && <th>Fournisseur</th>}
                <th className="text-right">Qte</th>
                {isAdmin && <th className="text-right">PA unit.</th>}
                <th className="text-right">PV unit.</th>
                {isAdmin && <th className="text-right">Total</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 10 : 6}>
                    <div className="empty-state">
                      <div className="empty-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                      </div>
                      <div className="empty-title">Aucun achat</div>
                      <div className="empty-desc">Les lots d'achat enregistres apparaitront ici.</div>
                    </div>
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item['id'] as string}>
                  <td className="col-mono">{item['date'] as string}</td>
                  <td>{item['category_name'] as string}</td>
                  <td className="col-bold">{item['designation'] as string}</td>
                  <td className="text-muted">{(item['barcode'] as string) || '—'}</td>
                  {isAdmin && <td>{item['supplier_code'] as string}</td>}
                  <td className="text-right col-mono">{item['initial_quantity'] as number}</td>
                  {isAdmin && <td className="text-right col-mono">{fm(item['purchase_unit_cost'] as number)}</td>}
                  <td className="text-right col-mono">{item['selling_price'] ? fm(item['selling_price'] as number) : '—'}</td>
                  {isAdmin && (
                    <td className="text-right col-mono col-bold">
                      {fm((item['initial_quantity'] as number) * (item['purchase_unit_cost'] as number))}
                    </td>
                  )}
                  <td>
                    <div className="row-actions">
                      <button className="btn-icon" title="Modifier" onClick={() => openEdit(item)}>{EditIcon}</button>
                      <button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDelete(item['id'] as string)}>{TrashIcon}</button>
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
