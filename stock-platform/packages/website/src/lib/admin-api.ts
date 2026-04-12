/**
 * Admin API client — handles JWT auth and backend communication
 */

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? '';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin-token');
}

export function setToken(token: string): void {
  localStorage.setItem('admin-token', token);
  // Also set a cookie so Next.js middleware can verify the token server-side.
  // Only add Secure flag on HTTPS — on HTTP (localhost) the browser silently drops Secure cookies,
  // which would cause the middleware to never find the token and redirect-loop to /admin/login.
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `admin_token=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Strict${secure}`;
}

export function clearToken(): void {
  localStorage.removeItem('admin-token');
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `admin_token=; path=/; max-age=0; SameSite=Strict${secure}`;
}

async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: options.signal });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
      window.location.href = '/admin/login';
    }
  }

  return res;
}

export async function adminGet<T>(path: string, options?: { signal?: AbortSignal }): Promise<T> {
  const res = await adminFetch(path, { signal: options?.signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function adminPost<T>(path: string, body: unknown, options?: { signal?: AbortSignal }): Promise<T> {
  const res = await adminFetch(path, { method: 'POST', body: JSON.stringify(body), signal: options?.signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function adminPut<T>(path: string, body: unknown, options?: { signal?: AbortSignal }): Promise<T> {
  const res = await adminFetch(path, { method: 'PUT', body: JSON.stringify(body), signal: options?.signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function adminPatch<T>(path: string, body: unknown, options?: { signal?: AbortSignal }): Promise<T> {
  const res = await adminFetch(path, { method: 'PATCH', body: JSON.stringify(body), signal: options?.signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function adminDelete(path: string, options?: { signal?: AbortSignal }): Promise<void> {
  const res = await adminFetch(path, { method: 'DELETE', signal: options?.signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
  }
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'employee';
  mustChangePassword: boolean;
  permissions: string[];
}

export async function login(username: string, password: string): Promise<{ token: string; user: AdminUser }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Échec de la connexion');
  }

  const data = await res.json() as { token: string; user: AdminUser };
  setToken(data.token);
  return data;
}

export async function getMe(signal?: AbortSignal): Promise<AdminUser> {
  return adminGet<AdminUser>('/auth/me', { signal });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await adminPost('/auth/change-password', { currentPassword, newPassword });
}
