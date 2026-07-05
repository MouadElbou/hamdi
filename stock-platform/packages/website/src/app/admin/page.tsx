'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminGet } from '@/lib/admin-api';
import { SkeletonLine } from './components/Skeleton';

interface Product {
  id: string;
  category: string;
  published: boolean;
}

export default function AdminDashboardPage(): React.JSX.Element {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();
    adminGet<{ products: Product[] }>('/admin/products', { signal: ctrl.signal })
      .then((r) => { if (mounted) setProducts(r.products || []); })
      .catch(() => { if (!ctrl.signal.aborted && mounted) setLoadError(true); });
    return () => { mounted = false; ctrl.abort(); };
  }, []);

  const loading = products === null && !loadError;
  const total = products?.length ?? 0;
  const published = products?.filter((p) => p.published).length ?? 0;
  const categories = products ? new Set(products.map((p) => p.category)).size : 0;

  return (
    <div>
      <div className="page-header">
        <h2>Tableau de bord</h2>
        <span className="subtitle">Catalogue du site</span>
        <div className="header-accent" />
      </div>

      <div className="stats-grid">
        <div className="stat-card stagger-1">
          <div className="stat-label">Produits</div>
          <div className="stat-value">{loading ? <SkeletonLine width="50%" height={20} /> : total}</div>
        </div>
        <div className="stat-card stagger-2">
          <div className="stat-label">Publiés sur le site</div>
          <div className="stat-value">{loading ? <SkeletonLine width="50%" height={20} /> : published}</div>
        </div>
        <div className="stat-card stagger-3">
          <div className="stat-label">Catégories</div>
          <div className="stat-value">{loading ? <SkeletonLine width="50%" height={20} /> : categories}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Gestion du catalogue</div>
        <div style={{ padding: 16 }}>
          <p style={{ marginBottom: 16, color: 'var(--text-secondary, #9ca3af)' }}>
            Ajoutez, modifiez et publiez les produits affichés sur le site (nom, prix, photo, disponibilité).
          </p>
          <Link href="/admin/products" className="btn btn-primary">Gérer les produits</Link>
        </div>
      </div>
    </div>
  );
}
