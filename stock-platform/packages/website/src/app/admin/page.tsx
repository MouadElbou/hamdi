'use client';

import React, { useEffect, useState } from 'react';
import { adminGet } from '@/lib/admin-api';
import { SkeletonLine, SkeletonTable } from './components/Skeleton';

/* Inline SVG icons — same as desktop */
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

interface CategorySummary {
  category: string;
  totalValue: number;
  totalLots: number;
  totalRemaining: number;
}

interface SummaryResponse {
  summary: CategorySummary[];
  grandTotal: number;
}

const fm = (c: number) =>
  (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
const fmInt = (n: number) => n.toLocaleString('fr-FR');

export default function AdminDashboardPage(): React.JSX.Element {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    adminGet<SummaryResponse>('/stock/summary/by-category', { signal: ctrl.signal })
      .then((res) => {
        if (mounted) setData(res);
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) {
          console.error('[Dashboard load]', err);
          if (mounted) setLoadError(true);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, []);

  const totalCategories = data ? data.summary.length : 0;
  const totalLots = data ? data.summary.reduce((s, c) => s + c.totalLots, 0) : 0;
  const totalUnits = data ? data.summary.reduce((s, c) => s + c.totalRemaining, 0) : 0;
  const lowStockCategories = data
    ? data.summary.filter((c) => c.totalRemaining <= 10)
    : [];

  return (
    <div>
      <div className="page-header">
        <h2>Tableau de bord</h2>
        <span className="subtitle">Vue d&apos;ensemble de l&apos;activite</span>
        <div className="header-accent" />
      </div>

      {loadError && (
        <div
          style={{
            background: 'var(--bg-danger, #7f1d1d)',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            color: 'var(--text-primary)',
          }}
        >
          Erreur lors du chargement des données du tableau de bord.
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card stagger-1">
          <div className="stat-icon amber"><IconStock /></div>
          <div className="stat-label">Valeur du stock</div>
          <div className="stat-value">
            {loading ? <SkeletonLine width="70%" height={20} /> : data ? fm(data.grandTotal) : '—'}
          </div>
        </div>
        <div className="stat-card stagger-2">
          <div className="stat-icon green"><IconTrend /></div>
          <div className="stat-label">Categories</div>
          <div className="stat-value">
            {loading ? <SkeletonLine width="60%" height={20} /> : data ? fmInt(totalCategories) : '—'}
          </div>
        </div>
        <div className="stat-card stagger-3">
          <div className="stat-icon blue"><IconCoins /></div>
          <div className="stat-label">Lots en stock</div>
          <div className="stat-value">
            {loading ? <SkeletonLine width="65%" height={20} /> : data ? fmInt(totalLots) : '—'}
          </div>
        </div>
        <div className="stat-card stagger-4">
          <div className="stat-icon red"><IconWrench /></div>
          <div className="stat-label">Unites en stock</div>
          <div className="stat-value">
            {loading ? <SkeletonLine width="55%" height={20} /> : data ? fmInt(totalUnits) : '—'}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-title">Resume par categorie</div>
          {loading ? (
            <SkeletonTable rows={5} cols={4} />
          ) : data && data.summary.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Categorie</th>
                  <th className="text-right">Valeur</th>
                  <th className="text-right">Lots</th>
                  <th className="text-right">Unites</th>
                </tr>
              </thead>
              <tbody>
                {data.summary.map((row) => (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    <td className="text-right col-mono">{fm(row.totalValue)}</td>
                    <td className="text-right col-mono">{fmInt(row.totalLots)}</td>
                    <td className="text-right col-mono">{fmInt(row.totalRemaining)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td className="col-bold">Total</td>
                  <td className="text-right col-mono col-bold">{fm(data.grandTotal)}</td>
                  <td className="text-right col-mono col-bold">{fmInt(totalLots)}</td>
                  <td className="text-right col-mono col-bold">{fmInt(totalUnits)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <div className="empty-title">Aucune donnee</div>
              <div className="empty-desc">Les statistiques apparaitront ici.</div>
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--warning)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: 6 }}
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Alertes stock
            </div>
            {lowStockCategories.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Categorie</th>
                    <th className="text-right">Unites restantes</th>
                    <th className="text-right">Lots</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockCategories.map((a) => (
                    <tr key={a.category}>
                      <td>{a.category}</td>
                      <td
                        className="text-right col-mono"
                        style={{
                          color: a.totalRemaining <= 2 ? 'var(--danger)' : 'var(--warning)',
                        }}
                      >
                        {a.totalRemaining}
                      </td>
                      <td className="text-right col-mono">{a.totalLots}</td>
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
            <div className="card-title">Repartition du stock</div>
            {data && data.summary.length > 0 ? (
              <div style={{ padding: '16px' }}>
                {data.summary.map((row) => {
                  const pct = data.grandTotal > 0 ? (row.totalValue / data.grandTotal) * 100 : 0;
                  return (
                    <div key={row.category} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem' }}>
                        <span>{row.category}</span>
                        <span className="col-mono">{pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--border, #333)' }}>
                        <div
                          style={{
                            height: '100%',
                            borderRadius: 3,
                            width: `${pct}%`,
                            background: 'var(--accent, #3b82f6)',
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '24px 16px' }}>
                <div className="empty-desc">Pas de donnees disponibles</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
