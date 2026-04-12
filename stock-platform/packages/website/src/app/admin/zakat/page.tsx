'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { adminGet, adminPost, adminPut } from '@/lib/admin-api';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

/* ── Inline helpers ─────────────────────────────────────────────── */

const TrashIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);
void TrashIcon; // defined for parity – delete endpoint not yet available

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseCents(v: string): number {
  const n = parseFloat(v);
  if (isNaN(n) || n < 0) throw new Error('Montant invalide');
  return Math.round(n * 100);
}

const fm = (c: number) =>
  (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

/* ── Types ──────────────────────────────────────────────────────── */

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

interface BackendZakatResponse {
  id: string;
  year: number;
  closingStockValue: number;
  closingBankBalance: number;
  closingCash: number;
  creditDeduction: number;
  version: number;
  totalAssets: number;
  zakatBase: number;
  zakatDue: number;
  advanceTotal: number;
  zakatRemaining: number;
  advances: Array<{ id: string; date: string; amount: number; note: string | null }>;
}

function mapResponse(raw: BackendZakatResponse): ZakatData {
  return {
    year: raw.year,
    closingStockValue: raw.closingStockValue,
    closingBankBalance: raw.closingBankBalance,
    closingCash: raw.closingCash,
    totalAssets: raw.totalAssets,
    clientCreditDeduction: 0,
    supplierCreditDeduction: raw.creditDeduction,
    zakatBase: raw.zakatBase,
    zakatRate: 0.025,
    zakatDue: raw.zakatDue,
    advanceTotal: raw.advanceTotal,
    zakatRemaining: raw.zakatRemaining,
    advances: raw.advances.map(a => ({ ...a, date: String(a.date).slice(0, 10) })),
  };
}

/* ── Page ───────────────────────────────────────────────────────── */

export default function ZakatPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [cashAtClosing, setCashAtClosing] = useState('');
  const [data, setData] = useState<ZakatData | null>(null);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [advForm, setAdvForm] = useState({ date: todayLocal(), amount: '', note: '' });
  const [, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const versionRef = useRef<number | null>(null);

  /* Load existing snapshot for the year */
  const loadYear = useCallback(async (y: number) => {
    try {
      const raw = await adminGet<BackendZakatResponse>('/zakat/' + y);
      versionRef.current = raw.version;
      setData(mapResponse(raw));
    } catch {
      versionRef.current = null;
      setData(null);
    }
  }, []);

  useEffect(() => { loadYear(year); }, [year, loadYear]);

  /* Compute: save snapshot then reload */
  const compute = async () => {
    try {
      const { closingStockValue } = await adminGet<{ closingStockValue: number }>('/zakat/compute-stock-value');
      const cashCents = cashAtClosing ? parseCents(cashAtClosing) : 0;

      const putBody: Record<string, unknown> = {
        year,
        closingDate: todayLocal(),
        closingStockValue,
        closingBankBalance: data?.closingBankBalance ?? 0,
        closingCash: cashCents,
        creditDeduction: data?.supplierCreditDeduction ?? 0,
      };
      if (versionRef.current !== null) {
        putBody.version = versionRef.current;
      }

      await adminPut('/zakat', putBody);
      await loadYear(year);
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors du calcul de la zakat', 'error');
    }
  };

  /* Save advance payment */
  const handleAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!advForm.amount) { addToast('Veuillez entrer un montant', 'error'); return; }
    setSubmitting(true);
    try {
      await adminPost('/zakat/' + year + '/advances', {
        date: advForm.date,
        amount: parseCents(advForm.amount),
      });
      setAdvForm({ date: todayLocal(), amount: '', note: '' });
      setShowAdvanceForm(false);
      await loadYear(year);
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
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
