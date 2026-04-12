'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import anime from 'animejs/lib/anime.es.js';
import { useCart } from '@/lib/cart';
import { getApiBase, type CatalogItem } from '@/lib/api';
import { SearchIcon, PackageIcon, AlertCircleIcon, ShoppingCartIcon, FilterIcon, XIcon, ChevronDownIcon } from '@/components/icons';
import { getCategoryIcon } from './ProductCard';
import { CATEGORIES } from './CategoryGrid';

function SkeletonGrid() {
  return (
    <div className="catalog-skeleton">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="catalog-skeleton-card">
          <div className="skeleton skeleton-image" />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text short" />
          <div className="skeleton skeleton-price" />
        </div>
      ))}
    </div>
  );
}

interface CatalogBrowserProps {
  initialCategory?: string;
}

export function CatalogBrowser({ initialCategory = '' }: CatalogBrowserProps): React.JSX.Element {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => initialCategory ? new Set([initialCategory]) : new Set()
  );
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { addItem } = useCart();

  // Listen for category selection from the strip
  useEffect(() => {
    const handler = (e: Event) => {
      const cat = (e as CustomEvent<string>).detail;
      if (cat) {
        setSelectedCategories(new Set([cat]));
      } else {
        setSelectedCategories(new Set());
      }
    };
    window.addEventListener('catalog-filter-category', handler);
    return () => window.removeEventListener('catalog-filter-category', handler);
  }, []);

  const categoryParam = useMemo(() => {
    if (selectedCategories.size === 0) return '';
    return Array.from(selectedCategories).join(',');
  }, [selectedCategories]);

  useEffect(() => {
    const controller = new AbortController();
    const debounce = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ inStockOnly: 'true', limit: '100' });
        if (search) params.set('search', search);
        if (categoryParam) params.set('category', categoryParam);

        const base = getApiBase();
        const res = await fetch(`${base}/stock?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Erreur serveur: ${res.status}`);
        const data = await res.json() as { items: CatalogItem[] };
        setItems(data.items);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message || 'Erreur de chargement du catalogue');
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [search, categoryParam]);

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setSelectedCategories(new Set());
    setPriceMin('');
    setPriceMax('');
    setSortBy('default');
  }, []);

  const hasFilters = search || selectedCategories.size > 0 || priceMin || priceMax || sortBy !== 'default';

  const filteredAndSorted = useMemo(() => {
    let result = [...items];

    // Client-side price filter
    const minVal = priceMin ? parseFloat(priceMin) * 100 : 0;
    const maxVal = priceMax ? parseFloat(priceMax) * 100 : Infinity;
    if (minVal > 0 || maxVal < Infinity) {
      result = result.filter((item) => {
        const price = item.targetResalePrice ?? 0;
        return price >= minVal && price <= maxVal;
      });
    }

    // Sort
    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => (a.targetResalePrice ?? 0) - (b.targetResalePrice ?? 0));
        break;
      case 'price-desc':
        result.sort((a, b) => (b.targetResalePrice ?? 0) - (a.targetResalePrice ?? 0));
        break;
      case 'name':
        result.sort((a, b) => a.designation.localeCompare(b.designation, 'fr'));
        break;
    }

    return result;
  }, [items, priceMin, priceMax, sortBy]);

  const formatPrice = (centimes: number) => `${(centimes / 100).toFixed(2)} MAD`;

  // Product card stagger animation after data loads
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (loading || filteredAndSorted.length === 0 || !gridRef.current) return;
    const mq = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq && mq.matches) return;
    const cards = gridRef.current.querySelectorAll('.catalog-product-card');
    if (!cards.length) return;
    cards.forEach((c) => (c as HTMLElement).style.opacity = '0');
    anime({
      targets: Array.from(cards),
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 250,
      easing: 'easeOutQuint',
      delay: anime.stagger(30),
    });
  }, [loading, filteredAndSorted]);

  const sidebar = (
    <aside className={`catalog-sidebar ${filtersOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h3>Filtres</h3>
        <button className="sidebar-close" onClick={() => setFiltersOpen(false)} aria-label="Fermer les filtres">
          <XIcon size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="filter-group">
        <div className="filter-search-wrap">
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="filter-group">
        <h4 className="filter-group-title">Catégorie</h4>
        <div className="filter-checkbox-list">
          {CATEGORIES.map(({ label, value }) => (
            <label key={value} className="filter-checkbox">
              <input
                type="checkbox"
                checked={selectedCategories.has(value)}
                onChange={() => toggleCategory(value)}
              />
              <span className="checkbox-custom" />
              <span className="checkbox-label">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price range */}
      <div className="filter-group">
        <h4 className="filter-group-title">Prix (MAD)</h4>
        <div className="filter-price-inputs">
          <input
            type="number"
            placeholder="Min"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            min="0"
          />
          <span className="price-separator">—</span>
          <input
            type="number"
            placeholder="Max"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            min="0"
          />
        </div>
      </div>

      {/* Clear */}
      {hasFilters && (
        <button className="filter-clear-btn" onClick={clearFilters}>
          Réinitialiser les filtres
        </button>
      )}
    </aside>
  );

  return (
    <div className="catalog-layout">
      {/* Mobile filter toggle */}
      <button className="catalog-filter-toggle" onClick={() => setFiltersOpen(true)}>
        <FilterIcon size={18} /> Filtres
        {selectedCategories.size > 0 && <span className="filter-count">{selectedCategories.size}</span>}
      </button>

      {/* Overlay for mobile */}
      {filtersOpen && (
        <div className="catalog-sidebar-overlay" onClick={() => setFiltersOpen(false)} />
      )}

      {sidebar}

      <div className="catalog-main">
        {/* Top bar */}
        <div className="catalog-topbar">
          <span className="catalog-result-count">
            {loading ? '...' : `${filteredAndSorted.length} produit${filteredAndSorted.length !== 1 ? 's' : ''}`}
          </span>
          <div className="catalog-sort">
            <label htmlFor="sort-select">Trier par</label>
            <div className="sort-select-wrap">
              <select id="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="default">Pertinence</option>
                <option value="price-asc">Prix croissant</option>
                <option value="price-desc">Prix décroissant</option>
                <option value="name">Nom A-Z</option>
              </select>
              <ChevronDownIcon size={16} />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <SkeletonGrid />
        ) : error ? (
          <div className="catalog-state error" role="alert">
            <div className="catalog-state-icon"><AlertCircleIcon size={36} /></div>
            <h3>Erreur de chargement</h3>
            <p>{error}</p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="catalog-state">
            <div className="catalog-state-icon"><PackageIcon size={36} /></div>
            <h3>Aucun produit trouvé</h3>
            <p>Essayez de modifier vos critères de recherche.</p>
          </div>
        ) : (
          <div className="product-grid" ref={gridRef}>
            {filteredAndSorted.map((item) => {
              const CatIcon = getCategoryIcon(item.category);
              return (
                <div key={item.lotId} className="product-card catalog-product-card">
                  <div className="catalog-card-image">
                    <CatIcon size={40} />
                  </div>
                  <div className="catalog-card-body">
                    <span className="category-tag">{item.category}</span>
                    <div className="designation">{item.designation}</div>
                    <div className="meta">
                      {item.boutique} · {item.supplier}
                    </div>
                    <div className={`stock-badge ${item.remainingQuantity <= 3 ? 'low-stock' : 'in-stock'}`}>
                      {item.remainingQuantity <= 3 ? `Plus que ${item.remainingQuantity}` : 'En stock'}
                    </div>
                    <div className="catalog-card-bottom">
                      {item.targetResalePrice ? (
                        <div className="price">{formatPrice(item.targetResalePrice)}</div>
                      ) : (
                        <div className="price price-demand-text">Sur demande</div>
                      )}
                      <button
                        className="catalog-add-btn"
                        onClick={() => addItem({
                          lotId: item.lotId,
                          designation: item.designation,
                          category: item.category,
                          price: item.targetResalePrice,
                        })}
                        aria-label={`Ajouter ${item.designation} au panier`}
                      >
                        <ShoppingCartIcon size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
