import React, { useEffect, useState, useRef } from 'react';
import { Modal } from '../components/Modal.js';
import { EditIcon, TrashIcon } from '../components/Icons.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';
import Pagination, { PAGE_SIZE } from '../components/Pagination.js';
import { SearchableSelect } from '../components/SearchableSelect.js';
import { useReferenceData } from '../components/ReferenceDataContext.js';
import { parseCents, parsePositiveInt, todayLocal } from '../utils.js';

type Tab = 'clients' | 'fournisseurs';

interface CreditPayment {
  id: string; date: string; amount: number;
}

interface CustomerCredit {
  id: string; date: string; customer_name: string; designation: string;
  quantity: number; unit_price: number; advance_paid: number;
  total_amount: number; total_payments: number; remainingBalance: number;
  payments: CreditPayment[];
}
interface SupplierCredit {
  id: string; date: string; supplier_code: string; designation: string;
  total_amount: number; advance_paid: number; total_payments: number; remainingBalance: number;
  payments: CreditPayment[];
}

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

export function CreditsPage(): React.JSX.Element {
  const { suppliers, addSupplier } = useReferenceData();
  const [tab, setTab] = useState<Tab>('clients');
  const [custCredits, setCustCredits] = useState<CustomerCredit[]>([]);
  const [totalCust, setTotalCust] = useState(0);
  const [suppCredits, setSuppCredits] = useState<SupplierCredit[]>([]);
  const [totalSupp, setTotalSupp] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCustForm, setShowCustForm] = useState(false);
  const [showSuppForm, setShowSuppForm] = useState(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [editingSuppId, setEditingSuppId] = useState<string | null>(null);
  const [payingCust, setPayingCust] = useState<string | null>(null);
  const [payingSupp, setPayingSupp] = useState<string | null>(null);
  const [expandedCust, setExpandedCust] = useState<string | null>(null);
  const [expandedSupp, setExpandedSupp] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ date: todayLocal(), amount: '' });

  const [custForm, setCustForm] = useState({ date: todayLocal(), customerName: '', designation: '', quantity: '', unitPrice: '', advancePaid: '' });
  const [suppForm, setSuppForm] = useState({ date: todayLocal(), supplier: '', designation: '', totalAmount: '', advancePaid: '' });
  const [clientSuggestions, setClientSuggestions] = useState<Array<{ id: string; name: string }>>([]);
  const clientSearchTimer = useRef<number>(0);
  const [confirm, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // History popup state
  const [historyName, setHistoryName] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<CustomerCredit[] | SupplierCredit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState<string | null>(null);

  const openHistory = async (type: 'client' | 'supplier', name: string) => {
    setHistoryName(name);
    setHistoryLoading(true);
    setHistoryExpanded(null);
    try {
      if (type === 'client') {
        const items = await window.api.customerCredits.history(name) as CustomerCredit[];
        setHistoryItems(items);
      } else {
        const items = await window.api.supplierCredits.history(name) as SupplierCredit[];
        setHistoryItems(items);
      }
    } catch {
      addToast('Erreur lors du chargement de l\'historique', 'error');
      setHistoryName(null);
    } finally {
      setHistoryLoading(false);
    }
  };
  const closeHistory = () => { setHistoryName(null); setHistoryItems([]); setHistoryExpanded(null); };

  // Cleanup debounce timer on unmount
  useEffect(() => () => clearTimeout(clientSearchTimer.current), []);

  const resetCustForm = () => setCustForm({ date: todayLocal(), customerName: '', designation: '', quantity: '', unitPrice: '', advancePaid: '' });
  const resetSuppForm = () => setSuppForm({ date: todayLocal(), supplier: '', designation: '', totalAmount: '', advancePaid: '' });

  const openCreateCust = () => { resetCustForm(); setEditingCustId(null); setShowCustForm(true); };
  const openEditCust = (c: CustomerCredit) => {
    setCustForm({ date: c.date, customerName: c.customer_name, designation: c.designation, quantity: String(c.quantity), unitPrice: String(c.unit_price / 100), advancePaid: c.advance_paid ? String(c.advance_paid / 100) : '' });
    setEditingCustId(c.id); setShowCustForm(true);
  };
  const closeCustForm = () => { setShowCustForm(false); setEditingCustId(null); resetCustForm(); };

  const openCreateSupp = () => { resetSuppForm(); setEditingSuppId(null); setShowSuppForm(true); };
  const openEditSupp = (c: SupplierCredit) => {
    setSuppForm({ date: c.date, supplier: c.supplier_code, designation: c.designation, totalAmount: String(c.total_amount / 100), advancePaid: c.advance_paid ? String(c.advance_paid / 100) : '' });
    setEditingSuppId(c.id); setShowSuppForm(true);
  };
  const closeSuppForm = () => { setShowSuppForm(false); setEditingSuppId(null); resetSuppForm(); };

  const load = () => {
    window.api.customerCredits.list({ search: search || undefined, page, limit: PAGE_SIZE }).then((r: unknown) => {
      const data = r as { items: CustomerCredit[]; total: number };
      setCustCredits(data.items || []);
      setTotalCust(data.total || 0);
    }).catch(() => addToast('Erreur lors du chargement des crédits clients', 'error'));
    window.api.supplierCredits.list({ search: search || undefined, page, limit: PAGE_SIZE }).then((r: unknown) => {
      const data = r as { items: SupplierCredit[]; total: number };
      setSuppCredits(data.items || []);
      setTotalSupp(data.total || 0);
    }).catch(() => addToast('Erreur lors du chargement des crédits fournisseurs', 'error'));
  };
  useEffect(() => {
    load();
  }, [search, page]);

  const handleCustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
    const payload = {
      date: custForm.date,
      customerName: custForm.customerName,
      designation: custForm.designation,
      quantity: parsePositiveInt(custForm.quantity, 'Quantité'),
      unitPrice: parseCents(custForm.unitPrice, 'Prix unitaire'),
      advancePaid: custForm.advancePaid ? parseCents(custForm.advancePaid, 'Avance') : 0,
    };
    if (editingCustId) {
      await window.api.customerCredits.update({ id: editingCustId, ...payload });
    } else {
      await window.api.customerCredits.create(payload);
    }
    closeCustForm();
    load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
    const payload = {
      date: suppForm.date,
      supplier: suppForm.supplier,
      designation: suppForm.designation,
      totalAmount: parseCents(suppForm.totalAmount, 'Montant total'),
      advancePaid: suppForm.advancePaid ? parseCents(suppForm.advancePaid, 'Avance') : 0,
    };
    if (editingSuppId) {
      await window.api.supplierCredits.update({ id: editingSuppId, ...payload });
    } else {
      await window.api.supplierCredits.create(payload);
    }
    closeSuppForm();
    load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const [deleting, setDeleting] = useState(false);
  const handleDeleteCust = async (id: string) => {
    if (deleting) return;
    if (!await confirm('Supprimer ce credit client ?')) return;
    setDeleting(true);
    try {
      await window.api.customerCredits.delete(id);
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSupp = async (id: string) => {
    if (deleting) return;
    if (!await confirm('Supprimer ce credit fournisseur ?')) return;
    setDeleting(true);
    try {
      await window.api.supplierCredits.delete(id);
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCustPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !payingCust || !payForm.amount) return;
    setSubmitting(true);
    try {
    await window.api.customerCredits.addPayment({ creditId: payingCust, date: payForm.date, amount: parseCents(payForm.amount, 'Montant') });
    setPayingCust(null);
    setPayForm({ date: todayLocal(), amount: '' });
    load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuppPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !payingSupp) return;
    setSubmitting(true);
    try {
    await window.api.supplierCredits.addPayment({ creditId: payingSupp, date: payForm.date, amount: parseCents(payForm.amount, 'Montant') });
    setPayingSupp(null);
    setPayForm({ date: todayLocal(), amount: '' });
    load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors du paiement', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustPayment = async (paymentId: string) => {
    if (deleting) return;
    if (!await confirm('Supprimer ce paiement ?')) return;
    setDeleting(true);
    try {
      await window.api.customerCredits.deletePayment(paymentId);
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSuppPayment = async (paymentId: string) => {
    if (deleting) return;
    if (!await confirm('Supprimer ce paiement ?')) return;
    setDeleting(true);
    try {
      await window.api.supplierCredits.deletePayment(paymentId);
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const custTotal = custCredits.reduce((s, c) => s + c.remainingBalance, 0);
  const suppTotal = suppCredits.reduce((s, c) => s + c.remainingBalance, 0);

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Credits</h2>
        <span className="subtitle">Creances clients et dettes fournisseurs</span>
        <div className="header-accent" />
      </div>

      {/* Tabs + Action */}
      <div className="credits-bar">
        <div className="credits-tabs">
          <button className={`credits-tab${tab === 'clients' ? ' active' : ''}`} onClick={() => { setTab('clients'); setPage(1); setSearch(''); }}>
            <span>Clients</span>
            <span className="credits-tab-badge">{fm(custTotal)}</span>
          </button>
          <button className={`credits-tab${tab === 'fournisseurs' ? ' active' : ''}`} onClick={() => { setTab('fournisseurs'); setPage(1); setSearch(''); }}>
            <span>Fournisseurs</span>
            <span className="credits-tab-badge">{fm(suppTotal)}</span>
          </button>
        </div>
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => tab === 'clients' ? openCreateCust() : openCreateSupp()}>
          + {tab === 'clients' ? 'Credit client' : 'Credit fournisseur'}
        </button>
      </div>

      {/* Customer Credits Tab */}
      {tab === 'clients' && (
        <>
          <Modal open={showCustForm} onClose={closeCustForm} title={editingCustId ? 'Modifier credit client' : 'Nouveau credit client'}>
            <form onSubmit={handleCustSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Date</label><input type="date" value={custForm.date} onChange={e => setCustForm({ ...custForm, date: e.target.value })} required /></div>
                <div className="form-group"><label>Client</label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" value={custForm.customerName} onChange={e => {
                      const v = e.target.value;
                      setCustForm({ ...custForm, customerName: v });
                      clearTimeout(clientSearchTimer.current);
                      if (v.length >= 2) {
                        clientSearchTimer.current = window.setTimeout(() => {
                          window.api.clients.search(v).then((r: unknown) => setClientSuggestions(r as Array<{ id: string; name: string }>)).catch(err => console.error('[Load]', err));
                        }, 300);
                      } else {
                        setClientSuggestions([]);
                      }
                    }} required placeholder="Nom du client" />
                    {clientSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', zIndex: 10, maxHeight: 150, overflowY: 'auto' }}>
                        {clientSuggestions.map(c => (
                          <div key={c.id} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13 }} onClick={() => { setCustForm({ ...custForm, customerName: c.name }); setClientSuggestions([]); }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            {c.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Designation</label><input type="text" value={custForm.designation} onChange={e => setCustForm({ ...custForm, designation: e.target.value })} required /></div>
                <div className="form-group"><label>Qte</label><input type="number" min="1" value={custForm.quantity} onChange={e => setCustForm({ ...custForm, quantity: e.target.value })} required /></div>
                <div className="form-group"><label>PU</label><input type="number" step="0.01" min="0" value={custForm.unitPrice} onChange={e => setCustForm({ ...custForm, unitPrice: e.target.value })} required /></div>
                <div className="form-group"><label>Avance</label><input type="number" step="0.01" min="0" value={custForm.advancePaid} onChange={e => setCustForm({ ...custForm, advancePaid: e.target.value })} /></div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-cancel" onClick={closeCustForm}>Annuler</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>{submitting ? 'En cours...' : editingCustId ? 'Modifier' : 'Enregistrer'}</button>
              </div>
            </form>
          </Modal>

          <div className="card-table">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Client</th><th>Designation</th><th className="text-right">Total</th><th className="text-right">Reste</th><th></th><th></th></tr>
                </thead>
                <tbody>
                  {custCredits.length === 0 && <tr><td colSpan={7}><div className="empty-state" style={{ padding: '24px 16px' }}><div className="empty-desc">Aucune creance</div></div></td></tr>}
                  {custCredits.map(c => (
                    <React.Fragment key={c.id}>
                      <tr>
                        <td className="col-mono">{c.date}</td>
                        <td className="col-bold"><button className="btn-link" onClick={() => openHistory('client', c.customer_name)}>{c.customer_name}</button></td>
                        <td>{c.designation}</td>
                        <td className="text-right col-mono">{fm(c.total_amount)}</td>
                        <td className={`text-right col-mono col-bold ${c.remainingBalance > 0 ? 'text-warning' : 'text-success'}`}>{fm(c.remainingBalance)}</td>
                        <td style={{ display: 'flex', gap: 4 }}>
                          {c.remainingBalance > 0 && <button className="btn btn-secondary btn-sm" onClick={() => { setPayingCust(payingCust === c.id ? null : c.id); setPayForm({ date: todayLocal(), amount: '' }); }}>Paiement</button>}
                          {(c.payments || []).length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setExpandedCust(expandedCust === c.id ? null : c.id)} title="Historique des paiements">{expandedCust === c.id ? '▾' : '▸'} {c.payments.length}</button>}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="btn-icon" title="Modifier" onClick={() => openEditCust(c)}>{EditIcon}</button>
                            <button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDeleteCust(c.id)}>{TrashIcon}</button>
                          </div>
                        </td>
                      </tr>
                      {payingCust === c.id && (
                        <tr className="row-detail">
                          <td colSpan={7}>
                            <form onSubmit={handleCustPayment} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '4px 0' }}>
                              <div className="form-group" style={{ flex: 'none', width: 130 }}><label>Date</label><input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} required /></div>
                              <div className="form-group" style={{ flex: 'none', width: 120 }}><label>Montant</label><input type="number" step="0.01" min="0" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} required /></div>
                              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>{submitting ? '...' : 'OK'}</button>
                            </form>
                          </td>
                        </tr>
                      )}
                      {expandedCust === c.id && (c.payments || []).map(p => (
                        <tr key={p.id} className="row-detail">
                          <td className="col-mono" style={{ paddingLeft: 32 }}>{p.date}</td>
                          <td colSpan={3} style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>↳ Paiement</td>
                          <td className="text-right col-mono text-success">{fm(p.amount)}</td>
                          <td></td>
                          <td><button className="btn-icon btn-icon-danger" title="Supprimer le paiement" onClick={() => handleDeleteCustPayment(p.id)}>{TrashIcon}</button></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <Pagination total={totalCust} page={page} onPageChange={setPage} />
            </div>
          </div>
        </>
      )}
      {tab === 'fournisseurs' && (
        <>
          <Modal open={showSuppForm} onClose={closeSuppForm} title={editingSuppId ? 'Modifier credit fournisseur' : 'Nouveau credit fournisseur'}>
            <form onSubmit={handleSuppSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Date</label><input type="date" value={suppForm.date} onChange={e => setSuppForm({ ...suppForm, date: e.target.value })} required /></div>
                <div className="form-group"><label>Fournisseur</label>
                  <SearchableSelect
                    options={suppliers.map(s => ({ value: s.code, label: s.code }))}
                    value={suppForm.supplier}
                    onChange={v => setSuppForm({ ...suppForm, supplier: v })}
                    placeholder="Choisir ou ajouter"
                    required
                    creatable
                    onCreate={async (code) => { await addSupplier(code); }}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Designation</label><input type="text" value={suppForm.designation} onChange={e => setSuppForm({ ...suppForm, designation: e.target.value })} required /></div>
                <div className="form-group"><label>Montant total</label><input type="number" step="0.01" min="0" value={suppForm.totalAmount} onChange={e => setSuppForm({ ...suppForm, totalAmount: e.target.value })} required /></div>
                <div className="form-group"><label>Avance</label><input type="number" step="0.01" min="0" value={suppForm.advancePaid} onChange={e => setSuppForm({ ...suppForm, advancePaid: e.target.value })} /></div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-cancel" onClick={closeSuppForm}>Annuler</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>{submitting ? 'En cours...' : editingSuppId ? 'Modifier' : 'Enregistrer'}</button>
              </div>
            </form>
          </Modal>

          <div className="card-table">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Fournisseur</th><th>Designation</th><th className="text-right">Total</th><th className="text-right">Reste</th><th></th><th></th></tr>
                </thead>
                <tbody>
                  {suppCredits.length === 0 && <tr><td colSpan={7}><div className="empty-state" style={{ padding: '24px 16px' }}><div className="empty-desc">Aucune dette</div></div></td></tr>}
                  {suppCredits.map(c => (
                    <React.Fragment key={c.id}>
                      <tr>
                        <td className="col-mono">{c.date}</td>
                        <td className="col-bold"><button className="btn-link" onClick={() => openHistory('supplier', c.supplier_code)}>{c.supplier_code}</button></td>
                        <td>{c.designation}</td>
                        <td className="text-right col-mono">{fm(c.total_amount)}</td>
                        <td className={`text-right col-mono col-bold ${c.remainingBalance > 0 ? 'text-warning' : 'text-success'}`}>{fm(c.remainingBalance)}</td>
                        <td style={{ display: 'flex', gap: 4 }}>
                          {c.remainingBalance > 0 && <button className="btn btn-secondary btn-sm" onClick={() => { setPayingSupp(payingSupp === c.id ? null : c.id); setPayForm({ date: todayLocal(), amount: '' }); }}>Paiement</button>}
                          {(c.payments || []).length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setExpandedSupp(expandedSupp === c.id ? null : c.id)} title="Historique des paiements">{expandedSupp === c.id ? '▾' : '▸'} {c.payments.length}</button>}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="btn-icon" title="Modifier" onClick={() => openEditSupp(c)}>{EditIcon}</button>
                            <button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDeleteSupp(c.id)}>{TrashIcon}</button>
                          </div>
                        </td>
                      </tr>
                      {payingSupp === c.id && (
                        <tr className="row-detail">
                          <td colSpan={7}>
                            <form onSubmit={handleSuppPayment} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '4px 0' }}>
                              <div className="form-group" style={{ flex: 'none', width: 130 }}><label>Date</label><input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} required /></div>
                              <div className="form-group" style={{ flex: 'none', width: 120 }}><label>Montant</label><input type="number" step="0.01" min="0" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} required /></div>
                              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>{submitting ? '...' : 'OK'}</button>
                            </form>
                          </td>
                        </tr>
                      )}
                      {expandedSupp === c.id && (c.payments || []).map(p => (
                        <tr key={p.id} className="row-detail">
                          <td className="col-mono" style={{ paddingLeft: 32 }}>{p.date}</td>
                          <td colSpan={3} style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>↳ Paiement</td>
                          <td className="text-right col-mono text-success">{fm(p.amount)}</td>
                          <td></td>
                          <td><button className="btn-icon btn-icon-danger" title="Supprimer le paiement" onClick={() => handleDeleteSuppPayment(p.id)}>{TrashIcon}</button></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <Pagination total={totalSupp} page={page} onPageChange={setPage} />
            </div>
          </div>
        </>
      )}

      {/* History Modal */}
      <Modal open={!!historyName} onClose={closeHistory} title={`Historique — ${historyName ?? ''}`} width="720px">
        {historyLoading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement…</div>
        ) : historyItems.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Aucun crédit trouvé</div>
        ) : (
          <>
            <div className="table-wrapper" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Désignation</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Payé</th>
                    <th className="text-right">Reste</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item) => {
                    const h = item as CustomerCredit & SupplierCredit;
                    const paid = (h.advance_paid ?? 0) + (h.total_payments ?? 0);
                    return (
                      <React.Fragment key={h.id}>
                        <tr>
                          <td className="col-mono">{h.date}</td>
                          <td>{h.designation}</td>
                          <td className="text-right col-mono">{fm(h.total_amount)}</td>
                          <td className="text-right col-mono text-success">{fm(paid)}</td>
                          <td className={`text-right col-mono col-bold ${h.remainingBalance > 0 ? 'text-warning' : 'text-success'}`}>{fm(h.remainingBalance)}</td>
                          <td>
                            {(h.payments || []).length > 0 && (
                              <button className="btn btn-secondary btn-sm" onClick={() => setHistoryExpanded(historyExpanded === h.id ? null : h.id)}>
                                {historyExpanded === h.id ? '▾' : '▸'} {h.payments.length}
                              </button>
                            )}
                          </td>
                        </tr>
                        {historyExpanded === h.id && (h.payments || []).map((p: CreditPayment) => (
                          <tr key={p.id} className="row-detail">
                            <td className="col-mono" style={{ paddingLeft: 32 }}>{p.date}</td>
                            <td colSpan={2} style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>↳ Paiement</td>
                            <td className="text-right col-mono text-success">{fm(p.amount)}</td>
                            <td></td>
                            <td></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={2}>Total</td>
                    <td className="text-right col-mono">{fm(historyItems.reduce((s, c) => s + c.total_amount, 0))}</td>
                    <td className="text-right col-mono text-success">{fm(historyItems.reduce((s, c) => s + (c.advance_paid ?? 0) + (c.total_payments ?? 0), 0))}</td>
                    <td className="text-right col-mono text-warning">{fm(historyItems.reduce((s, c) => s + c.remainingBalance, 0))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
