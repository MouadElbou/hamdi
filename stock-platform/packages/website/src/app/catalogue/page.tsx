import React, { Suspense } from 'react';
import { CatalogPageWrapper } from '@/components/CatalogPageWrapper';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Catalogue — Hamdi PC',
  description: 'Parcourez notre catalogue complet de produits informatiques, téléphones, accessoires et composants.',
};

export default function CataloguePage() {
  return (
    <section className="catalog-page">
      <div className="catalog-page-header">
        <div className="container">
          <h1 className="catalog-page-title">Notre Catalogue</h1>
          <p className="catalog-page-subtitle">
            Parcourez notre sélection complète de produits informatiques, téléphones et accessoires.
          </p>
        </div>
      </div>
      <div className="container">
        <Suspense fallback={<div style={{ minHeight: '400px' }} />}>
          <CatalogPageWrapper />
        </Suspense>
      </div>
    </section>
  );
}
