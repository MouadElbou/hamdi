'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useCart } from '@/lib/cart';
import { getApiBase, type CatalogItem } from '@/lib/api';
import { SearchIcon, PackageIcon, AlertCircleIcon, ShoppingCartIcon, FilterIcon, XIcon, ChevronDownIcon } from '@/components/icons';
import { CATEGORIES } from './CategoryGrid';

const PRODUCT_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA57OODCL4L3FTpse15bPqQmDkb_Ltmck95vcSytgFWSmZbNT9xbOsTJ-8a_xA8jsfKdSwM6yJZr0YnPRNg4qUit9k56ifgC5WpQ_XoZfpJTvqHN_kP-4rZ_kvAkCNUTrqsEf1gg1gi3SJ66UQ-mMGwoF7Q0pSaTPs86bP1HVRgiPda-LfOF4QR6gQSsHeowq1uwmQcTdvQnpp9TwA48KCTj-LrMP0GmiZq5FGgIy0aTN1tJECAgPNL2Kh_p0Z5mnw-SMjjc070yPA',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD7fmrhpXXa8mGwOPoc1db9asX36JucoNC1Ajcnw1y_lbQtiPVQZ0R0yK19ltQDuwDf0-2zGq__RAK6JfcDUmGhU0NzR27LX9xV1okDROkOlL36MZDwraiM87B0h1aRHdmI4h3VYmwccXtEpx76LOYj1X9dq8fAIKB2YCKHWGMAGn1lqN1poy_TWCG9n9mQDDCjnOV7GH9EupYouQhFfjzqrI9U2oEzoG1im26TOYx6uFJXd5vP_f4FC7NxWafWXV84zOuPRmuaq6w',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAtbHbKYC0fEoj9ak5HDmRIywOJqNZHW3_XDjBHQlcqaKj20IJ5S_aTITrNm64XMMAGE19TovXPsSg0gFaTfUFPpxloqgP7uk4Zke531UzNLCx4_aeUQNVjb8DYJZCi9vtgHc9pffpObrwLeCRzhO6AHLuoS-68m6THQPu2B9xWb2qh_Jvs8a8xM1RnNOhLZF9fFbNu1oNvZDjdnMRdmTE77HOTKtXh5fDOjK8QU08DOeTgpn4lu0WSebpG1mRDtTPF1QIFlOyiN4o',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBjGlFOTG1L7rsAC03id6Aqyl4Gg1UZRbykXy_65sc25TAr_qvLUZzhl6EJPK2rpvun60uUvrkVn9pja9kjF8C0rzQ_VseSgg7CdK0LU74RqS6zMkU7Zxd2cYDm-Em47vCUdWA8Mwgx2XgJ2MpyZZ4BnjnCrpoueCxgCHyu9zUYZ7H9JAMJvfJJakhyMTHksCovrelmilowsiU9VQ8bpzmA3hsBfN6CVf-H3tPnJAgRJjPUEI0C0-AxB4XHMA1jAtHfXJzJrcsZuok',
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getProductImage(lotId: string): string {
  return PRODUCT_IMAGES[hashString(lotId) % PRODUCT_IMAGES.length] ?? PRODUCT_IMAGES[0]!;
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-x-8 md:gap-y-12">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square bg-surface-container-low rounded-xl mb-6"></div>
          <div className="h-5 bg-surface-container-low rounded w-3/4 mb-2"></div>
          <div className="h-5 bg-surface-container-low rounded w-1/2"></div>
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
    cards.forEach((c, i) => {
      const el = c as HTMLElement;
      el.style.opacity = '0';
      el.style.transform = 'translateY(12px)';
      el.style.transition = `opacity .25s ease ${i * 30}ms, transform .25s ease ${i * 30}ms`;
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
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
        <h4 className="filter-group-title">Categorie</h4>
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
          <span className="price-separator">--</span>
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
          Reinitialiser les filtres
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
                <option value="price-desc">Prix decroissant</option>
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
            <h3>Aucun produit trouve</h3>
            <p>Essayez de modifier vos criteres de recherche.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-x-8 md:gap-y-12" ref={gridRef}>
            {filteredAndSorted.map((item) => {
              return (
                <div key={item.lotId} className="group catalog-product-card">
                  {/* Image area matching ProductCard style */}
                  <div className="relative aspect-square bg-surface-container-low rounded-xl overflow-hidden mb-6 ghost-border p-8 flex items-center justify-center">
                    <img
                      src={getProductImage(item.lotId)}
                      alt={item.designation}
                      loading="lazy"
                      className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {/* Glassmorphism overlay on hover */}
                    <div className="absolute inset-0 bg-on-surface/40 glass-effect opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button className="bg-white text-primary px-6 py-3 rounded-full font-headline font-bold text-sm">
                        Quick View
                      </button>
                      <button
                        className="bg-primary text-on-primary p-3 rounded-full hover:scale-110 transition-transform"
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

                    {/* Stock badge */}
                    {item.remainingQuantity <= 3 && (
                      <span className="absolute top-3 right-3 z-20 bg-error/10 text-error text-xs font-bold px-2 py-1 rounded-lg font-label">
                        Plus que {item.remainingQuantity}
                      </span>
                    )}
                  </div>

                  {/* Info below image */}
                  <span className="inline-block text-xs font-label text-on-surface-variant/60 uppercase tracking-widest mb-1">{item.category}</span>
                  <h3 className="font-headline font-bold text-lg text-on-surface tracking-tight line-clamp-2">{item.designation}</h3>
                  {item.targetResalePrice ? (
                    <p className="font-headline text-primary font-bold text-lg mt-1 tracking-tight">{formatPrice(item.targetResalePrice)}</p>
                  ) : (
                    <p className="font-headline text-on-surface-variant font-bold text-lg mt-1">Sur demande</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
