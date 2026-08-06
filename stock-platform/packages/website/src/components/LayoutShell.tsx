'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { WA_LINES, waLink } from '@/lib/whatsapp';
import { OrderButton, WaFab, WaLineButtons, WhatsAppGlyph } from '@/components/WhatsAppOrder';
import { CataloguePanel, ServicesPanel } from '@/components/nav/MegaMenu';
import { useNavTree, catalogueHref, prefetchNavTree } from '@/components/nav/nav-data';

type MenuId = 'catalogue' | 'services';

interface NavLink { label: string; href: string; menu?: MenuId }

const SERVICES_LABEL = 'Services & Réparation';
const SERVICES_HREF = catalogueHref(SERVICES_LABEL);

const NAV_LINKS: NavLink[] = [
  { label: 'Accueil', href: '/' },
  { label: 'Catalogue', href: '/catalogue', menu: 'catalogue' },
  { label: 'Réparation', href: SERVICES_HREF, menu: 'services' },
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

const chevron = (
  <svg className="nav-caret" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
);

/* ─────────────────────────── mobile drawer ─────────────────────────── */

function MobileMenu({ onNavigate }: { onNavigate: () => void }): React.JSX.Element {
  const tree = useNavTree();
  const [section, setSection] = useState<MenuId | null>(null);
  const services = tree.find((c) => c.category === SERVICES_LABEL);

  const toggle = (id: MenuId) => setSection((s) => (s === id ? null : id));

  return (
    <div className="mobile-drawer lg:hidden">
      {NAV_LINKS.map((l) =>
        l.menu ? (
          <div key={l.href} className="mobile-group">
            <div className="mobile-row">
              <Link href={l.href} className="mobile-link" onClick={onNavigate}>{l.label}</Link>
              <button
                type="button"
                className={`mobile-toggle${section === l.menu ? ' is-open' : ''}`}
                aria-expanded={section === l.menu}
                aria-label={`Afficher les rubriques ${l.label}`}
                onClick={() => toggle(l.menu as MenuId)}
              >
                {chevron}
              </button>
            </div>
            {section === l.menu && (
              <ul className="mobile-sub">
                {(l.menu === 'catalogue'
                  ? tree.map((c) => ({ label: c.category, href: catalogueHref(c.category) }))
                  : (services?.subCategories ?? []).map((s) => ({
                      label: s.name,
                      // Only a live tree carries the sub-category values products
                      // are actually tagged with — see nav-data.ts.
                      href: services?.live
                        ? catalogueHref(SERVICES_LABEL, { subCategory: s.name })
                        : catalogueHref(SERVICES_LABEL),
                    }))
                ).map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="mobile-sublink" onClick={onNavigate}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <Link key={l.href} href={l.href} className="mobile-link mobile-link--solo" onClick={onNavigate}>{l.label}</Link>
        ),
      )}

      <div className="mobile-wa">
        <span className="mobile-wa-title">Commander sur WhatsApp</span>
        <WaLineButtons compact />
      </div>
    </div>
  );
}

/* ────────────────────────────── shell ────────────────────────────── */

export function LayoutShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggers = useRef<Partial<Record<MenuId, HTMLAnchorElement | null>>>({});

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const scheduleOpen = useCallback((id: MenuId) => { clear(); timer.current = setTimeout(() => setOpenMenu(id), 90); }, []);
  const scheduleClose = useCallback(() => { clear(); timer.current = setTimeout(() => setOpenMenu(null), 170); }, []);
  const closeNow = useCallback(() => { clear(); setOpenMenu(null); }, []);

  useEffect(() => clear, []);
  useEffect(() => { setMobileOpen(false); setOpenMenu(null); }, [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Warm the category tree before the first hover so the panel never has to
  // render the static-taxonomy fallback. Memoised, so repeat calls are free.
  useEffect(() => { if (!pathname.startsWith('/admin')) prefetchNavTree(); }, [pathname]);

  // Document-level dismissal: a hover-opened menu leaves focus on <body>, so a
  // handler bound to <nav> would never see Escape.
  useEffect(() => {
    if (!openMenu) return;
    const trigger = triggers.current[openMenu];
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const refocus = navRef.current?.contains(document.activeElement);
      closeNow();
      if (refocus) trigger?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) closeNow();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [openMenu, closeNow]);

  // The drawer locks the page; the mega-menu must not.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  if (pathname.startsWith('/admin')) return <>{children}</>;

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href.split('?')[0] ?? href));

  return (
    <>
      {/* NAV */}
      <nav
        ref={navRef}
        className={`site-nav fixed top-0 w-full z-50 bg-background/85 glass-effect ${scrolled ? 'scrolled' : ''}${openMenu ? ' has-mega' : ''}`}
        onMouseLeave={scheduleClose}
        onBlurCapture={(e) => {
          if (!navRef.current?.contains(e.relatedTarget as Node | null)) closeNow();
        }}
      >
        <div className="flex justify-between items-center w-full px-6 md:px-8 py-4 max-w-screen-2xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5" onClick={closeNow}>
            {sym('memory', true, 'text-primary')}
            <span className="text-2xl font-black text-primary tracking-tighter font-headline">HAMDI PC</span>
          </Link>

          {/* gap-9, not space-x-9: space-x sets margins on children, which would
              shift the absolutely-positioned panel rendered between them. */}
          <div className="hidden lg:flex items-center gap-9 font-headline font-bold uppercase tracking-tight text-sm">
            {NAV_LINKS.map((l) => (
              <React.Fragment key={l.href}>
                <Link
                  href={l.href}
                  ref={l.menu ? (el) => { triggers.current[l.menu as MenuId] = el; } : undefined}
                  className={`navlink transition-colors ${isActive(l.href) ? 'active text-primary' : 'text-on-surface-variant hover:text-primary'}${openMenu && openMenu === l.menu ? ' is-open' : ''}`}
                  aria-expanded={l.menu ? openMenu === l.menu : undefined}
                  aria-controls={l.menu ? `mega-${l.menu}` : undefined}
                  onMouseEnter={() => (l.menu ? scheduleOpen(l.menu) : scheduleClose())}
                  onFocus={() => (l.menu ? scheduleOpen(l.menu) : closeNow())}
                  onClick={closeNow}
                >
                  {l.label}{l.menu ? chevron : null}
                </Link>

                {/* Rendered right after its trigger so Tab walks straight into it.
                    Absolutely positioned, so it is out of flow and does not affect
                    the header layout. */}
                {l.menu && openMenu === l.menu && (
                  <div id={`mega-${l.menu}`} className="mega-wrap" onMouseEnter={clear}>
                    <div className="mega-scrim" aria-hidden />
                    <div className="mega-inner">
                      {l.menu === 'catalogue'
                        ? <CataloguePanel onNavigate={closeNow} />
                        : <ServicesPanel onNavigate={closeNow} />}
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:block"><OrderButton closeKey={pathname} /></div>
            <Link href="/cart" className="relative w-10 h-10 grid place-items-center rounded-xl text-primary hover:bg-surface-container transition active:scale-95" aria-label={`Panier (${totalItems})`}>
              {sym('shopping_cart')}
              {totalItems > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-primary text-white text-[10px] font-bold font-label">{totalItems}</span>}
            </Link>
            <Link href="/admin" className="hidden sm:grid w-10 h-10 place-items-center rounded-xl text-primary hover:bg-surface-container transition active:scale-95" aria-label="Compte">{sym('person')}</Link>
            <button className="lg:hidden w-10 h-10 grid place-items-center rounded-xl text-primary hover:bg-surface-container transition" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu" aria-expanded={mobileOpen}>{sym(mobileOpen ? 'close' : 'menu')}</button>
          </div>
        </div>
        <div className="bg-outline-variant/60 h-px w-full absolute bottom-0" />

        {mobileOpen && <MobileMenu onNavigate={() => setMobileOpen(false)} />}
      </nav>

      <main id="main-content" className="pt-20">{children}</main>

      {/* FOOTER */}
      <footer className="bg-surface-container-lowest w-full py-16 px-6 md:px-8 border-t border-outline-variant/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 max-w-screen-2xl mx-auto">
          <div className="space-y-5 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">{sym('memory', true, 'text-primary')}<span className="text-xl font-black text-primary font-headline">HAMDI PC</span></div>
            <p className="font-body text-sm tracking-wide text-on-surface-variant max-w-xs">Pièces détachées &amp; réparation PC portable. Oujda, Maroc. Commande simple par WhatsApp.</p>
            <div className="flex flex-col gap-2">
              {WA_LINES.map((line) => (
                <a key={line.phone} className="inline-flex items-center gap-2 text-whatsapp font-headline font-bold text-sm hover:brightness-90 transition" href={waLink(line.phone)} target="_blank" rel="noopener noreferrer">
                  <WhatsAppGlyph size={18} /> {line.display}
                </a>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="font-headline font-bold text-on-surface uppercase tracking-widest text-sm">Catalogue</h4>
            <ul className="space-y-2.5 font-body text-sm tracking-wide">
              {FOOTER_CATS.map(([label, cat]) => (
                <li key={label}><Link className="text-on-surface-variant hover:text-primary transition-colors" href={catalogueHref(cat)}>{label}</Link></li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="font-headline font-bold text-on-surface uppercase tracking-widest text-sm">Services</h4>
            <ul className="space-y-2.5 font-body text-sm tracking-wide">
              {FOOTER_SERVICES.map((s) => (
                <li key={s}><Link className="text-on-surface-variant hover:text-primary transition-colors" href={SERVICES_HREF}>{s}</Link></li>
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
              <a href={waLink(WA_LINES[0]!.phone)} target="_blank" rel="noopener noreferrer" className="w-9 h-9 grid place-items-center rounded-xl bg-surface-container text-primary hover:bg-primary hover:text-white transition" aria-label="WhatsApp">
                <WhatsAppGlyph size={19} />
              </a>
              <Link href="/contact" className="w-9 h-9 grid place-items-center rounded-xl bg-surface-container text-primary hover:bg-primary hover:text-white transition" aria-label="Contact">{sym('alternate_email', false, 'text-[20px]')}</Link>
            </div>
          </div>
        </div>
        <div className="max-w-screen-2xl mx-auto mt-14 pt-8 border-t border-outline-variant/40 flex flex-wrap justify-between gap-3">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-on-surface-variant/70 font-label">© {new Date().getFullYear()} HAMDI PC · Tous droits réservés</p>
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-on-surface-variant/70 font-label">Oujda · Maroc</p>
        </div>
      </footer>

      <WaFab />
    </>
  );
}
