'use client';

import React from 'react';
import { ProductCard } from './ProductCard';

interface StockItem {
  lotId: string;
  designation: string;
  category: string;
  supplier: string;
  remainingQuantity: number;
  targetResalePrice: number | null;
}

interface ProductSectionProps {
  id: string;
  label: string;
  title: string;
  items: StockItem[];
  layout?: 'row' | 'grid';
  showArrows?: boolean;
}

export function ProductSection({ id, title, items }: ProductSectionProps): React.JSX.Element {
  return (
    <section className="py-24 bg-surface" id={id}>
      <div className="max-w-screen-2xl mx-auto px-8">
        <div className="mb-16">
          <h2 className="text-4xl font-black font-headline text-on-surface tracking-tight">{title.toUpperCase()}</h2>
          <p className="text-on-surface-variant font-body mt-2">Les dernieres avancees en ingenierie de precision.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
          {items.slice(0, 8).map((item) => (
            <ProductCard key={item.lotId} {...item} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <a
            href="/catalogue"
            className="inline-block primary-gradient text-on-primary px-8 py-4 rounded-xl font-headline font-bold text-sm uppercase tracking-tight shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
          >
            Voir tous les produits
          </a>
        </div>
      </div>
    </section>
  );
}
