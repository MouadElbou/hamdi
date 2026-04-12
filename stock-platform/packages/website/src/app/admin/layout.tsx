'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminAuthProvider, useAdminAuth } from '@/lib/admin-auth';
import { ToastProvider } from './components/Toast';
import './admin.css';

type Page = 'dashboard' | 'purchases' | 'stock' | 'sales' | 'maintenance' | 'battery-repair' | 'expenses' | 'credits' | 'bank' | 'monthly-summary' | 'zakat' | 'users';

/* ── SVG Icon components (18×18, stroke-based) — matches desktop exactly ── */
const icons: Record<Page, React.ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  purchases: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  stock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7l10-5 10 5-10 5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  ),
  sales: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  maintenance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  'battery-repair': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="12" rx="2" /><line x1="22" y1="11" x2="22" y2="15" /><line x1="6" y1="11" x2="6" y2="15" /><line x1="10" y1="11" x2="10" y2="15" />
    </svg>
  ),
  expenses: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  credits: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  bank: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" /><path d="M3 10h18" /><path d="M12 3l9 7H3z" />
      <line x1="5" y1="10" x2="5" y2="21" /><line x1="19" y1="10" x2="19" y2="21" />
      <line x1="9" y1="10" x2="9" y2="21" /><line x1="15" y1="10" x2="15" y2="21" />
    </svg>
  ),
  'monthly-summary': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  zakat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v12" /><path d="M15.5 9.5c-.8-1-2-1.5-3.5-1.5-2.2 0-4 1.3-4 3s1.8 3 4 3c2.2 0 4 1.3 4 3s-1.8 3-4 3c-1.5 0-2.7-.5-3.5-1.5" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
    label: 'Commerce',
    items: [
      { key: 'purchases', label: 'Achats', href: '/admin/purchases' },
      { key: 'stock', label: 'Stock', href: '/admin/stock' },
      { key: 'sales', label: 'Ventes', href: '/admin/sales' },
    ],
  },
  {
    label: 'Services',
    items: [
      { key: 'maintenance', label: 'Maintenance', href: '/admin/maintenance' },
      { key: 'battery-repair', label: 'Reparation batteries', href: '/admin/battery-repair' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { key: 'expenses', label: 'Depenses', href: '/admin/expenses' },
      { key: 'credits', label: 'Credits', href: '/admin/credits' },
      { key: 'bank', label: 'Banque', href: '/admin/bank' },
    ],
  },
  {
    label: 'Rapports',
    items: [
      { key: 'monthly-summary', label: 'Bilan mensuel', href: '/admin/monthly-summary' },
      { key: 'zakat', label: 'Zakat', href: '/admin/zakat' },
    ],
  },
];

function AdminShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { user, loading, isAdmin, hasPermission, logout } = useAdminAuth();
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
            <div className="brand-icon">S</div>
            <div>
              <div className="brand-text">Stock</div>
              <div className="brand-sub">Back Office</div>
            </div>
          </div>
        </div>

        <div className="nav-scroll">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(item => hasPermission(item.key));
            if (visibleItems.length === 0) return null;
            return (
              <div className="nav-section" key={section.label}>
                <div className="nav-section-label">{section.label}</div>
                <ul className="nav-list">
                  {visibleItems.map((item) => (
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
            );
          })}

          {isAdmin && (
            <div className="nav-section">
              <div className="nav-section-label">Administration</div>
              <ul className="nav-list">
                <li>
                  <Link
                    href="/admin/users"
                    className={`nav-item ${isActive('/admin/users') ? 'active' : ''}`}
                  >
                    {icons['users']}
                    Utilisateurs
                  </Link>
                </li>
              </ul>
            </div>
          )}
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
