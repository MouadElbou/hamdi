'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart';
import {
  ShoppingCartIcon,
  MenuIcon,
  XIcon,
  PhoneIcon,
  MapPinIcon,
  HomeIcon,
  PackageIcon,
  SearchIcon,
  ArrowUpIcon,
} from '@/components/icons';

export function LayoutShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showScroll, setShowScroll] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    const onScroll = () => {
      setShowScroll(window.scrollY > 400);
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (pathname.startsWith('/admin')) {
    return <>{children}</>;
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Passer au contenu principal
      </a>

      <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
        {/* ── Top bar ── */}
        <div className="header-top">
          <div className="container header-top-inner">
            <div className="header-top-contacts">
              <a href="tel:+212536690306">
                <PhoneIcon size={14} /> +212 536 69 03 06
              </a>
              <span>
                <MapPinIcon size={14} /> Souk Mlilia n°914, Oujda
              </span>
            </div>
            <div className="header-top-right">
              <Link href="/admin">Espace Admin</Link>
            </div>
          </div>
        </div>

        {/* ── Main header ── */}
        <div className="header-main">
          <div className="container header-main-inner">
            <Link href="/" className="logo">
              <span className="logo-mark" aria-hidden="true" />
              Hamdi <span>PC</span>
              <span className="logo-sub">L&apos;informatique depuis 1997</span>
            </Link>

            <nav className="header-nav" aria-label="Navigation principale">
              <Link href="/" className={isActive('/') && pathname === '/' ? 'active' : ''}>
                Accueil
              </Link>
              <Link href="/catalogue" className={isActive('/catalogue') ? 'active' : ''}>
                Catalogue
              </Link>
              <Link href="/a-propos" className={isActive('/a-propos') ? 'active' : ''}>
                À propos
              </Link>
              <Link href="/contact" className={isActive('/contact') ? 'active' : ''}>
                Contact
              </Link>
            </nav>

            <div className="header-actions">
              <div className="header-search">
                <SearchIcon size={16} />
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  readOnly
                  onClick={() => {
                    window.location.href = '/catalogue';
                  }}
                />
              </div>
              <Link href="/cart" className="icon-btn" aria-label={`Panier (${totalItems} articles)`}>
                <ShoppingCartIcon size={20} />
                {totalItems > 0 && <span className="badge">{totalItems}</span>}
              </Link>
              <button
                className="mobile-menu-btn"
                onClick={() => setMobileOpen(true)}
                aria-label="Ouvrir le menu"
                aria-expanded={mobileOpen}
              >
                <MenuIcon size={24} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
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
          <h2>Menu</h2>
          <button className="mobile-close-btn" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu">
            <XIcon size={20} />
          </button>
        </div>
        <div className="mobile-nav-links">
          <Link href="/" className={isActive('/') && pathname === '/' ? 'active' : ''}>
            <HomeIcon size={20} /> Accueil
          </Link>
          <Link href="/catalogue" className={isActive('/catalogue') ? 'active' : ''}>
            <PackageIcon size={20} /> Catalogue
          </Link>
          <Link href="/a-propos" className={isActive('/a-propos') ? 'active' : ''}>
            <PackageIcon size={20} /> À propos
          </Link>
          <Link href="/contact" className={isActive('/contact') ? 'active' : ''}>
            <PhoneIcon size={20} /> Contact
          </Link>
          <Link href="/cart" className={isActive('/cart') ? 'active' : ''}>
            <ShoppingCartIcon size={20} /> Panier {totalItems > 0 && `(${totalItems})`}
          </Link>
        </div>
        <div className="mobile-nav-contact">
          <a href="tel:+212536690306"><PhoneIcon size={16} /> +212 536 69 03 06</a>
          <a href="https://wa.me/212622265053" target="_blank" rel="noopener noreferrer">WhatsApp: +212 622 26 50 53</a>
        </div>
      </nav>

      <main id="main-content">{children}</main>

      {/* ── Footer ── */}
      <footer className="site-footer" id="contact">
        <div className="footer-main">
          <div className="container footer-grid">
            <div className="footer-col">
              <div className="footer-brand">
                <span className="logo-mark" aria-hidden="true" />
                <span className="footer-brand-name">Hamdi <span>PC</span></span>
              </div>
              <p>L&apos;informatique depuis 1997. Vente de matériel informatique, téléphones, accessoires et composants à Oujda.</p>
            </div>
            <div className="footer-col">
              <h4>Navigation</h4>
              <Link href="/">Accueil</Link>
              <Link href="/catalogue">Catalogue</Link>
              <Link href="/a-propos">À propos</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/cart">Panier</Link>
            </div>
            <div className="footer-col">
              <h4>Contact</h4>
              <div className="footer-contact-item">
                <PhoneIcon size={16} />
                <span>+212 536 69 03 06</span>
              </div>
              <div className="footer-contact-item">
                <PhoneIcon size={16} />
                <span>WhatsApp: +212 622 26 50 53</span>
              </div>
              <div className="footer-contact-item">
                <PhoneIcon size={16} />
                <span>WhatsApp: +212 672 53 29 98</span>
              </div>
            </div>
            <div className="footer-col">
              <h4>Adresse</h4>
              <div className="footer-contact-item">
                <MapPinIcon size={16} />
                <span>Souk Mlilia n°914, Oujda, Maroc</span>
              </div>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="container">
            <p>&copy; {new Date().getFullYear()} Hamdi PC — Tous droits réservés.</p>
          </div>
        </div>
      </footer>

      {/* ── Scroll to top ── */}
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
