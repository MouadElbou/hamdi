import React, { Suspense } from 'react';
import Link from 'next/link';
import { CatalogPageWrapper } from '@/components/CatalogPageWrapper';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Catalogue — HAMDI PC',
  description: 'Écrans, batteries, chargeurs, claviers et pièces détachées pour PC portable. Filtrez par catégorie, marque et prix.',
};

export default function CataloguePage() {
  return (
    <section>
      {/* header band */}
      <div className="relative bg-surface-container-low border-b border-outline-variant/50 overflow-hidden">
        <div className="dot-grid absolute inset-0 opacity-70" />
        <div className="max-w-screen-2xl mx-auto px-6 md:px-8 py-14 relative">
          <nav className="flex items-center gap-2 font-label text-xs uppercase tracking-widest text-on-surface-variant mb-4">
            <Link href="/" className="hover:text-primary">Accueil</Link>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="text-primary">Catalogue</span>
          </nav>
          <h1 className="text-4xl md:text-6xl font-black font-headline text-on-surface tracking-tighter">NOTRE CATALOGUE</h1>
          <p className="text-on-surface-variant font-body mt-3 max-w-xl">Toutes les pièces détachées &amp; accessoires pour votre PC portable. Filtrez par catégorie, marque et prix — commande simple par WhatsApp.</p>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 md:px-8">
        <Suspense fallback={<div style={{ minHeight: '400px' }} />}>
          <CatalogPageWrapper />
        </Suspense>
      </div>
    </section>
  );
}
