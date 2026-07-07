import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CartView } from '@/components/CartView';

export const metadata: Metadata = {
  title: 'Panier — HAMDI PC',
  description: 'Vérifiez votre sélection et envoyez votre commande détaillée par WhatsApp en un clic.',
};

export default function CartPage() {
  return (
    <section>
      <div className="relative bg-surface-container-low border-b border-outline-variant/50 overflow-hidden">
        <div className="dot-grid absolute inset-0 opacity-70" />
        <div className="max-w-screen-2xl mx-auto px-6 md:px-8 py-14 relative">
          <nav className="flex items-center gap-2 font-label text-xs uppercase tracking-widest text-on-surface-variant mb-4">
            <Link href="/" className="hover:text-primary">Accueil</Link>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="text-primary">Panier</span>
          </nav>
          <h1 className="text-4xl md:text-6xl font-black font-headline text-on-surface tracking-tighter">VOTRE PANIER</h1>
          <p className="text-on-surface-variant font-body mt-3 max-w-xl">Vérifiez votre sélection, renseignez vos coordonnées, et envoyez la commande détaillée par WhatsApp — sans paiement en ligne.</p>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 md:px-8">
        <CartView />
      </div>
    </section>
  );
}
