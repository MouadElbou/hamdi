'use client';

import React, { useEffect, useRef, useState } from 'react';
import { adminGet, adminPost } from '@/lib/admin-api';
import { Modal } from '../components/Modal';
import Pagination, { PAGE_SIZE } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { SearchableSelect } from '../components/SearchableSelect';

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

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

/* ── Types ── */
interface CreditPayment { id: string; date: string; amount: number; }
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
type Tab = 'clients' | 'fournisseurs';

export default function CreditsPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('clients');
  const [custCredits, setCustCredits] = useState<CustomerCredit[]>([]);
  const [totalCust, setTotalCust] = useState(0);
  const [suppCredits, setSuppCredits] = useState<SupplierCredit[]>([]);
  const [totalSupp, setTotalSupp] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCustForm, setShowCustForm] = useState(false);
  const [showSuppForm, setShowSuppForm] = useState(false);
  const [payingCust, setPayingCust] = useState<string | null>(null);
  const [payingSupp, setPayingSupp] = useState<string | null>(null);
  const [expandedCust, setExpandedCust] = useState<string | null>(null);
  const [expandedSupp, setExpandedSupp] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ date: todayLocal(), amount: '' });

  const [custForm, setCustForm] = useState({ date: todayLocal(), customerName: '', designation: '', quantity: '', unitPrice: '', advancePaid: '' });
  const [suppForm, setSuppForm] = useState({ date: todayLocal(), supplier: '', designation: '', totalAmount: '', advancePaid: '' });
  const [clientSuggestions, setClientSuggestions] = useState<Array<{ id: string; name: string }>>([]);
  const clientSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suppliers, setSuppliers] = useState<Array<{ code: string }>>([]);
  const [, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => () => { if (clientSearchTimer.current) clearTimeout(clientSearchTimer.current); }, []);

  useEffect(() => {
    adminGet<Array<{ code: string }>>('/reference/suppliers').then(setSuppliers).catch(() => {});
  }, []);

  const resetCustForm = () => setCustForm({ date: todayLocal(), customerName: '', designation: '', quantity: '', unitPrice: '', advancePaid: '' });
  const resetSuppForm = () => setSuppForm({ date: todayLocal(), supplier: '', designation: '', totalAmount: '', advancePaid: '' });

  const openCreateCust = () => { resetCustForm(); setShowCustForm(true); };
  const closeCustForm = () => { setShowCustForm(false); resetCustForm(); };

  const openCreateSupp = () => { resetSuppForm(); setShowSuppForm(true); };
  const closeSuppForm = () => { setShowSuppForm(false); resetSuppForm(); };

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    adminGet<{ items: CustomerCredit[]; total: number }>('/customer-credits?' + params.toString())
      .then((data) => {
        setCustCredits(data.items || []);
        setTotalCust(data.total || 0);
      })
      .catch(() => addToast('Erreur lors du chargement des crédits clients', 'error'));
    adminGet<{ items: SupplierCredit[]; total: number }>('/supplier-credits?' + params.toString())
      .then((data) => {
        setSuppCredits(data.items || []);
        setTotalSupp(data.total || 0);
      })
      .catch(() => addToast('Erreur lors du chargement des crédits fournisseurs', 'error'));
  };
  useEffect(load, [search, page]);

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
      await adminPost('/customer-credits', payload);
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
      await adminPost('/supplier-credits', payload);
      closeSuppForm();
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !payingCust || !payForm.amount) return;
    setSubmitting(true);
    try {
      await adminPost('/customer-credits/' + payingCust + '/payments', { date: payForm.date, amount: parseCents(payForm.amount, 'Montant') });
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
    if (submitting || !payingSupp || !payForm.amount) return;
    setSubmitting(true);
    try {
      await adminPost('/supplier-credits/' + payingSupp + '/payments', { date: payForm.date, amount: parseCents(payForm.amount, 'Montant') });
      setPayingSupp(null);
      setPayForm({ date: todayLocal(), amount: '' });
      load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors du paiement', 'error');
    } finally {
      setSubmitting(false);
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
          <Modal open={showCustForm} onClose={closeCustForm} title="Nouveau credit client">
            <form onSubmit={handleCustSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Date</label><input type="date" value={custForm.date} onChange={e => setCustForm({ ...custForm, date: e.target.value })} required /></div>
                <div className="form-group"><label>Client</label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" value={custForm.customerName} onChange={e => {
                      const v = e.target.value;
                      setCustForm({ ...custForm, customerName: v });
                      if (clientSearchTimer.current) clearTimeout(clientSearchTimer.current);
                      if (v.length >= 2) {
                        clientSearchTimer.current = setTimeout(() => {
                          adminGet<Array<{ id: string; name: string }>>('/clients?search=' + encodeURIComponent(v))
                            .then(r => setClientSuggestions(r))
                            .catch(err => console.error('[Load]', err));
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
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>{submitting ? 'En cours...' : 'Enregistrer'}</button>
              </div>
            </form>
          </Modal>

          <div className="card-table">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Client</th><th>Designation</th><th className="text-right">Total</th><th className="text-right">Reste</th><th></th></tr>
                </thead>
                <tbody>
                  {custCredits.length === 0 && <tr><td colSpan={6}><div className="empty-state" style={{ padding: '24px 16px' }}><div className="empty-desc">Aucune creance</div></div></td></tr>}
                  {custCredits.map(c => (
                    <React.Fragment key={c.id}>
                      <tr>
                        <td className="col-mono">{c.date}</td>
                        <td className="col-bold">{c.customer_name}</td>
                        <td>{c.designation}</td>
                        <td className="text-right col-mono">{fm(c.total_amount)}</td>
                        <td className={`text-right col-mono col-bold ${c.remainingBalance > 0 ? 'text-warning' : 'text-success'}`}>{fm(c.remainingBalance)}</td>
                        <td style={{ display: 'flex', gap: 4 }}>
                          {c.remainingBalance > 0 && <button className="btn btn-secondary btn-sm" onClick={() => { setPayingCust(payingCust === c.id ? null : c.id); setPayForm({ date: todayLocal(), amount: '' }); }}>Paiement</button>}
                          {(c.payments || []).length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setExpandedCust(expandedCust === c.id ? null : c.id)} title="Historique des paiements">{expandedCust === c.id ? '▾' : '▸'} {c.payments.length}</button>}
                        </td>
                      </tr>
                      {payingCust === c.id && (
                        <tr className="row-detail">
                          <td colSpan={6}>
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

      {/* Supplier Credits Tab */}
      {tab === 'fournisseurs' && (
        <>
          <Modal open={showSuppForm} onClose={closeSuppForm} title="Nouveau credit fournisseur">
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
                    onCreate={async (code) => { setSuppliers(prev => [...prev, { code }]); }}
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
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>{submitting ? 'En cours...' : 'Enregistrer'}</button>
              </div>
            </form>
          </Modal>

          <div className="card-table">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Fournisseur</th><th>Designation</th><th className="text-right">Total</th><th className="text-right">Reste</th><th></th></tr>
                </thead>
                <tbody>
                  {suppCredits.length === 0 && <tr><td colSpan={6}><div className="empty-state" style={{ padding: '24px 16px' }}><div className="empty-desc">Aucune dette</div></div></td></tr>}
                  {suppCredits.map(c => (
                    <React.Fragment key={c.id}>
                      <tr>
                        <td className="col-mono">{c.date}</td>
                        <td className="col-bold">{c.supplier_code}</td>
                        <td>{c.designation}</td>
                        <td className="text-right col-mono">{fm(c.total_amount)}</td>
                        <td className={`text-right col-mono col-bold ${c.remainingBalance > 0 ? 'text-warning' : 'text-success'}`}>{fm(c.remainingBalance)}</td>
                        <td style={{ display: 'flex', gap: 4 }}>
                          {c.remainingBalance > 0 && <button className="btn btn-secondary btn-sm" onClick={() => { setPayingSupp(payingSupp === c.id ? null : c.id); setPayForm({ date: todayLocal(), amount: '' }); }}>Paiement</button>}
                          {(c.payments || []).length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setExpandedSupp(expandedSupp === c.id ? null : c.id)} title="Historique des paiements">{expandedSupp === c.id ? '▾' : '▸'} {c.payments.length}</button>}
                        </td>
                      </tr>
                      {payingSupp === c.id && (
                        <tr className="row-detail">
                          <td colSpan={6}>
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
    </div>
  );
}
