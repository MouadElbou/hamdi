import React, { useState, useEffect } from 'react';

interface MonthData {
  month: number;
  purchaseTotal: number;
  salesTotal: number;
  salesCost: number;
  salesMargin: number;
  maintenanceTotal: number;
  batteryTotal: number;
  expenseTotal: number;
  customerCreditsGiven: number;
  customerCreditsReceived: number;
  supplierCreditsReceived: number;
  supplierCreditsPaid: number;
  marginRate: number;
  totalRevenue: number;
  profit: number;
}

const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export function MonthlySummaryPage(): React.JSX.Element {
  const [year, setYear] = useState(new Date().getFullYear());
  const [months, setMonths] = useState<MonthData[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
    window.api.monthlySummary.get({ year }).then((r: unknown) => { const data = r as { months: MonthData[] }; setMonths(data?.months ?? []); }).catch(() => setLoadError(true));
  }, [year]);

  const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' DH';
  const fmp = (n: number) => (n * 100).toFixed(1) + '%';

  const totals = months.reduce(
    (acc, m) => ({
      purchaseTotal: acc.purchaseTotal + m.purchaseTotal,
      salesTotal: acc.salesTotal + m.salesTotal,
      salesMargin: acc.salesMargin + m.salesMargin,
      maintenanceTotal: acc.maintenanceTotal + m.maintenanceTotal,
      batteryTotal: acc.batteryTotal + m.batteryTotal,
      expenseTotal: acc.expenseTotal + m.expenseTotal,
      totalRevenue: acc.totalRevenue + m.totalRevenue,
      profit: acc.profit + m.profit,
      customerCreditsGiven: acc.customerCreditsGiven + (m.customerCreditsGiven || 0),
      customerCreditsReceived: acc.customerCreditsReceived + (m.customerCreditsReceived || 0),
      supplierCreditsReceived: acc.supplierCreditsReceived + (m.supplierCreditsReceived || 0),
      supplierCreditsPaid: acc.supplierCreditsPaid + (m.supplierCreditsPaid || 0),
    }),
    { purchaseTotal: 0, salesTotal: 0, salesMargin: 0, maintenanceTotal: 0, batteryTotal: 0, expenseTotal: 0, totalRevenue: 0, profit: 0, customerCreditsGiven: 0, customerCreditsReceived: 0, supplierCreditsReceived: 0, supplierCreditsPaid: 0 }
  );

  return (
    <div>
      <div className="page-header">
        <h2>Bilan mensuel</h2>
        <div className="subtitle">Synthèse de la rentabilité par mois</div>
        <div className="header-accent" />
      </div>

      <div className="page-toolbar">
        <button className="btn btn-secondary" onClick={() => setYear(y => y - 1)}>‹ {year - 1}</button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>{year}</span>
        <button className="btn btn-secondary" onClick={() => setYear(y => y + 1)}>{year + 1} ›</button>
      </div>

      {loadError && <div style={{ background: 'var(--bg-danger, #7f1d1d)', padding: '12px 16px', borderRadius: 8, marginBottom: 16, color: 'var(--text-primary)' }}>Erreur lors du chargement des données.</div>}

      <div className="card-table">
        <div className="table-wrapper" style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Mois</th>
                <th className="text-right">Achats</th>
                <th className="text-right">Ventes</th>
                <th className="text-right">Marge ventes</th>
                <th className="text-right">Taux</th>
                <th className="text-right">Maintenance</th>
                <th className="text-right">Batterie</th>
                <th className="text-right">Créd. clients</th>
                <th className="text-right">Reçu clients</th>
                <th className="text-right">Créd. fourn.</th>
                <th className="text-right">Payé fourn.</th>
                <th className="text-right">Rev. total</th>
                <th className="text-right">Dépenses</th>
                <th className="text-right">Bénéfice</th>
              </tr>
            </thead>
            <tbody>
              {months.map(m => (
                <tr key={m.month}>
                  <td className="col-bold">{MONTH_NAMES[m.month - 1]}</td>
                  <td className="text-right col-mono">{m.purchaseTotal ? fm(m.purchaseTotal) : '—'}</td>
                  <td className="text-right col-mono">{m.salesTotal ? fm(m.salesTotal) : '—'}</td>
                  <td className="text-right col-mono">{m.salesMargin ? fm(m.salesMargin) : '—'}</td>
                  <td className="text-right col-mono">{m.marginRate ? fmp(m.marginRate) : '—'}</td>
                  <td className="text-right col-mono">{m.maintenanceTotal ? fm(m.maintenanceTotal) : '—'}</td>
                  <td className="text-right col-mono">{m.batteryTotal ? fm(m.batteryTotal) : '—'}</td>
                  <td className="text-right col-mono text-danger">{m.customerCreditsGiven ? fm(m.customerCreditsGiven) : '—'}</td>
                  <td className="text-right col-mono text-success">{m.customerCreditsReceived ? fm(m.customerCreditsReceived) : '—'}</td>
                  <td className="text-right col-mono text-success">{m.supplierCreditsReceived ? fm(m.supplierCreditsReceived) : '—'}</td>
                  <td className="text-right col-mono text-danger">{m.supplierCreditsPaid ? fm(m.supplierCreditsPaid) : '—'}</td>
                  <td className="text-right col-mono col-bold">{m.totalRevenue ? fm(m.totalRevenue) : '—'}</td>
                  <td className="text-right col-mono text-danger">{m.expenseTotal ? fm(m.expenseTotal) : '—'}</td>
                  <td className={`text-right col-mono col-bold ${m.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                    {m.profit ? fm(m.profit) : '—'}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                <td className="col-bold">Total</td>
                <td className="text-right col-mono">{fm(totals.purchaseTotal)}</td>
                <td className="text-right col-mono">{fm(totals.salesTotal)}</td>
                <td className="text-right col-mono">{fm(totals.salesMargin)}</td>
                <td className="text-right col-mono">—</td>
                <td className="text-right col-mono">{fm(totals.maintenanceTotal)}</td>
                <td className="text-right col-mono">{fm(totals.batteryTotal)}</td>
                <td className="text-right col-mono text-danger">{fm(totals.customerCreditsGiven)}</td>
                <td className="text-right col-mono text-success">{fm(totals.customerCreditsReceived)}</td>
                <td className="text-right col-mono text-success">{fm(totals.supplierCreditsReceived)}</td>
                <td className="text-right col-mono text-danger">{fm(totals.supplierCreditsPaid)}</td>
                <td className="text-right col-mono col-bold">{fm(totals.totalRevenue)}</td>
                <td className="text-right col-mono text-danger">{fm(totals.expenseTotal)}</td>
                <td className={`text-right col-mono col-bold ${totals.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {fm(totals.profit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
