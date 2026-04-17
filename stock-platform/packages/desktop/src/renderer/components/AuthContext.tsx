import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'employee';
  employeeId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  permissions: string[];
  isAdmin: boolean;
  mustChangePassword: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  hasPermission: (pageKey: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_EVENTS: Array<keyof DocumentEventMap> = ['mousedown', 'keydown', 'scroll', 'touchstart'];

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const idleTimerRef = useRef<number>(0);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setUser(null);
      setPermissions([]);
      setMustChangePassword(false);
      window.api.auth.logout().catch(() => {});
    }, SESSION_TIMEOUT_MS);
  }, []);

  // Set up / tear down activity listeners when user logs in/out
  useEffect(() => {
    if (!user) {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      return;
    }
    resetIdleTimer();
    for (const evt of ACTIVITY_EVENTS) document.addEventListener(evt, resetIdleTimer, { passive: true });
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      for (const evt of ACTIVITY_EVENTS) document.removeEventListener(evt, resetIdleTimer);
    };
  }, [user, resetIdleTimer]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await window.api.auth.login({ username, password }) as {
      user: AuthUser;
      permissions: string[];
      mustChangePassword: boolean;
    };
    setUser(result.user);
    setPermissions(result.permissions);
    setMustChangePassword(result.mustChangePassword);
  }, []);

  const logout = useCallback(async () => {
    await window.api.auth.logout();
    setUser(null);
    setPermissions([]);
    setMustChangePassword(false);
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!user) return;
    await window.api.auth.changePassword({ userId: user.id, oldPassword, newPassword });
    setMustChangePassword(false);
  }, [user]);

  const isAdmin = user?.role === 'admin';

  const hasPermission = useCallback((pageKey: string) => {
    if (!user) return false;
    if (isAdmin) return true;
    return permissions.includes(pageKey);
  }, [user, isAdmin, permissions]);

  return (
    <AuthContext.Provider value={{ user, permissions, isAdmin, mustChangePassword, login, logout, changePassword, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
