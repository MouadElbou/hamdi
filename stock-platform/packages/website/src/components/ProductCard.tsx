'use client';

import React from 'react';
import { useCart } from '@/lib/cart';
import {
  MonitorIcon,
  SmartphoneIcon,
  GamepadIcon,
  HeadphonesIcon,
  WifiIcon,
  PackageIcon,
  PrinterIcon,
  BatteryIcon,
  CameraIcon,
  ShoppingCartIcon,
} from '@/components/icons';

type IconComponent = (props: { size?: number; className?: string }) => React.JSX.Element;

const CATEGORY_ICON_MAP: Array<{ keywords: string[]; Icon: IconComponent }> = [
  { keywords: ['ordinateur', 'laptop', 'pc', 'computer'], Icon: MonitorIcon },
  { keywords: ['téléphone', 'phone', 'smartphone', 'mobile'], Icon: SmartphoneIcon },
  { keywords: ['gaming', 'jeu', 'console', 'manette'], Icon: GamepadIcon },
  { keywords: ['périphérique', 'accessoire', 'clavier', 'souris', 'casque'], Icon: HeadphonesIcon },
  { keywords: ['réseau', 'wifi', 'routeur', 'network', 'switch'], Icon: WifiIcon },
  { keywords: ['imprimante', 'printer', 'scanner'], Icon: PrinterIcon },
  { keywords: ['batterie', 'battery', 'pile', 'chargeur'], Icon: BatteryIcon },
  { keywords: ['camera', 'surveillance', 'vidéo'], Icon: CameraIcon },
];

export function getCategoryIcon(category: string): IconComponent {
  const lower = category.toLowerCase();
  for (const { keywords, Icon } of CATEGORY_ICON_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return Icon;
  }
  return PackageIcon;
}

interface ProductCardProps {
  lotId: string;
  designation: string;
  category: string;
  remainingQuantity: number;
  targetResalePrice: number | null;
  supplier: string;
}

export function ProductCard({ lotId, designation, category, remainingQuantity, targetResalePrice }: ProductCardProps): React.JSX.Element {
  const { addItem } = useCart();
  const CategoryIcon = getCategoryIcon(category);

  const formatPrice = (centimes: number) =>
    `${(centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`;

  return (
    <div className="product-card">
      <div className="product-card-image">
        <CategoryIcon size={48} />

        <button
          className="card-add-to-cart"
          onClick={(e) => {
            e.stopPropagation();
            addItem({ lotId, designation, category, price: targetResalePrice });
          }}
        >
          <ShoppingCartIcon size={16} /> Ajouter au panier
        </button>
      </div>

      <div className="product-card-info">
        <span className="product-card-category">{category}</span>
        <span className="product-card-name">{designation}</span>
        <div className="product-card-prices">
          {targetResalePrice ? (
            <span className="price-current">{formatPrice(targetResalePrice)}</span>
          ) : (
            <span className="price-demand">Prix sur demande</span>
          )}
        </div>
        <span className={`stock-badge ${remainingQuantity <= 3 ? 'low-stock' : 'in-stock'}`}>
          {remainingQuantity <= 3 ? `${remainingQuantity} restant(s)` : 'En stock'}
        </span>
      </div>
    </div>
  );
}
