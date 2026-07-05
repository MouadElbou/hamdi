'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { adminGet, adminPost, adminPut, adminDelete } from '@/lib/admin-api';
import { EditIcon, Trash2Icon, PlusIcon, SearchIcon, PackageIcon } from '@/components/icons';

interface Product {
  id: string;
  name: string;
  category: string;
  description: string | null;
  priceCents: number | null;
  stock: number | null;
  imageUrl: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? '/api';
const fmtPrice = (c: number | null) =>
  c == null ? 'Sur demande' : (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

interface FormState {
  name: string; category: string; description: string;
  price: string; stock: string; imageUrl: string; published: boolean;
}
const EMPTY: FormState = { name: '', category: '', description: '', price: '', stock: '', imageUrl: '', published: true };

export default function ProductsAdminPage(): React.JSX.Element {
  const { addToast } = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminGet<{ products: Product[] }>('/admin/products');
      setItems(r.products || []);
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors du chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  const openCreate = () => { setForm(EMPTY); setEditingId(null); setShowForm(true); };
  const openEdit = (p: Product) => {
    setForm({
      name: p.name, category: p.category, description: p.description ?? '',
      price: p.priceCents != null ? (p.priceCents / 100).toFixed(2) : '',
      stock: p.stock != null ? String(p.stock) : '',
      imageUrl: p.imageUrl ?? '', published: p.published,
    });
    setEditingId(p.id); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY); };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // Same-origin fetch → the admin_token cookie authenticates the request.
      const res = await fetch(`${API_BASE}/admin/upload`, { method: 'POST', body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Échec du téléversement');
      setForm((f) => ({ ...f, imageUrl: data.url ?? '' }));
      addToast('Image téléversée', 'success');
    } catch (err) {
      addToast((err as Error).message, 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.name.trim() || !form.category.trim()) {
      addToast('Nom et catégorie requis', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim() || null,
        priceCents: form.price.trim() ? Math.round(parseFloat(form.price) * 100) : null,
        stock: form.stock.trim() ? parseInt(form.stock, 10) : null,
        imageUrl: form.imageUrl.trim() || null,
        published: form.published,
      };
      if (editingId) await adminPut(`/admin/products/${editingId}`, payload);
      else await adminPost('/admin/products', payload);
      addToast(editingId ? 'Produit modifié' : 'Produit créé', 'success');
      closeForm();
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    if (busyIds.has(id)) return;
    setBusyIds((p) => new Set(p).add(id));
    try { await fn(); } finally { setBusyIds((p) => { const n = new Set(p); n.delete(id); return n; }); }
  };

  const handleDelete = (p: Product) => withBusy(p.id, async () => {
    if (!(await confirm(`Supprimer « ${p.name} » ?`))) return;
    try {
      await adminDelete(`/admin/products/${p.id}`);
      addToast('Produit supprimé', 'success');
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    }
  });

  const togglePublish = (p: Product) => withBusy(p.id, async () => {
    try {
      await adminPut(`/admin/products/${p.id}`, { published: !p.published });
      setItems((list) => list.map((x) => (x.id === p.id ? { ...x, published: !p.published } : x)));
    } catch (err) {
      addToast((err as Error).message || 'Erreur', 'error');
    }
  });

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Produits</h2>
        <span className="subtitle">Catalogue affiché sur le site</span>
        <div className="header-accent" />
      </div>

      <div className="page-toolbar">
        <div className="search-input-wrap">
          <SearchIcon size={16} />
          <input type="text" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="badge">{filtered.length} produit(s)</span>
        <div className="toolbar-spacer" />
        <button className="btn btn-primary" onClick={openCreate}><PlusIcon size={16} /> Produit</button>
      </div>

      <div className="card-table">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 56 }}></th>
                <th>Nom</th>
                <th>Catégorie</th>
                <th className="text-right">Prix</th>
                <th className="text-right">Stock</th>
                <th>Statut</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon"><PackageIcon size={24} /></div>
                      <div className="empty-title">Aucun produit</div>
                      <div className="empty-desc">
                        {search ? `Aucun résultat pour « ${search} »` : 'Ajoutez un produit pour l’afficher sur le site.'}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--border, #333)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary, #888)' }}>
                        <PackageIcon size={16} />
                      </div>
                    )}
                  </td>
                  <td className="col-bold">{p.name}</td>
                  <td>{p.category}</td>
                  <td className="text-right col-mono">{fmtPrice(p.priceCents)}</td>
                  <td className="text-right col-mono">{p.stock ?? '—'}</td>
                  <td>
                    <button
                      type="button"
                      className={`badge ${p.published ? 'badge-success' : 'badge-warning'}`}
                      style={{ border: 'none', cursor: 'pointer' }}
                      disabled={busyIds.has(p.id)}
                      onClick={() => togglePublish(p)}
                      title="Cliquez pour publier/masquer"
                    >
                      {p.published ? 'Publié' : 'Masqué'}
                    </button>
                  </td>
                  <td className="text-center">
                    <div className="row-actions">
                      <button className="btn-icon" title="Modifier" onClick={() => openEdit(p)}><EditIcon size={16} /></button>
                      <button className="btn-icon btn-icon-danger" title="Supprimer" disabled={busyIds.has(p.id)} onClick={() => handleDelete(p)}><Trash2Icon size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Modifier le produit' : 'Nouveau produit'} width="640px">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Nom *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom du produit" required />
            </div>
            <div className="form-group">
              <label>Catégorie *</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Batteries" required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Prix (DH)</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Sur demande si vide" />
            </div>
            <div className="form-group">
              <label>Stock</label>
              <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="Illimité si vide" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optionnel" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Image</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {form.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.imageUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                )}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} disabled={uploading} />
                {uploading && <span style={{ fontSize: 13, color: 'var(--text-secondary, #888)' }}>Téléversement…</span>}
                {form.imageUrl && !uploading && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...form, imageUrl: '' })}>Retirer</button>
                )}
              </div>
            </div>
          </div>

          <div className="form-row">
            <label className="toggle-label">
              <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
              Publié sur le site
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={closeForm}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || uploading}>
              {submitting ? 'En cours…' : editingId ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
