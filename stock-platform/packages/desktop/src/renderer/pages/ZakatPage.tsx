import React, { useState, useEffect } from 'react';
import { TrashIcon } from '../components/Icons.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';
import { Modal } from '../components/Modal.js';
import { parseCents, todayLocal } from '../utils.js';

interface ZakatData {
  year: number;
  closingStockValue: number;
  closingBankBalance: number;
  closingCash: number;
  totalAssets: number;
  clientCreditDeduction: number;
  supplierCreditDeduction: number;
  zakatBase: number;
  zakatRate: number;
  zakatDue: number;
  advanceTotal: number;
  zakatRemaining: number;
  advances: Array<{ id: string; date: string; amount: number; note: string | null }>;
}

export function ZakatPage(): React.JSX.Element {
  const [year, setYear] = useState(new Date().getFullYear());
  const [cashAtClosing, setCashAtClosing] = useState('');
  const [data, setData] = useState<ZakatData | null>(null);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [advForm, setAdvForm] = useState({ date: todayLocal(), amount: '', note: '' });
  const [confirm, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const compute = () => {
    window.api.zakat.compute({ year, cashAtClosing: cashAtClosing ? parseCents(cashAtClosing, 'Caisse') : 0 })
      .then((r: unknown) => { const d = r as ZakatData; if (d && typeof d.zakatDue === 'number') setData(d); })
      .catch(() => addToast('Erreur lors du calcul de la zakat', 'error'));
  };

  useEffect(() => { const t = setTimeout(compute, 300); return () => clearTimeout(t); }, [year, cashAtClosing]);

  const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

  const handleAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!advForm.amount) { addToast('Veuillez entrer un montant', 'error'); return; }
    setSubmitting(true);
    try {
      await window.api.zakat.saveAdvance({ year, date: advForm.date, amount: parseCents(advForm.amount, 'Montant'), note: advForm.note || undefined });
      setAdvForm({ date: todayLocal(), amount: '', note: '' });
      setShowAdvanceForm(false);
      compute();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const [deleting, setDeleting] = useState(false);
  const handleDeleteAdvance = async (id: string) => {
    if (deleting) return;
    if (!await confirm('Supprimer cette avance ?')) return;
    setDeleting(true);
    try {
      await window.api.zakat.deleteAdvance(id);
      compute();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Zakat</h2>
        <div className="subtitle">Calcul annuel de la zakat — 2.5% sur les actifs nets</div>
        <div className="header-accent" />
      </div>

      <div className="page-toolbar">
        <button className="btn btn-secondary" onClick={() => setYear(y => y - 1)}>‹ {year - 1}</button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>{year}</span>
        <button className="btn btn-secondary" onClick={() => setYear(y => y + 1)}>{year + 1} ›</button>
        <div className="toolbar-spacer" />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <div className="form-group" style={{ flex: 'none', width: 180, marginBottom: 0 }}>
            <label>Caisse (cash)</label>
            <input type="number" step="0.01" min="0" value={cashAtClosing} onChange={e => setCashAtClosing(e.target.value)} placeholder="0.00" />
          </div>
          <button className="btn btn-primary" onClick={compute}>Calculer</button>
        </div>
      </div>

      {data && (
        <>
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card stagger-1">
              <div className="stat-icon amber">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 7l10-5 10 5-10 5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              </div>
              <div className="stat-label">Valeur stock</div>
              <div className="stat-value">{fm(data.closingStockValue)}</div>
            </div>
            <div className="stat-card stagger-2">
              <div className="stat-icon green">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18" /><path d="M3 10h18" /><path d="M12 3l9 7H3z" /></svg>
              </div>
              <div className="stat-label">Solde banque</div>
              <div className="stat-value">{fm(data.closingBankBalance)}</div>
            </div>
            <div className="stat-card stagger-3">
              <div className="stat-icon blue">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              </div>
              <div className="stat-label">Caisse</div>
              <div className="stat-value">{fm(data.closingCash)}</div>
            </div>
            <div className="stat-card stagger-4">
              <div className="stat-icon red">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              </div>
              <div className="stat-label">Zakat restante</div>
              <div className="stat-value" style={{ color: data.zakatRemaining > 0 ? 'var(--danger)' : 'var(--success)' }}>{fm(data.zakatRemaining)}</div>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="card">
              <div className="card-title">Détail du calcul</div>
              <table className="data-table">
                <tbody>
                  <tr><td>Total actifs</td><td className="text-right col-mono col-bold">{fm(data.totalAssets)}</td></tr>
                  <tr><td>Créances clients</td><td className="text-right col-mono text-success">+ {fm(data.clientCreditDeduction)}</td></tr>
                  <tr><td>Crédit fournisseurs</td><td className="text-right col-mono text-warning">- {fm(data.supplierCreditDeduction)}</td></tr>
                  <tr><td>Base imposable (assiette)</td><td className="text-right col-mono col-bold">{fm(data.zakatBase)}</td></tr>
                  <tr style={{ borderTop: '1px solid var(--border)' }}><td>Taux zakat</td><td className="text-right col-mono">{(data.zakatRate * 100).toFixed(1)}%</td></tr>
                  <tr><td className="col-bold">Zakat due</td><td className="text-right col-mono col-bold">{fm(data.zakatDue)}</td></tr>
                  <tr><td>Avances versées</td><td className="text-right col-mono text-success">- {fm(data.advanceTotal)}</td></tr>
                  <tr style={{ borderTop: '2px solid var(--border)' }}>
                    <td className="col-bold">Reste à payer</td>
                    <td className={`text-right col-mono col-bold ${data.zakatRemaining > 0 ? 'text-danger' : 'text-success'}`}>{fm(data.zakatRemaining)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <div className="card">
                <div className="card-title">Avances versées</div>
                {data.advances.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 16px' }}>
                    <div className="empty-desc">Aucune avance enregistrée</div>
                  </div>
                ) : (
                  <table className="data-table">
                    <tbody>
                      {data.advances.map(a => (
                        <tr key={a.id}>
                          <td className="col-mono">{a.date}</td>
                          <td className="text-right col-mono col-bold">{fm(a.amount)}</td>
                          <td className="text-muted">{a.note || '—'}</td>
                          <td><button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDeleteAdvance(a.id)}>{TrashIcon}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-secondary" onClick={() => setShowAdvanceForm(true)}>+ Ajouter avance</button>
                </div>
              </div>

              <Modal open={showAdvanceForm} onClose={() => setShowAdvanceForm(false)} title="Ajouter avance zakat">
                <form onSubmit={handleAdvance}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Date</label>
                      <input type="date" value={advForm.date} onChange={e => setAdvForm({ ...advForm, date: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Montant</label>
                      <input type="number" step="0.01" min="0" value={advForm.amount} onChange={e => setAdvForm({ ...advForm, amount: e.target.value })} required />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Note</label>
                      <input type="text" value={advForm.note} onChange={e => setAdvForm({ ...advForm, note: e.target.value })} placeholder="Optionnel" />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn btn-cancel" onClick={() => setShowAdvanceForm(false)}>Annuler</button>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'En cours...' : 'Enregistrer'}</button>
                  </div>
                </form>
              </Modal>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
