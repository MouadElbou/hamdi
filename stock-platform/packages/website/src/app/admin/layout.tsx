'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminAuthProvider, useAdminAuth } from '@/lib/admin-auth';
import { ToastProvider } from './components/Toast';
import './admin.css';

type Page = 'dashboard' | 'products';

/* ── SVG Icon components (18×18, stroke-based) ── */
const icons: Record<Page, React.ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  products: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
};

interface NavSection {
  label: string;
  items: Array<{ key: Page; label: string; href: string }>;
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'General',
    items: [{ key: 'dashboard', label: 'Tableau de bord', href: '/admin' }],
  },
  {
    label: 'Catalogue',
    items: [{ key: 'products', label: 'Produits', href: '/admin/products' }],
  },
];

function AdminShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { user, loading, isAdmin, logout } = useAdminAuth();
  const pathname = usePathname();
  const [, setSidebarOpen] = useState(true);

  // Login page — render children directly (no shell)
  if (pathname.includes('/login') || pathname.includes('/change-password')) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
        <p>Chargement...</p>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
    return <></>;
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div className="app-layout">
      <nav className="sidebar" aria-label="Navigation principale">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <div className="brand-icon">H</div>
            <div>
              <div className="brand-text">HAMDI PC</div>
              <div className="brand-sub">Site Admin</div>
            </div>
          </div>
        </div>

        <div className="nav-scroll">
          {NAV_SECTIONS.map((section) => (
            <div className="nav-section" key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              <ul className="nav-list">
                {section.items.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                      onClick={() => setSidebarOpen(true)}
                    >
                      {icons[item.key]}
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{user.displayName.charAt(0)}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.displayName}</div>
              <div className="sidebar-user-role">{isAdmin ? 'Administrateur' : 'Employé'}</div>
            </div>
            <button className="sidebar-logout-btn" onClick={logout} title="Déconnexion">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </nav>

      <main className="main-content">
        <div className="page-enter" key={pathname}>
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <ToastProvider>
        <AdminShell>{children}</AdminShell>
      </ToastProvider>
    </AdminAuthProvider>
  );
}
