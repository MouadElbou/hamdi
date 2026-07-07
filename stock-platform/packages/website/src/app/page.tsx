import React from 'react';
import Link from 'next/link';
import { getCatalogItems, getCategorySummary } from '@/lib/catalog';
import type { CatalogItem } from '@/lib/api';
import { BRANDS } from '@/lib/catalog-taxonomy';
import { HomeProductCard } from '@/components/home/HomeProductCard';
import { HomeInteractions } from '@/components/home/HomeInteractions';

export const dynamic = 'force-dynamic';

const WA = 'https://wa.me/212622265053';
const cat = (label: string) => `/catalogue?category=${encodeURIComponent(label)}`;

const COLLECTIONS = [
  { label: 'Écrans & Dalles', key: 'Écrans & Dalles', icon: 'monitor', sub: 'Toutes résolutions · HD à 4K', cls: 'primary-gradient' },
  { label: 'Batteries & Chargeurs', key: 'Batteries', icon: 'battery_charging_full', sub: 'Autonomie retrouvée', cls: 'bg-tertiary-container' },
  { label: 'Claviers & Accessoires', key: 'Claviers & Touches', icon: 'keyboard', sub: 'AZERTY · rétroéclairé · audio', cls: 'bg-primary-container' },
];
const CHIPS: [string, string][] = [
  ['PC de bureau', 'PC de Bureau & Composants'], ['Impression & scan', 'Impression & Scan'],
  ['Réseau', 'Réseau & Connectique'], ['Gaming', 'Gaming'],
  ['Sécurité & surveillance', 'Sécurité & Surveillance'], ['Multimédia & audio', 'Multimédia & Audio'],
];
const VALUES = [
  { icon: 'local_shipping', t: 'Livraison rapide', d: 'Partout au Maroc' },
  { icon: 'verified_user', t: 'Pièces garanties', d: 'Testées & compatibles' },
  { icon: 'build', t: 'Réparation experte', d: 'Soft · Hard · Électronique' },
  { icon: 'chat', t: 'Commande WhatsApp', d: 'Simple & rapide' },
];
const REPAIR_TAGS = ['Soft', 'Hard', 'Électronique · Carte mère', 'Développement'];

export default async function HomePage() {
  let featured: CatalogItem[] = [];
  const counts: Record<string, number> = {};
  let total = 0;
  try {
    const [c, summary] = await Promise.all([
      getCatalogItems({ limit: 24, inStockOnly: true }),
      getCategorySummary(),
    ]);
    featured = c.items.filter((it) => it.category !== 'Services & Réparation').slice(0, 8);
    for (const s of summary) { counts[s.category] = s.count; total += s.count; }
  } catch { /* DB unavailable — render shell */ }

  const productCount = total || 220;

  return (
    <>
      {/* ══ HERO ══ */}
      <section className="relative min-h-[720px] lg:h-[820px] flex items-center overflow-hidden bg-surface">
        <div className="dot-grid absolute inset-0" />
        <div className="max-w-screen-2xl mx-auto px-6 md:px-8 w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative">
          <div className="z-10 space-y-7">
            <span className="reveal inline-flex items-center gap-2 font-label font-semibold text-primary uppercase tracking-[0.2em] text-sm">
              <span className="w-2 h-2 rounded-full bg-whatsapp inline-block" /> Pièces détachées · Réparation · Maroc
            </span>
            <h1 className="reveal text-5xl md:text-7xl xl:text-8xl font-black font-headline text-on-surface leading-[0.9] tracking-tighter" data-d="1">
              LA PIÈCE<br />EXACTE<br /><span className="text-primary-container">POUR VOTRE PC</span>
            </h1>
            <p className="reveal text-on-surface-variant text-lg max-w-md font-body" data-d="2">
              Écrans, batteries, chargeurs et claviers pour <b className="text-on-surface font-semibold">toutes les marques</b> de PC portable. La bonne pièce, livrée partout au Maroc — et la réparation experte de votre machine, du logiciel à la carte mère.
            </p>
            <div className="reveal flex flex-wrap gap-4 pt-2" data-d="3">
              <Link href="/catalogue" className="primary-gradient text-white px-8 py-4 rounded-xl font-headline font-bold text-base shadow-xl shadow-primary/20 hover:scale-105 transition-transform flex items-center gap-2">
                <span className="material-symbols-outlined">grid_view</span> Explorer le catalogue
              </Link>
              <a href={WA} target="_blank" rel="noopener noreferrer" className="bg-surface-container-lowest text-primary border border-outline-variant px-8 py-4 rounded-xl font-headline font-bold text-base hover:bg-surface-container transition flex items-center gap-2">
                <span className="material-symbols-outlined text-whatsapp" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span> WhatsApp
              </a>
            </div>
            <div className="reveal flex flex-wrap gap-8 pt-6" data-d="4">
              <div><div className="text-3xl font-black font-headline text-on-surface" data-count={productCount}>0<span className="text-primary">+</span></div><div className="font-label text-xs uppercase tracking-widest text-on-surface-variant mt-1">Références</div></div>
              <div><div className="text-3xl font-black font-headline text-on-surface" data-count={BRANDS.length}>0<span className="text-primary">+</span></div><div className="font-label text-xs uppercase tracking-widest text-on-surface-variant mt-1">Marques</div></div>
              <div><div className="text-3xl font-black font-headline text-on-surface">24<span className="text-primary">h</span></div><div className="font-label text-xs uppercase tracking-widest text-on-surface-variant mt-1">Livraison</div></div>
            </div>
          </div>
          <div className="relative hidden md:block">
            <div className="hero-glow absolute -inset-10 bg-primary/10 rounded-full blur-3xl" />
            <div className="hero-float relative z-10">
              <svg viewBox="0 0 560 380" className="w-full h-auto drop-shadow-2xl" role="img" aria-label="PC portable">
                <defs>
                  <linearGradient id="scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0014bd" /><stop offset="1" stopColor="#2a39d4" /></linearGradient>
                  <linearGradient id="deck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e1e0ff" /><stop offset="1" stopColor="#bdc2ff" /></linearGradient>
                </defs>
                <rect x="110" y="24" width="340" height="230" rx="16" fill="#06006c" />
                <rect x="122" y="36" width="316" height="206" rx="9" fill="url(#scr)" />
                <circle cx="280" cy="120" r="46" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" />
                <path d="M262 120 h36 M280 102 v36" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
                <rect x="150" y="180" width="120" height="9" rx="4.5" fill="#ffffff" fillOpacity="0.55" />
                <rect x="150" y="198" width="80" height="9" rx="4.5" fill="#ffffff" fillOpacity="0.3" />
                <rect x="330" y="70" width="80" height="46" rx="6" fill="#ffffff" fillOpacity="0.12" />
                <rect x="330" y="128" width="80" height="30" rx="6" fill="#ffffff" fillOpacity="0.08" />
                <path d="M70 254 h420 l42 74 H28 Z" fill="url(#deck)" />
                <rect x="228" y="292" width="104" height="14" rx="7" fill="#9aa0e8" />
                <rect x="70" y="254" width="420" height="6" fill="#9aa0e8" />
              </svg>
            </div>
            <div className="absolute -left-2 bottom-14 z-20 bg-surface-container-lowest rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 ghost-border">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              <div><div className="font-headline font-bold text-sm leading-tight">Pièces garanties</div><div className="font-label text-xs text-on-surface-variant">Compatibilité vérifiée</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ VALUE STRIP ══ */}
      <section className="bg-surface-container-low border-y border-outline-variant/40">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-8 grid grid-cols-2 lg:grid-cols-4 divide-x divide-outline-variant/40">
          {VALUES.map((v, i) => (
            <div key={v.t} className="reveal flex items-center gap-4 py-6 px-4 lg:px-8" data-d={String(i)}>
              <span className="material-symbols-outlined text-primary text-3xl">{v.icon}</span>
              <div><div className="font-headline font-bold text-sm">{v.t}</div><div className="font-label text-xs text-on-surface-variant">{v.d}</div></div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEATURED COLLECTIONS ══ */}
      <section className="py-24 bg-surface" id="catalogue">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-8">
          <div className="reveal flex justify-between items-end mb-14">
            <div>
              <span className="font-label font-semibold text-primary uppercase tracking-[0.2em] text-sm">Nos rayons</span>
              <h2 className="text-4xl md:text-5xl font-black font-headline text-on-surface tracking-tight mt-3">CATÉGORIES PHARES</h2>
              <div className="h-1.5 w-24 bg-primary mt-4" />
            </div>
            <Link href="/catalogue" className="hidden md:flex items-center gap-2 font-headline font-bold uppercase tracking-tight text-sm text-primary hover:gap-3 transition-all">Tout le catalogue <span className="material-symbols-outlined">arrow_forward</span></Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {COLLECTIONS.map((col, i) => (
              <Link key={col.label} href={cat(col.key)} className={`reveal card-lift group relative aspect-[4/5] rounded-xl overflow-hidden block p-8 flex flex-col justify-between text-white ${col.cls}`} data-d={String(i)}>
                <span className="material-symbols-outlined text-5xl relative z-10">{col.icon}</span>
                <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-[190px] opacity-10 select-none" style={{ fontVariationSettings: "'FILL' 1" }}>{col.icon}</span>
                <div className="relative z-10">
                  <h3 className="text-3xl font-black font-headline tracking-tight">{col.label.toUpperCase()}</h3>
                  <p className="text-white/85 font-label tracking-widest mt-2 uppercase text-xs">{counts[col.key] ?? 0} réf. · {col.sub}</p>
                </div>
                <div className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/90 grid place-items-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all z-10"><span className="material-symbols-outlined text-primary">arrow_outward</span></div>
              </Link>
            ))}
          </div>
          <div className="reveal flex flex-wrap gap-3 mt-10">
            <span className="font-label text-xs uppercase tracking-widest text-on-surface-variant self-center mr-2">Aussi :</span>
            {CHIPS.map(([label, key]) => (
              <Link key={key} href={cat(key)} className="px-4 py-2 rounded-full bg-surface-container text-on-surface font-headline font-bold text-xs uppercase tracking-tight hover:bg-primary hover:text-white transition">{label}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ POPULAR PARTS ══ */}
      {featured.length > 0 && (
        <section className="py-24 bg-surface-container-low">
          <div className="max-w-screen-2xl mx-auto px-6 md:px-8">
            <div className="reveal mb-14 flex justify-between items-end">
              <div>
                <span className="font-label font-semibold text-primary uppercase tracking-[0.2em] text-sm">Sélection</span>
                <h2 className="text-4xl md:text-5xl font-black font-headline text-on-surface tracking-tight mt-3">PIÈCES POPULAIRES</h2>
                <p className="text-on-surface-variant font-body mt-2">Les références les plus demandées par nos clients.</p>
              </div>
              <Link href="/catalogue" className="hidden md:flex items-center gap-2 font-headline font-bold uppercase tracking-tight text-sm text-primary hover:gap-3 transition-all">Tout voir <span className="material-symbols-outlined">arrow_forward</span></Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
              {featured.map((p, i) => (
                <HomeProductCard key={p.lotId} i={i} p={{ lotId: p.lotId, designation: p.designation, category: p.category, brand: p.brand, targetResalePrice: p.targetResalePrice, imageUrl: p.imageUrl }} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ BRAND MARQUEE ══ */}
      <section className="py-8 bg-surface border-y border-outline-variant/40 overflow-hidden">
        <div className="flex whitespace-nowrap marquee-track">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center shrink-0">
              {BRANDS.map((b) => (
                <React.Fragment key={b}>
                  <span className="font-headline font-black text-2xl uppercase tracking-tight mx-8 text-on-surface-variant/40">{b}</span>
                  <span className="text-primary/40 self-center">◆</span>
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ══ REPAIR + WHATSAPP BENTO ══ */}
      <section className="py-24 px-6 md:px-8 max-w-screen-2xl mx-auto" id="reparation">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="reveal md:col-span-7 primary-gradient rounded-xl p-10 lg:p-12 text-white flex flex-col justify-center relative overflow-hidden">
            <span className="material-symbols-outlined text-[190px] opacity-10 absolute -right-8 -top-8" style={{ fontVariationSettings: "'FILL' 1" }}>handyman</span>
            <span className="font-label uppercase tracking-widest text-on-primary-container text-sm mb-3">Atelier HAMDI</span>
            <h2 className="text-3xl lg:text-5xl font-black font-headline tracking-tighter mb-4 uppercase leading-[0.95]">Votre PC ne s'allume plus&nbsp;? On le répare.</h2>
            <p className="text-white/85 text-lg max-w-lg mb-8">Diagnostic honnête, réparation logicielle, matérielle et électronique au niveau composant. Devis clair avant intervention — vous payez uniquement si c'est réparé.</p>
            <div className="flex flex-wrap gap-3 mb-8">
              {REPAIR_TAGS.map((t) => <span key={t} className="px-3 py-1.5 rounded-full bg-white/15 font-headline font-bold text-xs uppercase tracking-tight">{t}</span>)}
            </div>
            <a className="self-start bg-white text-primary px-8 py-4 rounded-xl font-headline font-bold uppercase tracking-tight hover:bg-on-primary-container hover:text-white transition flex items-center gap-2" href={WA} target="_blank" rel="noopener noreferrer">
              <span className="material-symbols-outlined text-whatsapp" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span> Demander un diagnostic
            </a>
          </div>
          <div className="reveal md:col-span-5 bg-tertiary-container rounded-xl p-10 lg:p-12 text-white relative overflow-hidden flex flex-col justify-between" data-d="1">
            <span className="material-symbols-outlined text-[130px] opacity-15 absolute -right-8 -bottom-8" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
            <div>
              <p className="font-label text-on-tertiary-container uppercase tracking-widest mb-2 text-sm">Commander</p>
              <h3 className="text-3xl lg:text-4xl font-black font-headline leading-[0.95] mb-4">EN 1 MESSAGE<br />WHATSAPP</h3>
              <p className="text-white/80">Pas de paiement en ligne compliqué. Envoyez le modèle de votre PC, on confirme prix &amp; dispo, et on livre.</p>
            </div>
            <a className="mt-8 self-start bg-whatsapp text-white px-6 py-3.5 rounded-xl font-headline font-bold uppercase tracking-tight hover:brightness-95 transition flex items-center gap-2" href={WA} target="_blank" rel="noopener noreferrer">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span> +212 622 265 053
            </a>
          </div>
        </div>
      </section>

      <HomeInteractions />
    </>
  );
}
