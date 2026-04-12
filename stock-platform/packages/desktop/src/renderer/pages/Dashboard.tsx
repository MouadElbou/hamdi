import React, { useEffect, useState } from 'react';
import { SkeletonLine, SkeletonTable } from '../components/Skeleton.js';

/* Inline SVG icons for stat cards */
const IconStock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
const IconTrend = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconCoins = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v12" /><path d="M15.5 9.5c-.8-1-2-1.5-3.5-1.5-2.2 0-4 1.3-4 3s1.8 3 4 3c2.2 0 4 1.3 4 3s-1.8 3-4 3c-1.5 0-2.7-.5-3.5-1.5" />
  </svg>
);
const IconWrench = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

interface DashboardStats {
  stockValue: number;
  monthlySales: number;
  monthlyMargin: number;
  monthlyMaintenance: number;
  monthlyExpenses: number;
  lowStockAlerts: number;
  activeCredits: number;
}

interface LowStockAlert {
  id: string;
  designation: string;
  category: string;
  remaining: number;
}

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

export function Dashboard({ onNavigate }: { onNavigate?: (page: string) => void }): React.JSX.Element {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      window.api.dashboard.stats().then((r: unknown) => { const d = r as DashboardStats;
        if (mounted && d && typeof d.stockValue === 'number') setStats(d);
      }).catch(err => { console.error('[Load]', err); if (mounted) setLoadError(true); }),
      window.api.stock.lowStockAlerts().then((r: unknown) => { const items = r as LowStockAlert[];
        if (mounted && Array.isArray(items)) setLowStockItems(items);
      }).catch(err => { console.error('[Load]', err); if (mounted) setLoadError(true); })
    ]).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Tableau de bord</h2>
        <span className="subtitle">Vue d'ensemble de l'activite</span>
        <div className="header-accent" />
      </div>

      {loadError && <div style={{ background: 'var(--bg-danger, #7f1d1d)', padding: '12px 16px', borderRadius: 8, marginBottom: 16, color: 'var(--text-primary)' }}>Erreur lors du chargement des données du tableau de bord.</div>}

      <div className="stats-grid">
        <div className="stat-card stagger-1">
          <div className="stat-icon amber"><IconStock /></div>
          <div className="stat-label">Valeur du stock</div>
          <div className="stat-value">{loading ? <SkeletonLine width="70%" height={20} /> : stats ? fm(stats.stockValue) : '—'}</div>
        </div>
        <div className="stat-card stagger-2">
          <div className="stat-icon green"><IconTrend /></div>
          <div className="stat-label">Ventes du mois</div>
          <div className="stat-value">{loading ? <SkeletonLine width="60%" height={20} /> : stats ? fm(stats.monthlySales) : '—'}</div>
        </div>
        <div className="stat-card stagger-3">
          <div className="stat-icon blue"><IconCoins /></div>
          <div className="stat-label">Marge du mois</div>
          <div className="stat-value">{loading ? <SkeletonLine width="65%" height={20} /> : stats ? fm(stats.monthlyMargin) : '—'}</div>
        </div>
        <div className="stat-card stagger-4">
          <div className="stat-icon red"><IconWrench /></div>
          <div className="stat-label">Maintenance du mois</div>
          <div className="stat-value">{loading ? <SkeletonLine width="55%" height={20} /> : stats ? fm(stats.monthlyMaintenance) : '—'}</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-title">Resume du mois</div>
          {loading ? (
            <SkeletonTable rows={5} cols={2} />
          ) : stats ? (
            <table className="data-table">
              <tbody>
                <tr><td>Ventes totales</td><td className="text-right col-mono col-bold">{fm(stats.monthlySales)}</td></tr>
                <tr><td>Marge brute</td><td className="text-right col-mono text-success">{fm(stats.monthlyMargin)}</td></tr>
                <tr><td>Maintenance</td><td className="text-right col-mono text-success">{fm(stats.monthlyMaintenance)}</td></tr>
                <tr><td>Depenses</td><td className="text-right col-mono text-danger">- {fm(stats.monthlyExpenses)}</td></tr>
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td className="col-bold">Resultat net</td>
                  <td className={`text-right col-mono col-bold ${stats.monthlyMargin + stats.monthlyMaintenance - stats.monthlyExpenses >= 0 ? 'text-success' : 'text-danger'}`}>
                    {fm(stats.monthlyMargin + stats.monthlyMaintenance - stats.monthlyExpenses)}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
              </div>
              <div className="empty-title">Aucune donnee</div>
              <div className="empty-desc">Les statistiques apparaitront ici.</div>
            </div>
          )}
        </div>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Alertes stock
            </div>
            {lowStockItems.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Lot</th><th>Categorie</th><th className="text-right">Restant</th></tr></thead>
                <tbody>
                  {lowStockItems.map(a => (
                    <tr key={a.id}>
                      <td>{a.designation}</td>
                      <td className="text-muted">{a.category}</td>
                      <td className="text-right col-mono" style={{ color: a.remaining <= 2 ? 'var(--danger)' : 'var(--warning)' }}>{a.remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state" style={{ padding: '24px 16px' }}>
                <div className="empty-desc">Aucune alerte pour le moment</div>
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-title">Credits en cours</div>
            {stats && stats.activeCredits > 0 ? (
              <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="badge" style={{ color: 'var(--warning)' }}>{stats.activeCredits} credit(s) clients en attente</span>
                {onNavigate && <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('credits')}>Voir les credits</button>}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '24px 16px' }}>
                <div className="empty-desc">Pas de credits en attente</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
