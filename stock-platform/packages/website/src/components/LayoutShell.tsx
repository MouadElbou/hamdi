'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart';
import {
  MenuIcon,
  XIcon,
  PhoneIcon,
  HomeIcon,
  PackageIcon,
  ArrowUpIcon,
  ShoppingCartIcon,
} from '@/components/icons';

/* -- Nav links ---- */
const NAV_LINKS = [
  { label: 'Accueil', href: '/' },
  { label: 'Catalogue', href: '/catalogue' },
  { label: 'A propos', href: '/a-propos' },
  { label: 'Contact', href: '/contact' },
];

export function LayoutShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showScroll, setShowScroll] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    const onScroll = () => {
      setShowScroll(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Admin routes bypass the shell
  if (pathname.startsWith('/admin')) {
    return <>{children}</>;
  }

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Passer au contenu principal
      </a>

      {/* -- Fixed glass-effect nav bar (matches example.html) -- */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center p-2 text-blue-700 hover:opacity-80 transition-opacity"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={mobileOpen}
          >
            <MenuIcon size={24} />
          </button>

          {/* Brand */}
          <Link href="/" className="text-2xl font-black text-blue-800 tracking-tighter font-headline">
            HAMDI PC
          </Link>

          {/* Center nav links (desktop) */}
          <div className="hidden md:flex items-center space-x-8">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`font-headline font-bold uppercase tracking-tight transition-colors ${
                    isActive
                      ? 'text-blue-700 border-b-2 border-blue-700 pb-1'
                      : 'text-slate-600 hover:text-blue-600'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right icons */}
          <div className="flex items-center space-x-6">
            <button className="hover:opacity-80 transition-opacity duration-300 active:scale-95 transition-transform text-blue-700">
              <span className="material-symbols-outlined">favorite</span>
            </button>
            <Link href="/cart" className="hover:opacity-80 transition-opacity duration-300 active:scale-95 transition-transform text-blue-700 relative" aria-label={`Panier (${totalItems} articles)`}>
              <span className="material-symbols-outlined">shopping_cart</span>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-error text-on-error rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                  {totalItems}
                </span>
              )}
            </Link>
            <Link href="/admin" className="hover:opacity-80 transition-opacity duration-300 active:scale-95 transition-transform text-blue-700">
              <span className="material-symbols-outlined">person</span>
            </Link>
          </div>
        </div>
        {/* Subtle 1px separator */}
        <div className="bg-slate-100 h-[1px] w-full absolute bottom-0"></div>
      </nav>

      {/* -- Mobile overlay + drawer -- */}
      <div
        className={`mobile-nav-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <nav
        className={`mobile-nav-drawer ${mobileOpen ? 'open' : ''}`}
        aria-label="Menu mobile"
        role="dialog"
        aria-modal={mobileOpen}
      >
        <div className="mobile-nav-header">
          <Link href="/" className="text-xl font-black text-white tracking-tighter font-headline" onClick={() => setMobileOpen(false)}>
            HAMDI PC
          </Link>
          <button className="text-white/50 hover:text-white p-2" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu">
            <XIcon size={22} />
          </button>
        </div>
        <div className="mobile-nav-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
              {link.label === 'Accueil' && <HomeIcon size={18} />}
              {link.label === 'Catalogue' && <PackageIcon size={18} />}
              {link.label === 'Contact' && <PhoneIcon size={18} />}
              {link.label}
            </Link>
          ))}
          <Link href="/cart" onClick={() => setMobileOpen(false)}>
            <ShoppingCartIcon size={18} /> Panier {totalItems > 0 && `(${totalItems})`}
          </Link>
        </div>
        <div className="mobile-nav-contact">
          <a href="tel:+212536690306"><PhoneIcon size={14} /> +212 536 69 03 06</a>
          <a href="https://wa.me/212622265053" target="_blank" rel="noopener noreferrer">WhatsApp: +212 622 26 50 53</a>
          <a href="https://wa.me/212672532998" target="_blank" rel="noopener noreferrer">WhatsApp: +212 672 53 29 98</a>
        </div>
      </nav>

      <main id="main-content" className="pt-20">{children}</main>

      {/* -- Footer (matches example.html: bg-slate-50, border-t, 4-col grid) -- */}
      <footer className="bg-slate-50 w-full py-16 px-8 border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-screen-2xl mx-auto">
          {/* Col 1: Brand + description */}
          <div className="space-y-6">
            <div className="text-xl font-black text-blue-800 font-headline">HAMDI PC</div>
            <p className="text-sm tracking-wide text-slate-500">
              Votre partenaire informatique depuis 1997. Vente de materiel
              informatique, telephones, accessoires et composants. Un large
              choix de produits neufs et d&apos;occasion aux meilleurs prix a Oujda.
            </p>
          </div>

          {/* Col 2: Company */}
          <div className="space-y-4">
            <h4 className="font-headline font-bold text-on-surface uppercase tracking-widest text-sm">Entreprise</h4>
            <ul className="space-y-2 text-sm tracking-wide">
              <li><Link className="text-slate-500 hover:text-blue-600 transition-all hover:underline" href="/a-propos">A propos</Link></li>
              <li><Link className="text-slate-500 hover:text-blue-600 transition-all hover:underline" href="/contact">Contactez-nous</Link></li>
              <li><span className="text-slate-500">Conditions de service</span></li>
            </ul>
          </div>

          {/* Col 3: Support */}
          <div className="space-y-4">
            <h4 className="font-headline font-bold text-on-surface uppercase tracking-widest text-sm">Support</h4>
            <ul className="space-y-2 text-sm tracking-wide">
              <li><span className="text-slate-500">Politique de livraison</span></li>
              <li><span className="text-slate-500">Suivi de commande</span></li>
              <li><span className="text-slate-500">Politique de confidentialite</span></li>
            </ul>
          </div>

          {/* Col 4: Social */}
          <div className="space-y-6">
            <h4 className="font-headline font-bold text-on-surface uppercase tracking-widest text-sm">Suivez-nous</h4>
            <div className="flex space-x-4">
              <span className="material-symbols-outlined text-blue-700 cursor-pointer hover:scale-110 transition-transform">share</span>
              <span className="material-symbols-outlined text-blue-700 cursor-pointer hover:scale-110 transition-transform">language</span>
              <span className="material-symbols-outlined text-blue-700 cursor-pointer hover:scale-110 transition-transform">alternate_email</span>
            </div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400">
              &copy; {new Date().getFullYear()} HAMDI PC. TOUS DROITS RESERVES.
            </p>
          </div>
        </div>
      </footer>

      {/* -- Scroll to top -- */}
      <button
        className={`scroll-top-btn ${showScroll ? 'visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Remonter en haut"
      >
        <ArrowUpIcon size={20} />
      </button>
    </>
  );
}
