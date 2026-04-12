'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { buildWhatsAppURL } from '@/lib/api';
import { ShoppingCartIcon, Trash2Icon, PhoneIcon, PlusIcon, MinusIcon, ArrowLeftIcon } from '@/components/icons';

const STORE_PHONE = process.env['NEXT_PUBLIC_STORE_PHONE'] ?? '';

export function CartView(): React.JSX.Element {
  const { items, removeItem, updateQuantity, clearCart, totalItems } = useCart();

  const formatPrice = (centimes: number) => `${(centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;

  if (items.length === 0) {
    return (
      <div className="empty-cart">
        <div className="empty-cart-icon"><ShoppingCartIcon size={40} /></div>
        <h3>Votre panier est vide</h3>
        <p>Parcourez le catalogue pour ajouter des produits à votre panier.</p>
        <Link href="/" className="btn btn-primary">
          <ArrowLeftIcon size={16} /> Voir le catalogue
        </Link>
      </div>
    );
  }

  const whatsappUrl = buildWhatsAppURL(STORE_PHONE, items.map((i) => ({
    designation: i.designation,
    quantity: i.quantity,
    price: i.price,
  })));

  return (
    <div>
      <div className="cart-items">
        {items.map((item) => (
          <div key={item.lotId} className="cart-item">
            <div className="item-info">
              <div className="item-name">{item.designation}</div>
              <div className="item-category">{item.category}</div>
              {item.price != null && item.price > 0 && (
                <div className="item-price">{formatPrice(item.price)}</div>
              )}
            </div>
            <div className="item-actions">
              <div className="qty-controls">
                <button
                  className="qty-btn"
                  onClick={() => updateQuantity(item.lotId, Math.max(1, item.quantity - 1))}
                  aria-label="Diminuer la quantité"
                >
                  <MinusIcon size={16} />
                </button>
                <span className="qty-display">{item.quantity}</span>
                <button
                  className="qty-btn"
                  onClick={() => updateQuantity(item.lotId, Math.min(999, item.quantity + 1))}
                  aria-label="Augmenter la quantité"
                >
                  <PlusIcon size={16} />
                </button>
              </div>
              <button
                className="cart-remove-btn"
                onClick={() => removeItem(item.lotId)}
                aria-label={`Retirer ${item.designation}`}
              >
                <Trash2Icon size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div className="total">{totalItems} article{totalItems > 1 ? 's' : ''} dans votre panier</div>

        {STORE_PHONE && (
          <div className="whatsapp-notice">
            <strong>Le paiement se fait directement avec le magasin.</strong><br />
            En cliquant ci-dessous, votre demande sera envoyée par WhatsApp. Le magasin confirmera la disponibilité et le prix final.
          </div>
        )}

        <div className="cart-actions">
          {STORE_PHONE && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
              <PhoneIcon size={18} /> Envoyer par WhatsApp
            </a>
          )}
          <button className="btn btn-secondary" onClick={() => clearCart()}>
            Vider le panier
          </button>
        </div>
      </div>
    </div>
  );
}
