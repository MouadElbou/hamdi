import React from 'react';
import { CartView } from '@/components/CartView';

export default function CartPage() {
  return (
    <div className="main-area">
      <div className="container">
        <h1 className="page-title">Panier</h1>
        <p className="page-subtitle">Vérifiez votre sélection avant d&apos;envoyer votre demande.</p>
        <CartView />
      </div>
    </div>
  );
}
