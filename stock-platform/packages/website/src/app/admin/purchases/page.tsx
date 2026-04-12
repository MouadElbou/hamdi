'use client';

import React, { useEffect, useState } from 'react';
import { adminGet, adminPost, adminPatch, adminDelete } from '@/lib/admin-api';
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

function parsePositiveInt(value: string, label: string): number {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) throw new Error(`${label} doit être un entier positif`);
  return n;
}

export default function PurchasesPage(): React.JSX.Element {
  /* ── Reference data (loaded from API) ── */
  const [categories, setCategories] = useState<Array<{ name: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ code: string }>>([]);
  const [boutiques, setBoutiques] = useState<Array<{ name: string }>>([]);

  useEffect(() => {
    adminGet<Array<{ name: string }>>('/reference/categories').then(setCategories).catch(() => {});
    adminGet<Array<{ code: string }>>('/reference/suppliers').then(setSuppliers).catch(() => {});
    adminGet<Array<{ name: string }>>('/reference/boutiques').then(setBoutiques).catch(() => {});
  }, []);

  /* ── Page state ── */
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    date: todayLocal(), category: '', designation: '',
    supplier: '', boutique: '', initialQuantity: '', purchaseUnitCost: '', targetResalePrice: '', blockPrice: '',
  });

  const resetForm = () => setForm({ date: todayLocal(), category: '', designation: '', supplier: '', boutique: '', initialQuantity: '', purchaseUnitCost: '', targetResalePrice: '', blockPrice: '' });

  const openCreate = () => { resetForm(); setEditingId(null); setShowForm(true); };
  const openEdit = (item: Record<string, unknown>) => {
    const bp = item['block_price'] as number | null;
    setForm({
      date: item['date'] as string,
      category: item['category_name'] as string,
      designation: item['designation'] as string,
      supplier: item['supplier_code'] as string,
      boutique: item['boutique_name'] as string,
      initialQuantity: String(item['initial_quantity']),
      purchaseUnitCost: String((item['purchase_unit_cost'] as number) / 100),
      targetResalePrice: item['target_resale_price'] ? String((item['target_resale_price'] as number) / 100) : '',
      blockPrice: bp ? String(bp / 100) : '',
    });
    setEditingId(item['id'] as string);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); resetForm(); };

  const load = async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      const result = await adminGet<{ items: Array<Record<string, unknown>>; total: number }>(`/purchases?${params.toString()}`);
      if (result?.items) setItems(result.items);
      setTotalItems(result?.total || 0);
    } catch (err) { console.error('[Load]', err); addToast('Erreur lors du chargement des achats', 'error'); }
  };

  useEffect(() => {
    load();
  }, [search, page]);

  const fm = (centimes: number) => (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const qty = parsePositiveInt(form.initialQuantity, 'Quantité');
      const blockPriceCents = form.blockPrice ? parseCents(form.blockPrice, 'Prix bloc') : null;
      const unitCostCents = blockPriceCents && qty > 0
        ? Math.round(blockPriceCents / qty)
        : parseCents(form.purchaseUnitCost, 'Coût unitaire');
      const payload = {
        date: form.date,
        category: form.category,
        designation: form.designation,
        supplier: form.supplier,
        boutique: form.boutique,
        initialQuantity: qty,
        purchaseUnitCost: unitCostCents,
        targetResalePrice: form.targetResalePrice ? parseCents(form.targetResalePrice, 'Prix revente') : null,
        blockPrice: blockPriceCents,
      };
      if (editingId) {
        await adminPatch('/purchases/' + editingId, payload);
      } else {
        await adminPost('/purchases', payload);
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
    if (!await confirm('Supprimer cet achat ?')) return;
    setDeleting(true);
    try {
      await adminDelete('/purchases/' + id);
      load();
    } catch (err) {
      console.error('[Delete]', err);
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Achats</h2>
        <span className="subtitle">Lots d&apos;achat enregistres</span>
        <div className="header-accent" />
      </div>

      <div className="page-toolbar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <span className="badge">{totalItems} lots</span>
        <div className="toolbar-spacer" />
        <button className="btn btn-primary" onClick={openCreate}>
          + Nouvel achat
        </button>
      </div>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Modifier achat' : 'Nouvel achat'}>
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
                onChange={v => setForm({ ...form, category: v })}
                placeholder="Choisir ou ajouter"
                required
                creatable
                onCreate={async (name) => { setCategories(prev => [...prev, { name }]); }}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Designation</label>
              <input type="text" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Fournisseur</label>
              <SearchableSelect
                options={suppliers.map(s => ({ value: s.code, label: s.code }))}
                value={form.supplier}
                onChange={v => setForm({ ...form, supplier: v })}
                placeholder="Choisir ou ajouter"
                required
                creatable
                onCreate={async (code) => { setSuppliers(prev => [...prev, { code }]); }}
              />
            </div>
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
                onCreate={async (name) => { setBoutiques(prev => [...prev, { name }]); }}
              />
            </div>
            <div className="form-group">
              <label>Quantite</label>
              <input type="number" min="1" value={form.initialQuantity} onChange={e => {
                const qty = Number(e.target.value);
                const bp = Number(form.blockPrice);
                const autoUnit = form.blockPrice && qty > 0 ? (bp / qty).toFixed(2) : form.purchaseUnitCost;
                setForm({ ...form, initialQuantity: e.target.value, purchaseUnitCost: autoUnit });
              }} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Prix en bloc (total)</label>
              <input type="number" step="0.01" min="0" value={form.blockPrice} onChange={e => {
                const bp = e.target.value;
                const qty = Number(form.initialQuantity);
                const autoUnit = bp && qty > 0 ? (Number(bp) / qty).toFixed(2) : form.purchaseUnitCost;
                setForm({ ...form, blockPrice: bp, purchaseUnitCost: autoUnit });
              }} placeholder="Optionnel" />
            </div>
            <div className="form-group">
              <label>Prix achat unitaire{form.blockPrice ? ' (auto)' : ''}</label>
              <input type="number" step="0.01" min="0" value={form.purchaseUnitCost} onChange={e => setForm({ ...form, purchaseUnitCost: e.target.value, blockPrice: '' })} required readOnly={!!form.blockPrice} />
            </div>
            <div className="form-group">
              <label>Prix de vente en bloc</label>
              <input type="number" step="0.01" min="0" value={form.targetResalePrice} onChange={e => setForm({ ...form, targetResalePrice: e.target.value })} />
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
                <th>Ref</th>
                <th>Date</th>
                <th>Categorie</th>
                <th>Designation</th>
                <th>Fournisseur</th>
                <th>Boutique</th>
                <th className="text-right">Qte</th>
                <th className="text-right">PA</th>
                <th className="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <div className="empty-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                      </div>
                      <div className="empty-title">Aucun achat</div>
                      <div className="empty-desc">Les lots d&apos;achat enregistres apparaitront ici.</div>
                    </div>
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item['id'] as string}>
                  <td className="col-mono col-bold">{item['ref_number'] as string}</td>
                  <td className="col-mono">{item['date'] as string}</td>
                  <td>{item['category_name'] as string}</td>
                  <td className="col-bold">{item['designation'] as string}</td>
                  <td>{item['supplier_code'] as string}</td>
                  <td>{item['boutique_name'] as string}</td>
                  <td className="text-right col-mono">{item['initial_quantity'] as number}</td>
                  <td className="text-right col-mono">{fm(item['purchase_unit_cost'] as number)}</td>
                  <td className="text-right col-mono col-bold">
                    {fm((item['initial_quantity'] as number) * (item['purchase_unit_cost'] as number))}
                  </td>
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
