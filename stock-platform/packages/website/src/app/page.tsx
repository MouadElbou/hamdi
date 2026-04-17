import React from 'react';
import type { Metadata } from 'next';
import { HeroBanner } from '@/components/HeroBanner';
import { CategoryStrip } from '@/components/CategoryGrid';
import { ProductSection } from '@/components/ProductSection';
import { fetchCatalog } from '@/lib/api';

export const metadata: Metadata = {
  title: 'HAMDI PC — Informatique & High-Tech a Oujda',
  description: 'Vente de materiel informatique, PC portables, ecrans, composants et accessoires au meilleur prix. Livraison partout au Maroc.',
};

/* ------------------------------------------------------------------ */
/*  Hardcoded demo products so the home page renders without a backend */
/* ------------------------------------------------------------------ */

const nouveautes = [
  {
    lotId: 'demo-001',
    designation: 'HP EliteBook 840 G9 i5-1245U 16Go 256Go SSD 14" FHD Tactile',
    category: 'PC Portable',
    supplier: 'Hamdi PC',
    remainingQuantity: 8,
    targetResalePrice: 435000,
  },
  {
    lotId: 'demo-002',
    designation: 'Dell Latitude 7420 i7-1185G7 16Go 512Go SSD 14" FHD',
    category: 'PC Portable',
    supplier: 'Hamdi PC',
    remainingQuantity: 5,
    targetResalePrice: 435000,
  },
  {
    lotId: 'demo-003',
    designation: 'Lenovo ThinkPad E14 Gen 5 i7-1355U 16Go 512Go',
    category: 'PC Portable',
    supplier: 'Hamdi PC',
    remainingQuantity: 3,
    targetResalePrice: 679000,
  },
  {
    lotId: 'demo-004',
    designation: 'HP ZBook Fury 15 G8 i7-11800H 32Go 1To NVIDIA T1200',
    category: 'Station De Travail',
    supplier: 'Hamdi PC',
    remainingQuantity: 4,
    targetResalePrice: 795000,
  },
  {
    lotId: 'demo-005',
    designation: 'Dell OptiPlex 3020 SFF i5-4590 8Go 256Go SSD',
    category: 'PC De Bureau',
    supplier: 'Hamdi PC',
    remainingQuantity: 12,
    targetResalePrice: 150000,
  },
  {
    lotId: 'demo-006',
    designation: 'HP EliteOne 800 G6 AIO i5-10500 16Go 256Go 24" FHD',
    category: 'PC De Bureau',
    supplier: 'Hamdi PC',
    remainingQuantity: 2,
    targetResalePrice: 630000,
  },
  {
    lotId: 'demo-007',
    designation: 'AOC CQ27G2 27" QHD 144Hz VA Incurve',
    category: 'Ecran',
    supplier: 'Hamdi PC',
    remainingQuantity: 6,
    targetResalePrice: 270000,
  },
  {
    lotId: 'demo-008',
    designation: 'HP EliteDisplay E272q 27" QHD IPS',
    category: 'Ecran',
    supplier: 'Hamdi PC',
    remainingQuantity: 9,
    targetResalePrice: 129900,
  },
];

export default async function HomePage() {
  // Try API first, fall back to demo data
  let newItems = nouveautes;

  try {
    const apiNew = await fetchCatalog({ page: 1, limit: 8, inStockOnly: true });
    if (apiNew.items.length > 0) {
      newItems = apiNew.items.map(i => ({
        lotId: i.lotId, designation: i.designation, category: i.category,
        supplier: i.supplier, remainingQuantity: i.remainingQuantity,
        targetResalePrice: i.targetResalePrice ?? 0,
      }));
    }
  } catch {
    // API unavailable -- use demo data (already set above)
  }

  return (
    <>
      <HeroBanner />

      <CategoryStrip />

      <ProductSection
        id="nouveautes"
        label="Nouveau"
        title="Nouveautes"
        items={newItems}
      />

      {/* Newsletter / Bento Section (matching example.html) */}
      <section className="py-24 px-8 max-w-screen-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-8 bg-primary-container rounded-xl p-12 text-on-primary flex flex-col justify-center">
            <h2 className="text-4xl font-black font-headline tracking-tighter mb-4 uppercase">Rejoignez Le Cercle Prive</h2>
            <p className="text-on-primary-container text-lg max-w-md mb-8">Acces exclusif aux pre-lancements hardware et aux notes techniques de l&apos;equipe HAMDI PC.</p>
            <div className="flex max-w-md gap-4">
              <input
                className="bg-white/10 border-white/20 rounded-xl px-6 py-4 flex-grow font-label text-white placeholder:text-white/40 focus:ring-2 focus:ring-white outline-none"
                placeholder="Votre email"
                type="email"
              />
              <button className="bg-white text-primary px-8 py-4 rounded-xl font-headline font-bold uppercase tracking-tight hover:bg-on-primary-container transition-colors">
                Envoyer
              </button>
            </div>
          </div>
          <div className="md:col-span-4 bg-tertiary-container rounded-xl p-12 text-white relative overflow-hidden flex items-center justify-center">
            <span className="material-symbols-outlined text-[120px] opacity-20 absolute -right-10 -bottom-10" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
            <div className="text-center">
              <p className="font-label text-on-tertiary-container uppercase tracking-widest mb-2">Support</p>
              <h3 className="text-3xl font-black font-headline">24/7 PRO <br/>ASSIST</h3>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
