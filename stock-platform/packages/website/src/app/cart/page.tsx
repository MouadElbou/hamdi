import React from 'react';
import type { Metadata } from 'next';
import { CartView } from '@/components/CartView';

export const metadata: Metadata = {
  title: 'Panier — Hamdi PC',
  description: 'Consultez votre panier et envoyez votre commande par WhatsApp.',
};

export default function CartPage() {
  return (
    <>
      <section className="cart-hero">
        <div className="container">
          <h1 className="cart-hero-title">Votre Panier</h1>
          <p className="cart-hero-sub">
            Vérifiez votre sélection avant d&apos;envoyer votre demande.
          </p>
        </div>
      </section>
      <section className="cart-section">
        <div className="container">
          <CartView />
        </div>
      </section>
    </>
  );
}
