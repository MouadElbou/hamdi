'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useCart } from '@/lib/cart';
import { getApiBase, type CatalogItem } from '@/lib/api';
import { CATEGORIES } from '@/lib/catalog-taxonomy';

const PAGE_SIZE = 48;
const sym = (name: string, cls = '') => <span className={`material-symbols-outlined ${cls}`}>{name}</span>;
const formatPrice = (c: number) => `${(c / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH`;

// Per-category icon + accent — gives imageless products colour & identity.
const CAT_STYLE: Record<string, { icon: string; color: string }> = {
  'Écrans & Dalles': { icon: 'desktop_windows', color: '#0014bd' },
  'Batteries': { icon: 'battery_full', color: '#00897b' },
  'Chargeurs & Adaptateurs': { icon: 'power', color: '#6d28d9' },
  'Claviers & Touches': { icon: 'keyboard', color: '#2a39d4' },
  'PC Portables': { icon: 'laptop_mac', color: '#0277bd' },
  'PC de Bureau & Composants': { icon: 'memory', color: '#455a64' },
  'Impression & Scan': { icon: 'print', color: '#00695c' },
  'Réseau & Connectique': { icon: 'router', color: '#1565c0' },
  'Périphériques & Accessoires': { icon: 'mouse', color: '#5e35b1' },
  'Multimédia & Audio': { icon: 'headphones', color: '#ad1457' },
  'Sécurité & Surveillance': { icon: 'security', color: '#2e7d32' },
  'Gaming': { icon: 'sports_esports', color: '#c62828' },
  'Services & Réparation': { icon: 'build', color: '#ef6c00' },
};
const catStyle = (c: string) => CAT_STYLE[c] ?? { icon: 'memory', color: '#0014bd' };

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[4/3] bg-surface-container rounded-xl mb-3" />
          <div className="h-4 bg-surface-container rounded w-3/4 mb-2" />
          <div className="h-4 bg-surface-container rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function CatalogBrowser({ initialCategory = '' }: { initialCategory?: string }): React.JSX.Element {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => (initialCategory ? new Set([initialCategory]) : new Set()));
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { addItem } = useCart();
  const topRef = useRef<HTMLDivElement>(null);

  const categoryParam = useMemo(() => Array.from(selectedCategories).join(','), [selectedCategories]);
  const brandParam = useMemo(() => Array.from(selectedBrands).join(','), [selectedBrands]);

  // Brand options follow the selected categories.
  useEffect(() => {
    const ctrl = new AbortController();
    const qs = categoryParam ? `?category=${encodeURIComponent(categoryParam)}` : '';
    fetch(`${getApiBase()}/stock/filters${qs}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { brands?: string[] }) => {
        const brands = d.brands ?? [];
        setBrandOptions(brands);
        setSelectedBrands((prev) => new Set([...prev].filter((b) => brands.includes(b))));
      })
      .catch(() => { /* ignore */ });
    return () => ctrl.abort();
  }, [categoryParam]);

  // Fetch ALL matching items (looping the API's 200-cap) so sort/paging are global.
  useEffect(() => {
    const controller = new AbortController();
    const mkUrl = (pg: number) => {
      const p = new URLSearchParams({ inStockOnly: 'true', limit: '200', page: String(pg) });
      if (search) p.set('search', search);
      if (categoryParam) p.set('category', categoryParam);
      if (brandParam) p.set('brand', brandParam);
      return `${getApiBase()}/stock?${p.toString()}`;
    };
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const first = await fetch(mkUrl(1), { signal: controller.signal });
        if (!first.ok) throw new Error(`Erreur serveur: ${first.status}`);
        const d1 = (await first.json()) as { items: CatalogItem[]; total: number };
        let all = d1.items;
        const pages = Math.min(6, Math.ceil((d1.total || 0) / 200)); // safety cap ~1200
        for (let pg = 2; pg <= pages; pg++) {
          const r = await fetch(mkUrl(pg), { signal: controller.signal });
          if (r.ok) { const d = (await r.json()) as { items: CatalogItem[] }; all = all.concat(d.items); }
        }
        setItems(all);
        setPage(1);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError((err as Error).message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(run, 300);
    return () => { clearTimeout(t); controller.abort(); };
  }, [search, categoryParam, brandParam]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (v: string) =>
    setter((prev) => { const n = new Set(prev); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const toggleCategory = useCallback(toggle(setSelectedCategories), []);
  const toggleBrand = useCallback(toggle(setSelectedBrands), []);

  const clearFilters = useCallback(() => {
    setSearch(''); setSelectedCategories(new Set()); setSelectedBrands(new Set());
    setPriceMin(''); setPriceMax(''); setSortBy('default');
  }, []);

  const hasFilters = !!(search || selectedCategories.size || selectedBrands.size || priceMin || priceMax || sortBy !== 'default');

  const filteredAndSorted = useMemo(() => {
    let result = [...items];
    const minVal = priceMin ? parseFloat(priceMin) * 100 : 0;
    const maxVal = priceMax ? parseFloat(priceMax) * 100 : Infinity;
    if (minVal > 0 || maxVal < Infinity) result = result.filter((it) => { const p = it.targetResalePrice ?? 0; return p >= minVal && p <= maxVal; });
    switch (sortBy) {
      case 'price-asc': result.sort((a, b) => (a.targetResalePrice ?? 0) - (b.targetResalePrice ?? 0)); break;
      case 'price-desc': result.sort((a, b) => (b.targetResalePrice ?? 0) - (a.targetResalePrice ?? 0)); break;
      case 'name': result.sort((a, b) => a.designation.localeCompare(b.designation, 'fr')); break;
    }
    return result;
  }, [items, priceMin, priceMax, sortBy]);

  // Reset to page 1 whenever the visible set changes.
  useEffect(() => { setPage(1); }, [priceMin, priceMax, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const pageItems = filteredAndSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const goToPage = (p: number) => { setPage(p); topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const CheckRow = ({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) => (
    <label className="flex items-center gap-3 py-1.5 cursor-pointer group/chk select-none">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onToggle} />
      <span className={`w-[18px] h-[18px] rounded-[5px] border-2 grid place-items-center shrink-0 transition-colors ${checked ? 'bg-primary border-primary' : 'border-outline-variant'}`}>
        {checked && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
      </span>
      <span className={`font-body text-sm transition-colors group-hover/chk:text-on-surface ${checked ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>{label}</span>
    </label>
  );

  const Filters = (
    <div className="space-y-8">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} placeholder="Rechercher une pièce…"
          className="w-full bg-surface-container-low border border-outline-variant rounded-xl pl-11 pr-4 py-3 font-body text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition" />
      </div>
      <div>
        <h4 className="font-headline font-bold text-on-surface uppercase tracking-widest text-xs mb-3">Catégorie</h4>
        <div className="space-y-0.5">
          {CATEGORIES.map((c) => (
            <CheckRow key={c.key} label={c.label} checked={selectedCategories.has(c.label)} onToggle={() => toggleCategory(c.label)} />
          ))}
        </div>
      </div>
      {brandOptions.length > 0 && (
        <div>
          <h4 className="font-headline font-bold text-on-surface uppercase tracking-widest text-xs mb-3">Marque</h4>
          <div className="space-y-0.5">
            {brandOptions.map((b) => (
              <CheckRow key={b} label={b} checked={selectedBrands.has(b)} onToggle={() => toggleBrand(b)} />
            ))}
          </div>
        </div>
      )}
      <div>
        <h4 className="font-headline font-bold text-on-surface uppercase tracking-widest text-xs mb-3">Prix (DH)</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="0" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary transition" />
          <span className="text-on-surface-variant">–</span>
          <input type="number" min="0" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary transition" />
        </div>
      </div>
      {hasFilters && (
        <button onClick={clearFilters} className="w-full flex items-center justify-center gap-2 border border-outline-variant rounded-xl py-3 font-headline font-bold text-sm text-primary hover:bg-surface-container transition">
          {sym('restart_alt', 'text-[18px]')} Réinitialiser
        </button>
      )}
    </div>
  );

  return (
    <div ref={topRef} className="grid lg:grid-cols-[270px_1fr] gap-8 lg:gap-10 py-12 scroll-mt-24">
      <button onClick={() => setFiltersOpen(true)} className="lg:hidden flex items-center gap-2 self-start bg-surface-container-lowest ghost-border rounded-xl px-5 py-3 font-headline font-bold text-sm text-primary">
        {sym('filter_list', 'text-[20px]')} Filtres {selectedCategories.size + selectedBrands.size > 0 && <span className="ml-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-primary text-white text-xs">{selectedCategories.size + selectedBrands.size}</span>}
      </button>

      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto bg-surface-container-lowest ghost-border rounded-2xl p-6">
          <h3 className="font-headline font-black text-xl text-on-surface mb-6">Filtres</h3>
          {Filters}
        </div>
      </aside>

      {filtersOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-on-surface/40" onClick={() => setFiltersOpen(false)} />
          <div className="relative bg-background w-[86%] max-w-sm h-full overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline font-black text-xl">Filtres</h3>
              <button onClick={() => setFiltersOpen(false)} className="w-10 h-10 grid place-items-center rounded-xl text-primary hover:bg-surface-container">{sym('close')}</button>
            </div>
            {Filters}
            <button onClick={() => setFiltersOpen(false)} className="w-full mt-8 primary-gradient text-white rounded-xl py-3.5 font-headline font-bold">Voir les résultats</button>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-4 mb-8 pb-5 border-b border-outline-variant/50">
          <span className="font-label text-sm text-on-surface-variant uppercase tracking-widest">{loading ? '…' : `${filteredAndSorted.length} produit${filteredAndSorted.length !== 1 ? 's' : ''}`}</span>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="hidden sm:block font-label text-xs uppercase tracking-widest text-on-surface-variant">Trier</label>
            <div className="relative">
              <select id="sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-surface-container-lowest ghost-border rounded-xl pl-4 pr-9 py-2.5 font-headline font-bold text-sm text-on-surface outline-none focus:border-primary cursor-pointer">
                <option value="default">Pertinence</option>
                <option value="price-asc">Prix croissant</option>
                <option value="price-desc">Prix décroissant</option>
                <option value="name">Nom A–Z</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">expand_more</span>
            </div>
          </div>
        </div>

        {loading ? <SkeletonGrid /> : error ? (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-error text-5xl">error</span>
            <h3 className="font-headline font-bold text-xl mt-4">Erreur de chargement</h3>
            <p className="text-on-surface-variant mt-1">{error}</p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-outline text-5xl">inventory_2</span>
            <h3 className="font-headline font-bold text-xl mt-4">Aucun produit trouvé</h3>
            <p className="text-on-surface-variant mt-1">Essayez de modifier vos critères de recherche.</p>
            {hasFilters && <button onClick={clearFilters} className="mt-5 text-primary font-headline font-bold underline">Réinitialiser les filtres</button>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {pageItems.map((item) => {
                const cs = catStyle(item.category);
                return (
                  <div key={item.lotId} className="group flex flex-col">
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-3 ghost-border flex items-center justify-center card-lift"
                      style={item.imageUrl ? undefined : { background: `linear-gradient(135deg, ${cs.color}14, ${cs.color}0a)` }}>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.designation} loading="lazy" className="w-full h-full object-contain p-6 group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <span className="material-symbols-outlined transition-transform duration-500 group-hover:scale-110" style={{ fontSize: '3.2rem', color: cs.color, opacity: 0.9 }}>{cs.icon}</span>
                      )}
                      {item.brand && <span className="absolute top-2.5 left-2.5 bg-white/85 backdrop-blur text-[10px] font-headline font-bold uppercase tracking-widest px-2 py-1 rounded-md" style={{ color: cs.color }}>{item.brand}</span>}
                      {item.remainingQuantity <= 3 && <span className="absolute top-2.5 right-2.5 bg-error/10 text-error text-[10px] font-bold px-2 py-0.5 rounded-md font-label">Stock {item.remainingQuantity}</span>}
                    </div>
                    <span className="inline-block text-[10px] font-label uppercase tracking-widest mb-1" style={{ color: cs.color }}>{item.category}</span>
                    <h3 className="font-headline font-bold text-sm md:text-[0.95rem] text-on-surface tracking-tight line-clamp-2 leading-snug min-h-[2.5em]">{item.designation}</h3>
                    <div className="flex items-center justify-between mt-2">
                      {item.targetResalePrice ? (
                        <p className="font-headline text-primary font-black text-base md:text-lg">{formatPrice(item.targetResalePrice)}</p>
                      ) : (
                        <p className="font-headline text-on-surface-variant font-bold text-sm">Sur demande</p>
                      )}
                      <button onClick={() => addItem({ lotId: item.lotId, designation: item.designation, category: item.category, price: item.targetResalePrice })}
                        aria-label={`Ajouter ${item.designation}`}
                        className="w-9 h-9 grid place-items-center rounded-lg bg-surface-container text-primary hover:bg-primary hover:text-white transition active:scale-95 shrink-0">
                        {sym('add_shopping_cart', 'text-[18px]')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-14">
                <button onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="w-10 h-10 grid place-items-center rounded-lg ghost-border text-primary disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-container transition">{sym('chevron_left')}</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => { if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…'); acc.push(p); return acc; }, [])
                  .map((p, i) => typeof p === 'string'
                    ? <span key={`e${i}`} className="w-10 h-10 grid place-items-center text-on-surface-variant">…</span>
                    : (
                      <button key={p} onClick={() => goToPage(p)}
                        className={`w-10 h-10 grid place-items-center rounded-lg font-headline font-bold text-sm transition ${p === page ? 'bg-primary text-white' : 'ghost-border text-on-surface hover:bg-surface-container'}`}>{p}</button>
                    ))}
                <button onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                  className="w-10 h-10 grid place-items-center rounded-lg ghost-border text-primary disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-container transition">{sym('chevron_right')}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
