import React, { useEffect, useState } from 'react';

interface LowStockAlert {
  id: string;
  designation: string;
  category: string;
  remaining: number;
}

interface UnpaidCredit {
  id: string;
  name: string;
  designation: string;
  totalAmount: number;
  remainingBalance: number;
  date: string;
}

type Tab = 'stock' | 'customer-credits' | 'supplier-credits';

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

export function NotificationsPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('stock');
  const [lowStock, setLowStock] = useState<LowStockAlert[]>([]);
  const [unpaidCustomer, setUnpaidCustomer] = useState<UnpaidCredit[]>([]);
  const [unpaidSupplier, setUnpaidSupplier] = useState<UnpaidCredit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      window.api.stock.lowStockAlerts().then((r: unknown) => setLowStock(Array.isArray(r) ? r as LowStockAlert[] : [])).catch(() => setLowStock([])),
      window.api.notifications.unpaidCustomerCredits().then((r: unknown) => setUnpaidCustomer(Array.isArray(r) ? r as UnpaidCredit[] : [])).catch(() => setUnpaidCustomer([])),
      window.api.notifications.unpaidSupplierCredits().then((r: unknown) => setUnpaidSupplier(Array.isArray(r) ? r as UnpaidCredit[] : [])).catch(() => setUnpaidSupplier([])),
    ]).finally(() => setLoading(false));
  }, []);

  const stockCount = lowStock.length;
  const custCount = unpaidCustomer.length;
  const suppCount = unpaidSupplier.length;

  return (
    <div>
      <div className="page-header">
        <h2>Notifications</h2>
        <div className="subtitle">Alertes de stock faible et crédits impayés</div>
        <div className="header-accent" />
      </div>

      <div className="credits-bar">
        <div className="credits-tabs">
          <button className={`credits-tab ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>
            Stock faible {stockCount > 0 && <span className="badge">{stockCount}</span>}
          </button>
          <button className={`credits-tab ${tab === 'customer-credits' ? 'active' : ''}`} onClick={() => setTab('customer-credits')}>
            Crédits clients impayés {custCount > 0 && <span className="badge">{custCount}</span>}
          </button>
          <button className={`credits-tab ${tab === 'supplier-credits' ? 'active' : ''}`} onClick={() => setTab('supplier-credits')}>
            Crédits fournisseurs impayés {suppCount > 0 && <span className="badge">{suppCount}</span>}
          </button>
        </div>
      </div>

      {loading && <div className="empty-state">Chargement…</div>}

      {!loading && tab === 'stock' && (
        <div className="card-table">
          {stockCount === 0 ? (
            <div className="empty-state">Aucune alerte de stock faible</div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Désignation</th>
                    <th>Catégorie</th>
                    <th className="text-right">Restant</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map(a => (
                    <tr key={a.id}>
                      <td className="col-bold">{a.designation}</td>
                      <td>{a.category}</td>
                      <td className={`text-right col-mono col-bold ${a.remaining <= 2 ? 'text-danger' : 'text-warning'}`}>{a.remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'customer-credits' && (
        <div className="card-table">
          {custCount === 0 ? (
            <div className="empty-state">Aucun crédit client impayé</div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Désignation</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Reste à payer</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidCustomer.map(c => (
                    <tr key={c.id}>
                      <td className="col-mono">{c.date}</td>
                      <td className="col-bold">{c.name}</td>
                      <td>{c.designation}</td>
                      <td className="text-right col-mono">{fm(c.totalAmount)}</td>
                      <td className="text-right col-mono col-bold text-danger">{fm(c.remainingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td colSpan={4} className="text-right">Total impayé</td>
                    <td className="text-right col-mono text-danger">{fm(unpaidCustomer.reduce((s, c) => s + c.remainingBalance, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'supplier-credits' && (
        <div className="card-table">
          {suppCount === 0 ? (
            <div className="empty-state">Aucun crédit fournisseur impayé</div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Fournisseur</th>
                    <th>Désignation</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Reste à payer</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidSupplier.map(c => (
                    <tr key={c.id}>
                      <td className="col-mono">{c.date}</td>
                      <td className="col-bold">{c.name}</td>
                      <td>{c.designation}</td>
                      <td className="text-right col-mono">{fm(c.totalAmount)}</td>
                      <td className="text-right col-mono col-bold text-danger">{fm(c.remainingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td colSpan={4} className="text-right">Total impayé</td>
                    <td className="text-right col-mono text-danger">{fm(unpaidSupplier.reduce((s, c) => s + c.remainingBalance, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
