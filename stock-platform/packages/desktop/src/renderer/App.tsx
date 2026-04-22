import React, { useState, Component } from 'react';
import { Dashboard } from './pages/Dashboard.js';
import { PurchasesPage } from './pages/PurchasesPage.js';
import { StockPage } from './pages/StockPage.js';
import { SalesPage } from './pages/SalesPage.js';
import { MaintenancePage } from './pages/MaintenancePage.js';
import { BatteryRepairPage } from './pages/BatteryRepairPage.js';
import { ExpensesPage } from './pages/ExpensesPage.js';
import { CreditsPage } from './pages/CreditsPage.js';
import { BankPage } from './pages/BankPage.js';
import { MonthlySummaryPage } from './pages/MonthlySummaryPage.js';
import { ZakatPage } from './pages/ZakatPage.js';
import { AdminUsersPage } from './pages/AdminUsersPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { CustomerOrdersPage } from './pages/CustomerOrdersPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { SyncStatusBar } from './components/SyncStatusBar.js';
import { ThemeToggle } from './components/ThemeToggle.js';
import { ToastProvider, useToast } from './components/Toast.js';
import { ReferenceDataProvider } from './components/ReferenceDataContext.js';
import { AuthProvider, useAuth } from './components/AuthContext.js';
import { ChangePasswordModal } from './components/ChangePasswordModal.js';
import './styles.css';

type Page = 'dashboard' | 'notifications' | 'purchases' | 'stock' | 'sales' | 'customer-orders' | 'maintenance' | 'battery-repair' | 'expenses' | 'credits' | 'bank' | 'monthly-summary' | 'zakat' | 'admin-users' | 'settings';

/* ── Icon components (18×18, stroke-based) ── */
const icons: Record<Page, React.ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  notifications: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
  'customer-orders': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
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
  'admin-users': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

interface NavSection {
  label: string;
  items: Array<{ key: Page; label: string }>;
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'General',
    items: [{ key: 'dashboard', label: 'Tableau de bord' }],
  },
  {
    label: 'Commerce',
    items: [
      { key: 'purchases', label: 'Achats' },
      { key: 'stock', label: 'Stock' },
      { key: 'sales', label: 'Ventes' },
      { key: 'customer-orders', label: 'Commandes' },
    ],
  },
  {
    label: 'Services',
    items: [
      { key: 'maintenance', label: 'Maintenance' },
      { key: 'battery-repair', label: 'Reparation batteries' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { key: 'expenses', label: 'Depenses' },
      { key: 'credits', label: 'Credits' },
      { key: 'bank', label: 'Banque' },
    ],
  },
  {
    label: 'Rapports',
    items: [
      { key: 'monthly-summary', label: 'Bilan mensuel' },
      { key: 'zakat', label: 'Zakat' },
    ],
  },
];

const PAGE_MAP: Record<Page, React.ComponentType> = {
  dashboard: Dashboard,
  notifications: NotificationsPage,
  purchases: PurchasesPage,
  stock: StockPage,
  sales: SalesPage,
  'customer-orders': CustomerOrdersPage,
  maintenance: MaintenancePage,
  'battery-repair': BatteryRepairPage,
  expenses: ExpensesPage,
  credits: CreditsPage,
  bank: BankPage,
  'monthly-summary': MonthlySummaryPage,
  zakat: ZakatPage,
  'admin-users': AdminUsersPage,
  settings: SettingsPage,
};

function AppInner(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { addToast } = useToast();
  const { user, isAdmin, hasPermission, logout } = useAuth();

  React.useEffect(() => {
    window.api.stock.lowStockAlerts().then((r: unknown) => { const alerts = r as Array<{ designation: string; remaining: number }>;
      if (alerts && alerts.length > 0) {
        if (alerts.length <= 3) {
          alerts.forEach(a => addToast(`Stock faible: ${a.designation} — ${a.remaining} restant(s)`, 'warning'));
        } else {
          addToast(`${alerts.length} articles avec stock faible (≤ 1 unité)`, 'warning');
        }
      }
    }).catch((err: unknown) => {
      console.warn('[StockAlerts] Failed to load:', (err as Error).message);
    });
  }, [addToast]);

  // If user navigated to a page they no longer have access to, redirect to dashboard
  React.useEffect(() => {
    const adminOnly = currentPage === 'admin-users' || currentPage === 'settings';
    if (adminOnly ? !isAdmin : !hasPermission(currentPage)) {
      setCurrentPage('dashboard');
    }
  }, [currentPage, hasPermission]);

  const PageComponent = PAGE_MAP[currentPage];

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
                      <button
                        className={`nav-item ${currentPage === item.key ? 'active' : ''}`}
                        onClick={() => setCurrentPage(item.key)}
                        {...(currentPage === item.key ? { 'aria-current': 'page' as const } : {})}
                      >
                        {icons[item.key]}
                        {item.label}
                      </button>
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
                  <button
                    className={`nav-item ${currentPage === 'admin-users' ? 'active' : ''}`}
                    onClick={() => setCurrentPage('admin-users')}
                    {...(currentPage === 'admin-users' ? { 'aria-current': 'page' as const } : {})}
                  >
                    {icons['admin-users']}
                    Utilisateurs
                  </button>
                </li>
                <li>
                  <button
                    className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
                    onClick={() => setCurrentPage('settings')}
                    {...(currentPage === 'settings' ? { 'aria-current': 'page' as const } : {})}
                  >
                    {icons.settings}
                    Paramètres
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>

        <ThemeToggle />
        <SyncStatusBar />

        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{user.displayName.charAt(0)}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.displayName}</div>
              <div className="sidebar-user-role">{isAdmin ? 'Administrateur' : 'Employé'}</div>
            </div>
            <button
              className="sidebar-logout-btn"
              onClick={() => setChangePasswordOpen(true)}
              title="Changer le mot de passe"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </button>
            <button className="sidebar-logout-btn" onClick={logout} title="Déconnexion">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </nav>
      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />

      <main className="main-content">
        <button
          className={`notif-bell${currentPage === 'notifications' ? ' active' : ''}`}
          title="Notifications"
          onClick={() => setCurrentPage('notifications')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
        <div className="page-enter" key={currentPage}>
          <PageErrorBoundary>
            {currentPage === 'dashboard' ? <Dashboard onNavigate={(p: string) => setCurrentPage(p as Page)} />
              : currentPage === 'sales' ? <SalesPage onNavigate={(p: string) => setCurrentPage(p as Page)} />
              : <PageComponent />}
          </PageErrorBoundary>
        </div>
      </main>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: React.ReactNode; fallbackMinHeight?: string }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode; fallbackMinHeight?: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: this.props.fallbackMinHeight ?? '100vh', gap: 16, padding: 32, textAlign: 'center' }}>
          <h2>Quelque chose s&apos;est mal passé</h2>
          <p style={{ color: '#888', maxWidth: 500 }}>{this.state.error?.message}</p>
          <button className="btn btn-primary" onClick={() => this.setState({ hasError: false, error: null })}>Réessayer</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Per-page error boundary — catches page crashes without taking down the whole app */
function PageErrorBoundary({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <ErrorBoundary fallbackMinHeight="400px">{children}</ErrorBoundary>;
}

function AuthGate(): React.JSX.Element {
  const { user, mustChangePassword } = useAuth();

  if (!user || mustChangePassword) {
    return <LoginPage />;
  }

  return (
    <ReferenceDataProvider>
      <AppInner />
    </ReferenceDataProvider>
  );
}

export function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
