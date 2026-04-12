import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal.js';
import { EditIcon, TrashIcon, CancelIcon, ReturnIcon } from '../components/Icons.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';
import { SearchableSelect } from '../components/SearchableSelect.js';
import Pagination, { PAGE_SIZE } from '../components/Pagination.js';
import { useReferenceData } from '../components/ReferenceDataContext.js';
import { parseCents, parsePositiveInt, todayLocal } from '../utils.js';
import { useBarcodeScanner } from '../components/useBarcodeScanner.js';

interface StockItem {
  lotId: string; refNumber: string; designation: string; category: string;
  remainingQuantity: number; purchaseUnitCost: number; sellingPrice: number | null;
  targetResalePrice: number | null; subCategory: string | null; barcode: string | null;
}
interface SaleLine { lotId: string; quantity: string; sellingUnitPrice: string; priceMode: 'unit' | 'block'; blockTotal: string; }
interface SaleOrder {
  id: string; ref_number: string; date: string; observation: string | null;
  client_name: string | null;
  totalAmount: number; totalMargin: number; totalReturned?: number;
  lines: Array<{ id: string; lot_id: string; designation: string; category: string; quantity: number; selling_unit_price: number; purchase_unit_cost: number; selling_price?: number | null; returned_quantity?: number }>;
}
interface ReturnLine { saleLineId: string; lotId: string; designation: string; category: string; originalQty: number; alreadyReturned: number; returnQty: string; sellingUnitPrice: number; }

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

export function SalesPage(): React.JSX.Element {
  const { categories, subCategories } = useReferenceData();
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(todayLocal());
  const [observation, setObservation] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<Array<{ id: string; name: string }>>([]);
  const clientSearchTimer = useRef<number>(0);
  const [lines, setLines] = useState<SaleLine[]>([{ lotId: '', quantity: '', sellingUnitPrice: '', priceMode: 'unit', blockTotal: '' }]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [paymentType, setPaymentType] = useState<'comptant' | 'credit'>('comptant');
  const [advancePaid, setAdvancePaid] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [modalCategory, setModalCategory] = useState('');
  const [modalSubCategory, setModalSubCategory] = useState('');
  const [confirm, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Return modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [returnDate, setReturnDate] = useState(todayLocal());
  const [returnObservation, setReturnObservation] = useState('');
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [returningSubmit, setReturningSubmit] = useState(false);

  const filterSubCategoryOptions = filterCategory
    ? subCategories.filter(sc => {
        const cat = categories.find(c => c.name === filterCategory);
        return cat && sc.category_id === cat.id;
      })
    : [];

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const result = await window.api.stock.lookupBarcode({ barcode }) as StockItem | null;
      if (!result) {
        addToast(`Aucun produit trouvé pour le code-barres: ${barcode}`, 'error');
        return;
      }
      if (!showForm) {
        // Auto-open create form and add the scanned lot as first line
        resetForm();
        setEditingId(null);
        setShowForm(true);
        setLines([{
          lotId: result.lotId,
          quantity: '1',
          sellingUnitPrice: result.sellingPrice ? (result.sellingPrice / 100).toFixed(2) : '',
          priceMode: 'unit',
          blockTotal: '',
        }]);
        // Refresh stock for the modal
        window.api.stock.list({ inStockOnly: true, limit: 5000 }).then((r: unknown) => {
          const data = r as { items: StockItem[] };
          setStock(data.items || []);
        }).catch(() => {});
        return;
      }
      // Modal is open — check if lot already in lines
      setLines(prev => {
        const existingIdx = prev.findIndex(l => l.lotId === result.lotId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const currentQty = parseInt(updated[existingIdx].quantity) || 0;
          updated[existingIdx] = { ...updated[existingIdx], quantity: String(currentQty + 1) };
          return updated;
        }
        // Add new line (replace empty line at end if exists)
        const lastLine = prev[prev.length - 1];
        const newLine: SaleLine = {
          lotId: result.lotId,
          quantity: '1',
          sellingUnitPrice: result.sellingPrice ? (result.sellingPrice / 100).toFixed(2) : '',
          priceMode: 'unit',
          blockTotal: '',
        };
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


  const load = () => {
    window.api.sales.list({ search: search || undefined, page, limit: PAGE_SIZE, category: filterCategory || undefined, subCategory: filterSubCategory || undefined }).then((r: unknown) => {
      const data = r as { items: SaleOrder[]; total: number };
      setOrders(data.items || []);
      setTotalOrders(data.total || 0);
    }).catch(() => addToast('Erreur lors du chargement des ventes', 'error'));
    window.api.stock.list({ inStockOnly: true, limit: 5000 }).then((r: unknown) => {
      const data = r as { items: StockItem[] };
      setStock(data.items || []);
    }).catch(() => addToast('Erreur lors du chargement du stock', 'error'));
  };
  useEffect(load, [search, page, filterCategory, filterSubCategory]);

  const resetForm = () => {
    setDate(todayLocal());
    setObservation('');
    setClientName('');
    setClientSuggestions([]);
    setLines([{ lotId: '', quantity: '', sellingUnitPrice: '', priceMode: 'unit', blockTotal: '' }]);
    setPaymentType('comptant');
    setAdvancePaid('');
    setDueDate('');
    setModalCategory('');
    setModalSubCategory('');
  };

  const openCreate = () => { resetForm(); setEditingId(null); setShowForm(true); };
  const openEdit = (o: SaleOrder) => {
    setDate(o.date);
    setObservation(o.observation || '');
    setClientName(o.client_name || '');
    setLines(o.lines.map(l => ({
      lotId: l.lot_id,
      quantity: String(l.quantity),
      sellingUnitPrice: String(l.selling_unit_price / 100),
      priceMode: 'unit' as const,
      blockTotal: '',
    })));
    setPaymentType('comptant');
    setAdvancePaid('');
    setDueDate('');
    setEditingId(o.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); resetForm(); };

  const addLine = () => setLines([...lines, { lotId: '', quantity: '', sellingUnitPrice: '', priceMode: 'unit', blockTotal: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof SaleLine, value: string) => {
    const updated = [...lines];
    if (field === 'priceMode') {
      const mode = value as 'unit' | 'block';
      const lot = stock.find(s => s.lotId === updated[i].lotId);
      if (mode === 'block' && lot?.targetResalePrice) {
        updated[i] = { ...updated[i], priceMode: mode, blockTotal: '', sellingUnitPrice: (lot.targetResalePrice / 100).toFixed(2) };
      } else if (mode === 'unit' && lot?.sellingPrice) {
        updated[i] = { ...updated[i], priceMode: mode, blockTotal: '', sellingUnitPrice: (lot.sellingPrice / 100).toFixed(2) };
      } else {
        updated[i] = { ...updated[i], priceMode: mode, blockTotal: '', sellingUnitPrice: '' };
      }
    } else {
      updated[i] = { ...updated[i], [field]: value } as SaleLine;
    }
    setLines(updated);
  };

  const lineMargin = (line: SaleLine): number | null => {
    const lot = stock.find(s => s.lotId === line.lotId);
    if (!lot || !line.quantity || !line.sellingUnitPrice) return null;
    const sellCents = Math.round(parseFloat(line.sellingUnitPrice) * 100);
    return (sellCents - lot.purchaseUnitCost) * parseInt(line.quantity);
  };

  const totalFormMargin = (): number | null => {
    const margins = lines.map(lineMargin).filter((m): m is number => m !== null);
    return margins.length > 0 ? margins.reduce((a, b) => a + b, 0) : null;
  };

  const hasNegativeMargin = lines.some(l => {
    const m = lineMargin(l);
    return m !== null && m < 0;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const validLines = lines.filter(l => l.lotId && l.quantity && l.sellingUnitPrice);
    if (validLines.length === 0) return;

    if (paymentType === 'credit' && !clientName.trim()) {
      addToast('Le nom du client est requis pour un paiement à crédit', 'error');
      return;
    }

    if (hasNegativeMargin) {
      const ok = await confirm('Attention: une ou plusieurs lignes ont une marge negative (vente en dessous du prix d\'achat). Continuer ?');
      if (!ok) return;
    }

    setSubmitting(true);
    try {
    const payload = {
      date,
      observation: observation || undefined,
      clientName: clientName.trim() || undefined,
      paymentType,
      advancePaid: paymentType === 'credit' && advancePaid ? parseCents(advancePaid, 'Avance versée') : undefined,
      dueDate: paymentType === 'credit' && dueDate ? dueDate : undefined,
      lines: validLines.map(l => ({
        lotId: l.lotId,
        quantity: parsePositiveInt(l.quantity, 'Quantité'),
        sellingUnitPrice: parseCents(l.sellingUnitPrice, 'Prix de vente'),
      })),
    };

    if (editingId) {
      await window.api.sales.update({ id: editingId, ...payload });
    } else {
      await window.api.sales.create(payload);
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
    const ok = await confirm('Supprimer cette vente ? Cette action est irreversible.');
    if (!ok) return;
    setDeleting(true);
    try {
      await window.api.sales.delete(id);
      load();
    } catch {
      addToast('Erreur lors de la suppression', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openReturn = (o: SaleOrder) => {
    setReturnOrderId(o.id);
    setReturnDate(todayLocal());
    setReturnObservation('');
    setReturnLines(o.lines.map(l => ({
      saleLineId: l.id,
      lotId: l.lot_id,
      designation: l.designation,
      category: l.category,
      originalQty: l.quantity,
      alreadyReturned: l.returned_quantity || 0,
      returnQty: '',
      sellingUnitPrice: l.selling_unit_price,
    })));
    setShowReturnModal(true);
  };

  const closeReturnModal = () => {
    setShowReturnModal(false);
    setReturnOrderId(null);
    setReturnLines([]);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (returningSubmit) return;
    const validLines = returnLines.filter(l => {
      const qty = parseInt(l.returnQty);
      return qty > 0;
    });
    if (validLines.length === 0) {
      addToast('Veuillez saisir au moins une quantité à retourner', 'error');
      return;
    }
    setReturningSubmit(true);
    try {
      await window.api.sales.return({
        saleOrderId: returnOrderId,
        date: returnDate,
        observation: returnObservation || undefined,
        lines: validLines.map(l => ({
          saleLineId: l.saleLineId,
          lotId: l.lotId,
          quantity: parseInt(l.returnQty),
          sellingUnitPrice: l.sellingUnitPrice,
        })),
      });
      closeReturnModal();
      load();
      addToast('Retour enregistré avec succès', 'success');
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors du retour', 'error');
    } finally {
      setReturningSubmit(false);
    }
  };

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Ventes</h2>
        <span className="subtitle">Enregistrer et consulter les ventes liees aux lots</span>
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
        <span className="badge">{totalOrders} ventes</span>
        <div className="toolbar-spacer" />
        <button className="btn btn-primary" onClick={openCreate}>
          + Nouvelle vente
        </button>
      </div>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Modifier vente' : 'Nouvelle vente'} width="780px">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Observation</label>
              <input type="text" value={observation} onChange={e => setObservation(e.target.value)} placeholder="Optionnel" />
            </div>
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Client{paymentType === 'credit' ? ' *' : ''}</label>
              <input type="text" value={clientName} onChange={e => {
                const v = e.target.value;
                setClientName(v);
                clearTimeout(clientSearchTimer.current);
                if (v.length >= 2) {
                  clientSearchTimer.current = window.setTimeout(() => {
                    window.api.clients.search(v).then((r: unknown) => setClientSuggestions(r as Array<{ id: string; name: string }>)).catch(err => console.error('[Load]', err));
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

          <div className="form-row">
            <div className="form-group" style={{ flex: 'none' }}>
              <label>Paiement</label>
              <div className="sale-toggle">
                <button type="button" className={paymentType === 'comptant' ? 'active' : ''} onClick={() => setPaymentType('comptant')}>Comptant</button>
                <button type="button" className={paymentType === 'credit' ? 'active' : ''} onClick={() => setPaymentType('credit')}>Crédit</button>
              </div>
            </div>
            {paymentType === 'credit' && (
              <>
                <div className="form-group">
                  <label>Avance versée</label>
                  <input type="number" step="0.01" min="0" value={advancePaid} onChange={e => setAdvancePaid(e.target.value)} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Échéance</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </>
            )}
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
            const margin = lineMargin(line);
            const filteredStock = stock.filter(s => {
              if (modalCategory && s.category !== modalCategory) return false;
              if (modalSubCategory && s.subCategory !== modalSubCategory) return false;
              return true;
            });
            const lineTotal = line.quantity && line.sellingUnitPrice
              ? Math.round(parseFloat(line.sellingUnitPrice) * 100) * parseInt(line.quantity)
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
                        if (line.priceMode === 'block' && lot?.targetResalePrice) {
                          updated[i].sellingUnitPrice = (lot.targetResalePrice / 100).toFixed(2);
                        } else if (line.priceMode === 'unit' && lot?.sellingPrice) {
                          updated[i].sellingUnitPrice = (lot.sellingPrice / 100).toFixed(2);
                        }
                        setLines(updated);
                      }}
                      placeholder="Rechercher un lot..."
                      required
                      options={filteredStock.map(s => ({
                        value: s.lotId,
                        label: `${s.designation} (${s.category}) — dispo: ${s.remainingQuantity}${s.sellingPrice ? ` — PV: ${(s.sellingPrice / 100).toFixed(2)}` : ''} — PA: ${(s.purchaseUnitCost / 100).toFixed(2)}`,
                      }))}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 'none', width: 80 }}>
                    <label>Qté{selectedLot ? ` /${selectedLot.remainingQuantity}` : ''}</label>
                    <input type="number" min="1" max={selectedLot?.remainingQuantity} value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} required />
                  </div>
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <div className="form-group" style={{ flex: 'none' }}>
                    <label>Mode</label>
                    <div className="sale-toggle sm">
                      <button type="button" className={line.priceMode === 'unit' ? 'active' : ''} onClick={() => updateLine(i, 'priceMode', 'unit')}>Unité</button>
                      <button type="button" className={line.priceMode === 'block' ? 'active' : ''} onClick={() => updateLine(i, 'priceMode', 'block')}>Bloc</button>
                    </div>
                  </div>
                  {line.priceMode === 'block' ? (
                    <div className="form-group">
                      <label>PV unitaire (bloc)</label>
                      <input type="number" step="0.01" min="0" value={line.sellingUnitPrice} onChange={e => updateLine(i, 'sellingUnitPrice', e.target.value)} required />
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>PV unitaire</label>
                      <input type="number" step="0.01" min="0" value={line.sellingUnitPrice} onChange={e => updateLine(i, 'sellingUnitPrice', e.target.value)} required />
                    </div>
                  )}
                  {lines.length > 1 && (
                    <div className="form-group" style={{ flex: 'none', alignSelf: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeLine(i)}>{CancelIcon}</button>
                    </div>
                  )}
                </div>
                {(margin !== null || lineTotal !== null) && (
                  <div className="sale-line-info">
                    {lineTotal !== null && <span>Total: {fm(lineTotal)}</span>}
                    {margin !== null && (
                      <span className={margin < 0 ? 'text-danger' : 'text-success'}>
                        Marge: {fm(margin)}
                      </span>
                    )}
                    {selectedLot && <span className="text-muted">PA: {fm(selectedLot.purchaseUnitCost)}</span>}
                    {selectedLot?.sellingPrice && <span className="text-muted">PV lot: {fm(selectedLot.sellingPrice)}</span>}
                  </div>
                )}
              </div>
            );
          })}

          {(() => {
            const totalAmount = lines.reduce((sum, l) => {
              if (!l.quantity || !l.sellingUnitPrice) return sum;
              return sum + Math.round(parseFloat(l.sellingUnitPrice) * 100) * parseInt(l.quantity);
            }, 0);
            const margin = totalFormMargin();
            return (totalAmount > 0 || margin !== null) ? (
              <div className="sale-summary">
                {totalAmount > 0 && <span>Total: {fm(totalAmount)}</span>}
                {margin !== null && (
                  <span className={margin < 0 ? 'text-danger' : 'text-success'}>
                    Marge: {fm(margin)}
                  </span>
                )}
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
                <th>Observation</th>
                <th className="text-right">Montant</th>
                <th className="text-right">Marge</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
                    </div>
                    <div className="empty-title">Aucune vente enregistree</div>
                    <div className="empty-desc">Creez une vente pour commencer.</div>
                  </div>
                </td></tr>
              )}
              {orders.map(o => (
                <React.Fragment key={o.id}>
                  <tr>
                    <td className="col-mono col-bold">{o.ref_number}</td>
                    <td className="col-mono">{o.date}</td>
                    <td className="text-muted">{o.client_name || '—'}</td>
                    <td className="text-muted">{o.observation || '—'}</td>
                    <td className="text-right col-mono col-bold">{fm(o.totalAmount)}{o.totalReturned ? <span className="text-warning" style={{ fontSize: '0.8em', display: 'block' }}>-{fm(o.totalReturned)}</span> : null}</td>
                    <td className={`text-right col-mono col-bold ${o.totalMargin >= 0 ? 'text-success' : 'text-danger'}`}>{fm(o.totalMargin)}</td>
                    <td className="text-center">
                      <div className="row-actions">
                        <button className="btn-icon" onClick={() => openEdit(o)} title="Modifier">{EditIcon}</button>
                        <button className="btn-icon" onClick={() => openReturn(o)} title="Retour">{ReturnIcon}</button>
                        <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(o.id)} title="Supprimer">{TrashIcon}</button>
                      </div>
                    </td>
                  </tr>
                  {o.lines.map((l, i) => (
                    <tr key={i} className="row-detail">
                      <td></td>
                      <td className="text-muted">{l.category}</td>
                      <td colSpan={2}>{l.designation}{l.returned_quantity ? <span className="text-warning" style={{ marginLeft: 8, fontSize: '0.85em' }}>({l.returned_quantity} retourné)</span> : null}</td>
                      <td className="text-right col-mono">{l.quantity} x {fm(l.selling_unit_price)}</td>
                      <td className={`text-right col-mono ${(l.selling_unit_price - l.purchase_unit_cost) >= 0 ? 'text-success' : 'text-danger'}`}>{fm((l.selling_unit_price - l.purchase_unit_cost) * l.quantity)}</td>
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

      <Modal open={showReturnModal} onClose={closeReturnModal} title="Retour de produits" width="680px">
        <form onSubmit={handleReturnSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date du retour</label>
              <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} required />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Observation</label>
              <input type="text" value={returnObservation} onChange={e => setReturnObservation(e.target.value)} placeholder="Optionnel" />
            </div>
          </div>

          <table className="data-table" style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th className="text-right">Vendu</th>
                <th className="text-right">Déjà retourné</th>
                <th className="text-right" style={{ width: 100 }}>Qté à retourner</th>
              </tr>
            </thead>
            <tbody>
              {returnLines.map((rl, i) => {
                const maxReturn = rl.originalQty - rl.alreadyReturned;
                return (
                  <tr key={rl.saleLineId}>
                    <td>{rl.designation}</td>
                    <td className="text-muted">{rl.category}</td>
                    <td className="text-right col-mono">{rl.originalQty}</td>
                    <td className="text-right col-mono">{rl.alreadyReturned > 0 ? rl.alreadyReturned : '—'}</td>
                    <td className="text-right">
                      <input
                        type="number" min="0" max={maxReturn}
                        value={rl.returnQty}
                        onChange={e => {
                          const updated = [...returnLines];
                          updated[i] = { ...updated[i], returnQty: e.target.value };
                          setReturnLines(updated);
                        }}
                        style={{ width: 80, textAlign: 'right' }}
                        placeholder="0"
                        disabled={maxReturn === 0}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {(() => {
            const totalReturnAmount = returnLines.reduce((sum, rl) => {
              const qty = parseInt(rl.returnQty) || 0;
              return sum + qty * rl.sellingUnitPrice;
            }, 0);
            return totalReturnAmount > 0 ? (
              <div className="sale-summary">
                <span>Montant du retour: {fm(totalReturnAmount)}</span>
              </div>
            ) : null;
          })()}

          <div className="form-actions">
            <div className="toolbar-spacer" />
            <button type="button" className="btn btn-cancel" onClick={closeReturnModal}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={returningSubmit}>{returningSubmit ? 'En cours...' : 'Enregistrer le retour'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
