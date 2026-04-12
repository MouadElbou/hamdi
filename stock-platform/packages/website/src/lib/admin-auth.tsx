'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, clearToken, type AdminUser } from './admin-api';

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  isAdmin: boolean;
  hasPermission: (page: string) => boolean;
  logout: () => void;
  setUser: (user: AdminUser) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    // Abort after 8 s to prevent the loading spinner from hanging forever when
    // the backend is unreachable (no connection-refused, just no response).
    const tid = setTimeout(() => controller.abort(), 8000);

    getMe(controller.signal)
      .then(u => { if (mounted) setUser(u); })
      .catch(() => { /* 401 or network error — leave user as null */ })
      .finally(() => { clearTimeout(tid); if (mounted) setLoading(false); });

    return () => { mounted = false; clearTimeout(tid); controller.abort(); };
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.location.href = '/admin/login';
  }, []);

  const isAdmin = user?.role === 'admin';

  const hasPermission = useCallback(
    (page: string) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return user.permissions.includes(page);
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, hasPermission, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
