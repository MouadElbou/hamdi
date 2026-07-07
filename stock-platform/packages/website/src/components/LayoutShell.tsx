'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart';

const WA = 'https://wa.me/212622265053';

const NAV_LINKS = [
  { label: 'Accueil', href: '/' },
  { label: 'Catalogue', href: '/catalogue' },
  { label: 'Réparation', href: '/catalogue?category=Services%20%26%20R%C3%A9paration' },
  { label: 'À propos', href: '/a-propos' },
  { label: 'Contact', href: '/contact' },
];

const FOOTER_CATS: [string, string][] = [
  ['Écrans & Dalles', 'Écrans & Dalles'],
  ['Batteries & Chargeurs', 'Batteries'],
  ['Claviers & Touches', 'Claviers & Touches'],
  ['PC Portables', 'PC Portables'],
];
const FOOTER_SERVICES = ['Réparation logicielle', 'Réparation matérielle', 'Électronique / Carte mère', 'Développement & web'];

const sym = (name: string, filled = false, cls = '') => (
  <span className={`material-symbols-outlined ${cls}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>{name}</span>
);

export function LayoutShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (pathname.startsWith('/admin')) return <>{children}</>;

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href.split('?')[0] ?? href));

  return (
    <>
      {/* NAV */}
      <nav className={`site-nav fixed top-0 w-full z-50 bg-background/85 glass-effect ${scrolled ? 'scrolled' : ''}`}>
        <div className="flex justify-between items-center w-full px-6 md:px-8 py-4 max-w-screen-2xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            {sym('memory', true, 'text-primary')}
            <span className="text-2xl font-black text-primary tracking-tighter font-headline">HAMDI PC</span>
          </Link>

          <div className="hidden lg:flex items-center space-x-9 font-headline font-bold uppercase tracking-tight text-sm">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={`navlink transition-colors ${isActive(l.href) ? 'active text-primary' : 'text-on-surface-variant hover:text-primary'}`}>{l.label}</Link>
            ))}
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <a className="hidden sm:flex items-center gap-2 bg-whatsapp text-white px-4 py-2.5 rounded-xl font-headline font-bold text-sm tracking-tight hover:brightness-95 active:scale-95 transition" href={WA} target="_blank" rel="noopener noreferrer">
              {sym('chat', true, 'text-[20px]')} Commander
            </a>
            <Link href="/cart" className="relative w-10 h-10 grid place-items-center rounded-xl text-primary hover:bg-surface-container transition active:scale-95" aria-label={`Panier (${totalItems})`}>
              {sym('shopping_cart')}
              {totalItems > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-primary text-white text-[10px] font-bold font-label">{totalItems}</span>}
            </Link>
            <Link href="/admin" className="hidden sm:grid w-10 h-10 place-items-center rounded-xl text-primary hover:bg-surface-container transition active:scale-95" aria-label="Compte">{sym('person')}</Link>
            <button className="lg:hidden w-10 h-10 grid place-items-center rounded-xl text-primary hover:bg-surface-container transition" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu">{sym(mobileOpen ? 'close' : 'menu')}</button>
          </div>
        </div>
        <div className="bg-outline-variant/60 h-px w-full absolute bottom-0" />

        {/* mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden bg-surface-container-lowest border-t border-outline-variant/40 px-6 py-4 space-y-1 font-headline font-bold uppercase tracking-tight text-sm">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={`block py-2.5 ${isActive(l.href) ? 'text-primary' : 'text-on-surface-variant'}`}>{l.label}</Link>
            ))}
            <a href={WA} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 bg-whatsapp text-white px-4 py-3 rounded-xl">{sym('chat', true)} Commander sur WhatsApp</a>
          </div>
        )}
      </nav>

      <main id="main-content" className="pt-20">{children}</main>

      {/* FOOTER */}
      <footer className="bg-surface-container-lowest w-full py-16 px-6 md:px-8 border-t border-outline-variant/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 max-w-screen-2xl mx-auto">
          <div className="space-y-5 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">{sym('memory', true, 'text-primary')}<span className="text-xl font-black text-primary font-headline">HAMDI PC</span></div>
            <p className="font-body text-sm tracking-wide text-on-surface-variant max-w-xs">Pièces détachées &amp; réparation PC portable. Oujda, Maroc. Commande simple par WhatsApp.</p>
            <a className="inline-flex items-center gap-2 text-whatsapp font-headline font-bold text-sm" href={WA} target="_blank" rel="noopener noreferrer">{sym('chat', true)} +212 622 265 053</a>
          </div>
          <div className="space-y-4">
            <h4 className="font-headline font-bold text-on-surface uppercase tracking-widest text-sm">Catalogue</h4>
            <ul className="space-y-2.5 font-body text-sm tracking-wide">
              {FOOTER_CATS.map(([label, cat]) => (
                <li key={label}><Link className="text-on-surface-variant hover:text-primary transition-colors" href={`/catalogue?category=${encodeURIComponent(cat)}`}>{label}</Link></li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="font-headline font-bold text-on-surface uppercase tracking-widest text-sm">Services</h4>
            <ul className="space-y-2.5 font-body text-sm tracking-wide">
              {FOOTER_SERVICES.map((s) => (
                <li key={s}><Link className="text-on-surface-variant hover:text-primary transition-colors" href="/catalogue?category=Services%20%26%20R%C3%A9paration">{s}</Link></li>
              ))}
            </ul>
          </div>
          <div className="space-y-5">
            <h4 className="font-headline font-bold text-on-surface uppercase tracking-widest text-sm">Horaires</h4>
            <ul className="space-y-2.5 font-body text-sm tracking-wide text-on-surface-variant">
              <li>Oujda, Maroc</li>
              <li>Lun – Sam · 9h – 19h</li>
            </ul>
            <div className="flex space-x-3 pt-1">
              <a href={WA} target="_blank" rel="noopener noreferrer" className="w-9 h-9 grid place-items-center rounded-xl bg-surface-container text-primary hover:bg-primary hover:text-white transition" aria-label="WhatsApp">{sym('chat', false, 'text-[20px]')}</a>
              <Link href="/contact" className="w-9 h-9 grid place-items-center rounded-xl bg-surface-container text-primary hover:bg-primary hover:text-white transition" aria-label="Contact">{sym('alternate_email', false, 'text-[20px]')}</Link>
            </div>
          </div>
        </div>
        <div className="max-w-screen-2xl mx-auto mt-14 pt-8 border-t border-outline-variant/40 flex flex-wrap justify-between gap-3">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-on-surface-variant/70 font-label">© {new Date().getFullYear()} HAMDI PC · Tous droits réservés</p>
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-on-surface-variant/70 font-label">Oujda · Maroc</p>
        </div>
      </footer>

      {/* floating WhatsApp */}
      <a href={WA} target="_blank" rel="noopener noreferrer" className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-whatsapp text-white grid place-items-center shadow-2xl shadow-whatsapp/40 hover:scale-110 transition-transform" aria-label="WhatsApp">
        <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
      </a>
    </>
  );
}
