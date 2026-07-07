'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES } from '@/lib/catalog-taxonomy';
import { SearchIcon } from '@/components/icons';

export function HeroFinder({ productCount, categoryCount, brandCount }: {
  productCount: number; categoryCount: number; brandCount: number;
}): React.JSX.Element {
  const router = useRouter();
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    setBrand('');
    if (!category) { setBrands([]); return; }
    const ctrl = new AbortController();
    fetch(`/api/stock/filters?category=${encodeURIComponent(category)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { brands?: string[] }) => setBrands(d.brands ?? []))
      .catch(() => { /* ignore */ });
    return () => ctrl.abort();
  }, [category]);

  const search = () => {
    const p = new URLSearchParams();
    if (category) p.set('category', category);
    if (brand) p.set('brand', brand);
    if (model.trim()) p.set('search', model.trim());
    const qs = p.toString();
    router.push(`/catalogue${qs ? `?${qs}` : ''}`);
  };

  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden />
      <div className="container-x hero-inner">
        <div className="eyebrow hero-eyebrow">Pièces PC portable · Réparation · Maroc</div>
        <h1 className="hero-title">La <span className="hl">pièce exacte</span> de votre PC portable.</h1>
        <p className="hero-sub">
          Écrans, batteries, chargeurs et claviers pour toutes les marques. Trouvez la pièce
          compatible avec votre modèle en quelques secondes — et faites réparer votre machine par nos experts.
        </p>

        <div className="finder">
          <div className="finder-label"><span className="live" /> Trouvez votre pièce</div>
          <div className="finder-row">
            <div className="finder-field">
              <label>Catégorie</label>
              <select className="finder-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Toutes catégories</option>
                {CATEGORIES.map((c) => <option key={c.key} value={c.label}>{c.label}</option>)}
              </select>
            </div>
            <div className="finder-field">
              <label>Marque</label>
              <select className="finder-select" value={brand} onChange={(e) => setBrand(e.target.value)} disabled={!category || brands.length === 0}>
                <option value="">{category ? 'Toutes marques' : '—'}</option>
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="finder-field">
              <label>Modèle</label>
              <input
                className="finder-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="ex: Pavilion 15"
                onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
              />
            </div>
            <div className="finder-field finder-cta">
              <button className="btn-volt" onClick={search}><SearchIcon size={17} /> Chercher</button>
            </div>
          </div>
        </div>

        <div className="hero-stats">
          <div className="hero-stat"><div className="n">{productCount}<span className="u">+</span></div><div className="l">Références</div></div>
          <div className="hero-stat"><div className="n">{brandCount}<span className="u">+</span></div><div className="l">Marques</div></div>
          <div className="hero-stat"><div className="n">{categoryCount}</div><div className="l">Catégories</div></div>
          <div className="hero-stat"><div className="n">24<span className="u">h</span></div><div className="l">Livraison rapide</div></div>
        </div>
      </div>
    </section>
  );
}
