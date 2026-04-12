'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/admin-api';
import { useAdminAuth } from '@/lib/admin-auth';
import { LoaderIcon } from '@/components/icons';

export default function AdminLoginPage(): React.JSX.Element {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading, setUser } = useAdminAuth();

  // Redirect authenticated users away from login
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/admin');
    }
  }, [authLoading, user, router]);

  if (authLoading || user) {
    return <div style={{ textAlign: 'center', padding: '4rem' }}>Chargement...</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { user } = await login(username.trim(), password);
      setUser(user);

      if (user.mustChangePassword) {
        router.push('/admin/change-password');
      } else {
        router.push('/admin');
      }
    } catch (err) {
      setError((err as Error).message || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <div className="admin-brand-icon">S</div>
          <h1>Stock Admin</h1>
          <p>Connectez-vous pour accéder au panneau d&apos;administration</p>
        </div>

        {error && <div className="admin-login-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="username">Nom d&apos;utilisateur</label>
            <input
              id="username"
              className="admin-form-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="password">Mot de passe</label>
            <input
              id="password"
              className="admin-form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="admin-btn admin-btn-primary admin-login-submit"
            disabled={loading}
          >
            {loading ? <><LoaderIcon size={16} /> Connexion...</> : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
