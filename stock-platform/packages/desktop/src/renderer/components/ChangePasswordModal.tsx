import React, { useState } from 'react';
import { Modal } from './Modal.js';
import { useAuth } from './AuthContext.js';
import { useToast } from './Toast.js';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ open, onClose }: Props): React.JSX.Element {
  const { changePassword } = useAuth();
  const { addToast } = useToast();
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOldPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!oldPwd || !newPwd || !confirmPwd) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    if (newPwd.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (newPwd === oldPwd) {
      setError('Le nouveau mot de passe doit être différent de l\'ancien.');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(oldPwd, newPwd);
      addToast('Mot de passe modifié avec succès.', 'success');
      reset();
      onClose();
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Erreur lors du changement de mot de passe.';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Changer le mot de passe" width="460px">
      <form onSubmit={handleSubmit} className="change-password-form">
        <div className="form-row">
          <label className="form-label">Mot de passe actuel</label>
          <input
            type="password"
            className="form-input"
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            autoComplete="current-password"
            disabled={submitting}
          />
        </div>
        <div className="form-row">
          <label className="form-label">Nouveau mot de passe</label>
          <input
            type="password"
            className="form-input"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            autoComplete="new-password"
            disabled={submitting}
          />
          <p className="form-help">Au moins 8 caractères.</p>
        </div>
        <div className="form-row">
          <label className="form-label">Confirmer le nouveau mot de passe</label>
          <input
            type="password"
            className="form-input"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            autoComplete="new-password"
            disabled={submitting}
          />
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Modification…' : 'Modifier'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
