'use client';

import React from 'react';
import { useCart } from '@/lib/cart';

export interface HomeProduct {
  lotId: string;
  designation: string;
  category: string;
  brand?: string | null;
  targetResalePrice: number | null;
  imageUrl?: string | null;
}

const fmt = (c: number) => (c / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 });

export function HomeProductCard({ p, i = 0 }: { p: HomeProduct; i?: number }): React.JSX.Element {
  const { addItem } = useCart();
  return (
    <div className="reveal group" data-d={String(i % 4)}>
      <div className="relative aspect-square bg-surface-container-lowest rounded-xl overflow-hidden mb-5 ghost-border p-8 flex items-center justify-center card-lift">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" src={p.imageUrl} alt={p.designation} loading="lazy" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-outline">
            <span className="material-symbols-outlined text-5xl">memory</span>
            <span className="font-label text-[10px] uppercase tracking-[0.18em]">HAMDI&nbsp;PC</span>
          </div>
        )}
        {p.brand && <span className="absolute top-3 left-3 bg-primary text-white text-[10px] font-headline font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg">{p.brand}</span>}
        <div className="absolute inset-0 bg-primary/40 glass-effect opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={() => addItem({ lotId: p.lotId, designation: p.designation, category: p.category, price: p.targetResalePrice })}
            className="bg-white text-primary px-5 py-2.5 rounded-full font-headline font-bold text-sm flex items-center gap-1.5 hover:scale-105 transition-transform"
          >
            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span> Ajouter
          </button>
        </div>
      </div>
      <h3 className="font-headline font-bold text-lg text-on-surface tracking-tight leading-snug line-clamp-2">{p.designation}</h3>
      {p.targetResalePrice != null ? (
        <p className="font-headline text-primary font-black text-xl mt-1.5">{fmt(p.targetResalePrice)} <span className="text-sm font-bold text-on-surface-variant">DH</span></p>
      ) : (
        <p className="font-headline text-on-surface-variant font-bold text-lg mt-1.5">Sur demande</p>
      )}
    </div>
  );
}
