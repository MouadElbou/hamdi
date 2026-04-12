import React, { useState } from 'react';
import { useAuth } from '../components/AuthContext.js';

export function LoginPage(): React.JSX.Element {
  const { login, mustChangePassword, changePassword, user } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Change password form
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      setError((err as Error).message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    if (newPwd !== confirmPwd) {
      setPwdError('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPwd.length < 8) {
      setPwdError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    setPwdLoading(true);
    try {
      await changePassword(oldPwd, newPwd);
    } catch (err: unknown) {
      setPwdError((err as Error).message || 'Erreur lors du changement de mot de passe');
    } finally {
      setPwdLoading(false);
    }
  };

  if (mustChangePassword && user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-icon">S</div>
            <div className="brand-text">Stock</div>
            <div className="brand-sub">Back Office</div>
          </div>
          <h2 className="login-title">Changement de mot de passe requis</h2>
          <p className="login-subtitle">Bienvenue {user.displayName}, veuillez changer votre mot de passe</p>
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label>Ancien mot de passe</label>
              <div className="password-wrap">
                <input type={showOldPwd ? 'text' : 'password'} value={oldPwd} onChange={e => setOldPwd(e.target.value)} required autoFocus />
                <button type="button" className="password-toggle" onClick={() => setShowOldPwd(!showOldPwd)} tabIndex={-1}>
                  {showOldPwd ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Nouveau mot de passe</label>
              <div className="password-wrap">
                <input type={showNewPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} required minLength={8} />
                <button type="button" className="password-toggle" onClick={() => setShowNewPwd(!showNewPwd)} tabIndex={-1}>
                  {showNewPwd ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Confirmer le mot de passe</label>
              <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required minLength={8} />
            </div>
            {pwdError && <div className="login-error">{pwdError}</div>}
            <button type="submit" className="btn btn-primary login-btn" disabled={pwdLoading}>
              {pwdLoading ? 'Changement...' : 'Changer le mot de passe'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon">S</div>
          <div className="brand-text">Stock</div>
          <div className="brand-sub">Back Office</div>
        </div>
        <h2 className="login-title">Connexion</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Nom d&apos;utilisateur</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Entrez votre nom d'utilisateur" required autoFocus />
          </div>
          <div className="form-group">
            <label>Mot de passe</label>
            <div className="password-wrap">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Entrez votre mot de passe" required />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
