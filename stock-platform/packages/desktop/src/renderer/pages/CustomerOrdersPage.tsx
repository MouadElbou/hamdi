import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal.js';
import { EditIcon, TrashIcon, CancelIcon } from '../components/Icons.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';
import { SearchableSelect } from '../components/SearchableSelect.js';
import Pagination, { PAGE_SIZE } from '../components/Pagination.js';
import { useReferenceData } from '../components/ReferenceDataContext.js';
import { parseCents, parsePositiveInt, todayLocal } from '../utils.js';
import { useBarcodeScanner } from '../components/useBarcodeScanner.js';

type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';

interface StockItem {
  lotId: string; refNumber: string; designation: string; category: string;
  remainingQuantity: number; purchaseUnitCost: number; sellingPrice: number | null;
  targetResalePrice: number | null; subCategory: string | null; barcode: string | null;
}
interface OrderLine { lotId: string; quantity: string; sellingUnitPrice: string; }
interface CustomerOrder {
  id: string; ref_number: string; date: string; observation: string | null;
  client_name: string | null; status: OrderStatus;
  totalAmount: number;
  lines: Array<{ lot_id: string; designation: string; category: string; quantity: number; selling_unit_price: number; purchase_unit_cost: number }>;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

const STATUS_CLASSES: Record<OrderStatus, string> = {
  pending: 'badge-warning',
  confirmed: 'badge-info',
  delivered: 'badge-success',
  cancelled: 'badge-danger',
};

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

export function CustomerOrdersPage(): React.JSX.Element {
  const { categories, subCategories } = useReferenceData();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(todayLocal());
  const [observation, setObservation] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<Array<{ id: string; name: string }>>([]);
  const clientSearchTimer = useRef<number>(0);
  const [lines, setLines] = useState<OrderLine[]>([{ lotId: '', quantity: '', sellingUnitPrice: '' }]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [modalCategory, setModalCategory] = useState('');
  const [modalSubCategory, setModalSubCategory] = useState('');
  const [confirm, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const result = await window.api.stock.lookupBarcode({ barcode }) as StockItem | null;
      if (!result) {
        addToast(`Aucun produit trouvé pour le code-barres: ${barcode}`, 'error');
        return;
      }
      if (!showForm) {
        resetForm();
        setEditingId(null);
        setShowForm(true);
        setLines([{
          lotId: result.lotId,
          quantity: '1',
          sellingUnitPrice: result.sellingPrice ? (result.sellingPrice / 100).toFixed(2) : '',
        }]);
        window.api.stock.list({ inStockOnly: true, limit: 5000 }).then((r: unknown) => {
          const data = r as { items: StockItem[] };
          setStock(data.items || []);
        }).catch(() => addToast('Erreur lors du chargement du stock', 'error'));
        return;
      }
      setLines(prev => {
        const existingIdx = prev.findIndex(l => l.lotId === result.lotId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const currentQty = parseInt(updated[existingIdx].quantity) || 0;
          updated[existingIdx] = { ...updated[existingIdx], quantity: String(currentQty + 1) };
          return updated;
        }
        const newLine: OrderLine = {
          lotId: result.lotId,
          quantity: '1',
          sellingUnitPrice: result.sellingPrice ? (result.sellingPrice / 100).toFixed(2) : '',
        };
        const lastLine = prev[prev.length - 1];
        if (lastLine && !lastLine.lotId) {
          const updated = [...prev];
          updated[updated.length - 1] = newLine;
          return updated;
        }
        return [...prev, newLine];
      });
      addToast(`${result.designation} ajouté`, 'success');
    } catch {
      addToast('Erreur lors de la recherche par code-barres', 'error');
    }
  };

  useBarcodeScanner(handleBarcodeScan);

  const loadStock = () => {
    window.api.stock.list({ inStockOnly: true, limit: 5000 }).then((r: unknown) => {
      const data = r as { items: StockItem[] };
      setStock(data.items || []);
    }).catch(() => addToast('Erreur lors du chargement du stock', 'error'));
  };
  const load = () => {
    window.api.customerOrders.list({ search: search || undefined, page, limit: PAGE_SIZE, status: filterStatus || undefined }).then((r: unknown) => {
      const data = r as { items: CustomerOrder[]; total: number };
      setOrders(data.items || []);
      setTotalOrders(data.total || 0);
    }).catch(() => addToast('Erreur lors du chargement des commandes', 'error'));
  };
  useEffect(load, [search, page, filterStatus]);
  useEffect(() => () => clearTimeout(clientSearchTimer.current), []);

  const resetForm = () => {
    setDate(todayLocal());
    setObservation('');
    setClientName('');
    setClientSuggestions([]);
    setLines([{ lotId: '', quantity: '', sellingUnitPrice: '' }]);
    setModalCategory('');
    setModalSubCategory('');
  };

  const openCreate = () => { resetForm(); setEditingId(null); setShowForm(true); loadStock(); };
  const openEdit = (o: CustomerOrder) => {
    setDate(o.date);
    setObservation(o.observation || '');
    setClientName(o.client_name || '');
    setLines(o.lines.map(l => ({
      lotId: l.lot_id,
      quantity: String(l.quantity),
      sellingUnitPrice: String(l.selling_unit_price / 100),
    })));
    setEditingId(o.id);
    setShowForm(true);
    loadStock();
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); resetForm(); };

  const addLine = () => setLines([...lines, { lotId: '', quantity: '', sellingUnitPrice: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof OrderLine, value: string) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    if (field === 'lotId') {
      const lot = stock.find(s => s.lotId === value);
      if (lot?.sellingPrice) {
        updated[i].sellingUnitPrice = (lot.sellingPrice / 100).toFixed(2);
      }
    }
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const validLines = lines.filter(l => l.lotId && l.quantity && l.sellingUnitPrice);
    if (validLines.length === 0) {
      addToast('Au moins une ligne complète est requise', 'error');
      return;
    }

    // Validate quantities against available stock
    for (const l of validLines) {
      const lot = stock.find(s => s.lotId === l.lotId);
      if (lot) {
        const qty = parseInt(l.quantity);
        if (qty > lot.remainingQuantity) {
          addToast(`Quantité (${qty}) dépasse le stock disponible (${lot.remainingQuantity}) pour ${lot.designation}`, 'error');
          return;
        }
      }
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

      if (editingId) {
        await window.api.customerOrders.update({ id: editingId, ...payload });
      } else {
        await window.api.customerOrders.create(payload);
      }
      closeForm();
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    try {
      await window.api.customerOrders.updateStatus({ id, status });
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors du changement de statut', 'error');
    }
  };

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return;
    const ok = await confirm('Supprimer cette commande ? Cette action est irreversible.');
    if (!ok) return;
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await window.api.customerOrders.delete(id);
      load();
    } catch {
      addToast('Erreur lors de la suppression', 'error');
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Commandes clients</h2>
        <span className="subtitle">Suivi des commandes en cours et historique</span>
        <div className="header-accent" />
      </div>

      <div className="page-toolbar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} maxLength={100} />
        </div>
        <select className="toolbar-filter" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirmée</option>
          <option value="delivered">Livrée</option>
          <option value="cancelled">Annulée</option>
        </select>
        <span className="badge">{totalOrders} commandes</span>
        <div className="toolbar-spacer" />
        <button className="btn btn-primary" onClick={openCreate}>
          + Nouvelle commande
        </button>
      </div>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Modifier commande' : 'Nouvelle commande'} width="780px">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={date} max={todayLocal()} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Observation</label>
              <input type="text" value={observation} onChange={e => setObservation(e.target.value)} placeholder="Optionnel" />
            </div>
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Client</label>
              <input type="text" value={clientName} onChange={e => {
                const v = e.target.value;
                setClientName(v);
                clearTimeout(clientSearchTimer.current);
                if (v.length >= 2) {
                  clientSearchTimer.current = window.setTimeout(() => {
                    window.api.clients.search(v).then((r: unknown) => setClientSuggestions(r as Array<{ id: string; name: string }>)).catch(() => {});
                  }, 300);
                } else {
                  setClientSuggestions([]);
                }
              }} placeholder="Nom du client" />
              {clientSuggestions.length > 0 && (
                <div className="sale-modal-autocomplete">
                  {clientSuggestions.map(c => (
                    <div key={c.id} className="sale-modal-autocomplete-item" onClick={() => { setClientName(c.name); setClientSuggestions([]); }}>
                      {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="sale-lines-header">
            <div className="form-row" style={{ flex: 1, marginBottom: 0 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <select className="toolbar-filter" value={modalCategory} onChange={e => { setModalCategory(e.target.value); setModalSubCategory(''); }}>
                  <option value="">Toutes catégories</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              {modalCategory && (() => {
                const cat = categories.find(c => c.name === modalCategory);
                const subs = cat ? subCategories.filter(sc => sc.category_id === cat.id) : [];
                return subs.length > 0 ? (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <select className="toolbar-filter" value={modalSubCategory} onChange={e => setModalSubCategory(e.target.value)}>
                      <option value="">Toutes sous-cat.</option>
                      {subs.map(sc => <option key={sc.id} value={sc.name}>{sc.name}</option>)}
                    </select>
                  </div>
                ) : null;
              })()}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>+ Ligne</button>
          </div>

          {lines.map((line, i) => {
            const selectedLot = stock.find(s => s.lotId === line.lotId);
            const filteredStock = stock.filter(s => {
              if (modalCategory && s.category !== modalCategory) return false;
              if (modalSubCategory && s.subCategory !== modalSubCategory) return false;
              return true;
            });
            const parsedPrice = parseFloat(line.sellingUnitPrice);
            const parsedQty = parseInt(line.quantity);
            const lineTotal = line.quantity && line.sellingUnitPrice && Number.isFinite(parsedPrice) && Number.isFinite(parsedQty)
              ? Math.round(parsedPrice * 100) * parsedQty
              : null;
            return (
              <div key={i} className={`sale-line ${i > 0 ? 'sale-line-border' : ''}`}>
                <div className="form-row" style={{ marginBottom: 4 }}>
                  <div className="form-group" style={{ flex: 3 }}>
                    <label>Lot</label>
                    <SearchableSelect
                      value={line.lotId}
                      onChange={val => {
                        const lot = stock.find(s => s.lotId === val);
                        const updated = [...lines];
                        updated[i] = { ...updated[i], lotId: val };
                        if (lot?.sellingPrice) {
                          updated[i].sellingUnitPrice = (lot.sellingPrice / 100).toFixed(2);
                        }
                        setLines(updated);
                      }}
                      placeholder="Rechercher un lot..."
                      required
                      options={filteredStock.map(s => ({
                        value: s.lotId,
                        label: `${s.designation} (${s.category})${s.barcode ? ` [${s.barcode}]` : ''} — dispo: ${s.remainingQuantity}${s.sellingPrice ? ` — PV: ${(s.sellingPrice / 100).toFixed(2)}` : ''} — PA: ${(s.purchaseUnitCost / 100).toFixed(2)}`,
                      }))}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 'none', width: 80 }}>
                    <label>Qté</label>
                    <input type="number" min="1" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} required />
                  </div>
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <div className="form-group">
                    <label>PV unitaire</label>
                    <input type="number" step="0.01" min="0" value={line.sellingUnitPrice} onChange={e => updateLine(i, 'sellingUnitPrice', e.target.value)} required />
                  </div>
                  {lines.length > 1 && (
                    <div className="form-group" style={{ flex: 'none', alignSelf: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeLine(i)}>{CancelIcon}</button>
                    </div>
                  )}
                </div>
                {lineTotal !== null && (
                  <div className="sale-line-info">
                    <span>Total: {fm(lineTotal)}</span>
                    {selectedLot && <span className="text-muted">PA: {fm(selectedLot.purchaseUnitCost)}</span>}
                  </div>
                )}
              </div>
            );
          })}

          {(() => {
            const totalAmount = lines.reduce((sum, l) => {
              if (!l.quantity || !l.sellingUnitPrice) return sum;
              const p = parseFloat(l.sellingUnitPrice), q = parseInt(l.quantity);
              if (!Number.isFinite(p) || !Number.isFinite(q)) return sum;
              return sum + Math.round(p * 100) * q;
            }, 0);
            return totalAmount > 0 ? (
              <div className="sale-summary">
                <span>Total: {fm(totalAmount)}</span>
              </div>
            ) : null;
          })()}

          <div className="form-actions">
            <div className="toolbar-spacer" />
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
                <th>Client</th>
                <th>Statut</th>
                <th>Observation</th>
                <th className="text-right">Montant</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>
                    </div>
                    <div className="empty-title">Aucune commande enregistrée</div>
                    <div className="empty-desc">Créez une commande pour commencer.</div>
                  </div>
                </td></tr>
              )}
              {orders.map(o => (
                <React.Fragment key={o.id}>
                  <tr>
                    <td className="col-mono col-bold">{o.ref_number}</td>
                    <td className="col-mono">{o.date}</td>
                    <td className="text-muted">{o.client_name || '—'}</td>
                    <td>
                      <span className={`status-badge ${STATUS_CLASSES[o.status]}`}>
                        {STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="text-muted">{o.observation || '—'}</td>
                    <td className="text-right col-mono col-bold">{fm(o.totalAmount)}</td>
                    <td className="text-center">
                      <div className="row-actions">
                        {o.status === 'pending' && (
                          <button className="btn-icon" onClick={() => handleStatusChange(o.id, 'confirmed')} title="Confirmer">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          </button>
                        )}
                        {o.status === 'confirmed' && (
                          <button className="btn-icon" onClick={() => handleStatusChange(o.id, 'delivered')} title="Marquer livrée">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                          </button>
                        )}
                        {o.status !== 'cancelled' && o.status !== 'delivered' && (
                          <button className="btn-icon" onClick={() => handleStatusChange(o.id, 'cancelled')} title="Annuler">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                          </button>
                        )}
                        <button className="btn-icon" onClick={() => openEdit(o)} title="Modifier">{EditIcon}</button>
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
                      <td className="text-right col-mono">{fm(l.quantity * l.selling_unit_price)}</td>
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
