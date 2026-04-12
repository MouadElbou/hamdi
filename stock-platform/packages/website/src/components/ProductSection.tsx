'use client';

import React, { useRef } from 'react';
import { ProductCard } from './ProductCard';
import { ChevronLeftIcon, ChevronRightIcon, StarIcon } from '@/components/icons';

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

export function ProductSection({ id, label, title, items, layout = 'row', showArrows }: ProductSectionProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFlashSale = id === 'offres';

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section className={`section-wrapper ${isFlashSale ? 'flash-sale-section' : ''}`} id={id}>
      <div className="container">
        <div className="section-header">
          <div className="section-header-left">
            <span className="section-label">
              {isFlashSale && <StarIcon size={14} />}
              {label}
            </span>
            <h2 className="section-title">{title}</h2>
          </div>
          {showArrows !== false && (
            <div className="section-arrows">
              <button className="arrow-btn" onClick={() => scroll('left')} aria-label="Défiler à gauche">
                <ChevronLeftIcon size={20} />
              </button>
              <button className="arrow-btn" onClick={() => scroll('right')} aria-label="Défiler à droite">
                <ChevronRightIcon size={20} />
              </button>
            </div>
          )}
        </div>

        {layout === 'row' ? (
          <div className="products-row" ref={scrollRef}>
            {items.map((item) => (
              <ProductCard key={item.lotId} {...item} />
            ))}
          </div>
        ) : (
          <div className="products-grid">
            {items.map((item) => (
              <ProductCard key={item.lotId} {...item} />
            ))}
          </div>
        )}

        <div className="view-all-wrapper">
          <a href="/catalogue" className="btn btn-secondary">Voir tous les produits</a>
        </div>
      </div>
    </section>
  );
}
