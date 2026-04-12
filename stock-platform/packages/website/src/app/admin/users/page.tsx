'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { adminGet, adminPost, adminPut, adminDelete } from '@/lib/admin-api';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

interface UserRecord {
  id: string;
  username: string;
  display_name: string;
  role: string;
  employee_id: string | null;
  employee_name: string | null;
  is_active: number;
  must_change_password: number;
  created_at: string;
  permissions: string[];
}

interface Employee {
  id: string;
  name: string;
  is_active: number;
}

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  purchases: 'Achats',
  stock: 'Stock',
  sales: 'Ventes',
  maintenance: 'Maintenance',
  'battery-repair': 'Réparation batteries',
  expenses: 'Dépenses',
  credits: 'Crédits',
  bank: 'Banque',
  'monthly-summary': 'Bilan mensuel',
  zakat: 'Zakat',
};

const ALL_PAGES = Object.keys(PAGE_LABELS);

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

export default function UsersPage() {
  const { addToast } = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [showResetModal, setShowResetModal] = useState<string | null>(null);
  const [resetPwd, setResetPwd] = useState('');

  // Form state
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'employee'>('employee');
  const [formEmployeeId, setFormEmployeeId] = useState<string>('');
  const [formPermissions, setFormPermissions] = useState<string[]>([...ALL_PAGES]);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminGet<{ id: string }>('/auth/me').then(setCurrentUser).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, e] = await Promise.all([
        adminGet<UserRecord[]>('/users'),
        adminGet<Employee[]>('/employees'),
      ]);
      setUsers(u);
      setEmployees(e);
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormPassword('');
    setFormDisplayName('');
    setFormRole('employee');
    setFormEmployeeId('');
    setFormPermissions([...ALL_PAGES]);
    setFormActive(true);
    setShowModal(true);
  };

  const openEdit = (u: UserRecord) => {
    setEditingUser(u);
    setFormUsername(u.username);
    setFormPassword('');
    setFormDisplayName(u.display_name);
    setFormRole(u.role as 'admin' | 'employee');
    setFormEmployeeId(u.employee_id || '');
    setFormPermissions([...u.permissions]);
    setFormActive(!!u.is_active);
    setShowModal(true);
  };

  const togglePermission = (page: string) => {
    setFormPermissions(prev =>
      prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (editingUser) {
        await adminPut('/users/' + editingUser.id, {
          displayName: formDisplayName,
          isActive: formActive,
          role: formRole,
          permissions: formRole === 'admin' ? ALL_PAGES : formPermissions,
        });
        addToast('Utilisateur mis à jour', 'success');
      } else {
        await adminPost('/users', {
          username: formUsername,
          password: formPassword,
          displayName: formDisplayName,
          role: formRole,
          employeeId: formEmployeeId || undefined,
          permissions: formRole === 'admin' ? ALL_PAGES : formPermissions,
        });
        addToast('Compte créé avec succès', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!showResetModal || resetPwd.length < 8) {
      addToast('Le mot de passe doit contenir au moins 8 caractères', 'error');
      return;
    }
    try {
      await adminPut('/users/' + showResetModal, { password: resetPwd });
      addToast('Mot de passe réinitialisé', 'success');
      setShowResetModal(null);
      setResetPwd('');
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur', 'error');
    }
  };

  const handleDelete = async (u: UserRecord) => {
    if (u.id === currentUser?.id) {
      addToast('Vous ne pouvez pas supprimer votre propre compte', 'error');
      return;
    }
    if (!await confirm(`Supprimer le compte "${u.display_name}" ?`)) return;
    try {
      await adminDelete('/users/' + u.id);
      addToast('Compte supprimé', 'success');
      loadData();
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur', 'error');
    }
  };

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    employees: users.filter(u => u.role === 'employee').length,
    active: users.filter(u => u.is_active).length,
  };

  return (
    <div>
      {confirmDialog}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>Gestion des utilisateurs</h1>
          <p className="subtitle">{stats.total} compte{stats.total !== 1 ? 's' : ''} · {stats.admins} admin{stats.admins !== 1 ? 's' : ''} · {stats.employees} employé{stats.employees !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          Créer un compte
        </button>
      </div>

      {loading ? (
        <div className="admin-users-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="user-card skeleton">
              <div className="user-card-header"><div className="skel-circle" /><div className="skel-lines"><div className="skel-line w60" /><div className="skel-line w40" /></div></div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 12 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          <p>Aucun utilisateur trouvé</p>
        </div>
      ) : (
        <div className="admin-users-grid">
          {users.map(u => {
            const isCurrentUser = u.id === currentUser?.id;
            const permCount = u.role === 'admin' ? ALL_PAGES.length : u.permissions.length;
            return (
              <div key={u.id} className={`user-card ${!u.is_active ? 'disabled' : ''} ${isCurrentUser ? 'current' : ''}`}>
                {/* Header */}
                <div className="user-card-header">
                  <div className="user-card-avatar-wrap">
                    <div className={`user-card-avatar ${u.role}`}>
                      {u.display_name.charAt(0).toUpperCase()}
                    </div>
                    {isCurrentUser && <span className="user-card-online" title="Connecté" />}
                  </div>
                  <div className="user-card-identity">
                    <div className="user-card-name">
                      {u.display_name}
                      {isCurrentUser && <span className="user-card-you">vous</span>}
                    </div>
                    <div className="user-card-username">@{u.username}</div>
                  </div>
                  <span className={`user-role-badge ${u.role}`}>{u.role === 'admin' ? 'Admin' : 'Employé'}</span>
                </div>

                {/* Details */}
                <div className="user-card-details">
                  <div className="user-card-detail">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>{u.employee_name || 'Aucun employé lié'}</span>
                  </div>
                  <div className="user-card-detail">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>Créé le {formatDate(u.created_at)}</span>
                  </div>
                  <div className="user-card-detail">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    <span>{u.role === 'admin' ? 'Toutes les pages' : `${permCount}/${ALL_PAGES.length} pages`}</span>
                  </div>
                </div>

                {/* Permissions tags (employee only, show up to 4) */}
                {u.role !== 'admin' && u.permissions.length > 0 && (
                  <div className="user-card-perms">
                    {u.permissions.slice(0, 4).map(p => (
                      <span key={p} className="user-perm-tag">{PAGE_LABELS[p] || p}</span>
                    ))}
                    {u.permissions.length > 4 && (
                      <span className="user-perm-tag more" title={u.permissions.slice(4).map(p => PAGE_LABELS[p] || p).join(', ')}>
                        +{u.permissions.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Status bar */}
                <div className="user-card-footer">
                  <div className="user-card-status">
                    <span className={`user-status-dot ${u.is_active ? 'active' : 'inactive'}`} />
                    <span>{u.is_active ? 'Actif' : 'Inactif'}</span>
                    {u.must_change_password ? <span className="user-card-flag">MDP à changer</span> : null}
                  </div>
                  <div className="user-card-actions">
                    <button className="user-action-btn" onClick={() => openEdit(u)} title="Modifier">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="user-action-btn" onClick={() => { setShowResetModal(u.id); setResetPwd(''); }} title="Réinitialiser MDP">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </button>
                    {!isCurrentUser && (
                      <button className="user-action-btn danger" onClick={() => handleDelete(u)} title="Supprimer">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal open={true} title={editingUser ? 'Modifier l\'utilisateur' : 'Créer un compte'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave}>
            {!editingUser && (
              <>
                <div className="form-group">
                  <label>Nom d&apos;utilisateur</label>
                  <input type="text" value={formUsername} onChange={e => setFormUsername(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Mot de passe</label>
                  <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} required minLength={8} />
                </div>
              </>
            )}
            <div className="form-group">
              <label>Nom affiché</label>
              <input type="text" value={formDisplayName} onChange={e => setFormDisplayName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Rôle</label>
              <select value={formRole} onChange={e => setFormRole(e.target.value as 'admin' | 'employee')}>
                <option value="employee">Employé</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            {!editingUser && (
              <div className="form-group">
                <label>Employé lié (optionnel)</label>
                <select value={formEmployeeId} onChange={e => setFormEmployeeId(e.target.value)}>
                  <option value="">— Aucun —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            )}
            {editingUser && (
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} style={{ width: 16, height: 16 }} />
                  Compte actif
                </label>
              </div>
            )}
            {formRole !== 'admin' && (
              <div className="form-group">
                <label>Pages autorisées</label>
                <div className="permissions-grid">
                  {ALL_PAGES.map(page => (
                    <label key={page} className="permission-checkbox">
                      <input type="checkbox" checked={formPermissions.includes(page)} onChange={() => togglePermission(page)} />
                      {PAGE_LABELS[page]}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement...' : editingUser ? 'Mettre à jour' : 'Créer'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <Modal open={true} title="Réinitialiser le mot de passe" onClose={() => setShowResetModal(null)}>
          <div className="form-group">
            <label>Nouveau mot de passe</label>
            <input type="password" value={resetPwd} onChange={e => setResetPwd(e.target.value)} minLength={8} autoFocus />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>L&apos;utilisateur devra changer ce mot de passe à la prochaine connexion.</p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowResetModal(null)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleResetPassword}>Réinitialiser</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
