import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthContext.js';
import { useToast } from '../components/Toast.js';

type UpdaterEvent =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'progress'
  | 'downloaded'
  | 'error';

interface UpdaterState {
  status: UpdaterEvent | 'idle';
  message: string;
  version: string | null;
  percent: number | null;
  downloaded: boolean;
}

const INITIAL_STATE: UpdaterState = {
  status: 'idle',
  message: '',
  version: null,
  percent: null,
  downloaded: false,
};

function formatStatus(state: UpdaterState): string {
  switch (state.status) {
    case 'checking': return 'Vérification en cours…';
    case 'available': return `Mise à jour disponible${state.version ? ` — v${state.version}` : ''}`;
    case 'not-available': return 'Vous utilisez la dernière version';
    case 'progress': return `Téléchargement… ${state.percent != null ? `${state.percent.toFixed(0)}%` : ''}`;
    case 'downloaded': return `Mise à jour prête${state.version ? ` — v${state.version}` : ''}`;
    case 'error': return `Erreur: ${state.message || 'inconnue'}`;
    default: return '';
  }
}

export function SettingsPage(): React.JSX.Element {
  const { isAdmin } = useAuth();
  const { addToast } = useToast();

  const [configPath, setConfigPath] = useState<string>('');
  const [loadingPath, setLoadingPath] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updaterState, setUpdaterState] = useState<UpdaterState>(INITIAL_STATE);

  const loadPath = useCallback(async () => {
    setLoadingPath(true);
    try {
      const path = await window.api.config.getPath();
      setConfigPath(path);
    } catch (err: unknown) {
      addToast((err as Error).message || 'Impossible de lire le chemin', 'error');
    } finally {
      setLoadingPath(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadPath();
  }, [loadPath]);

  useEffect(() => {
    const unsubscribe = window.api.updater.onEvent((payload) => {
      const event = payload.event as UpdaterEvent;
      const data = (payload.payload ?? {}) as {
        version?: string;
        percent?: number;
        message?: string;
        current?: string;
      };
      setUpdaterState((prev) => {
        switch (event) {
          case 'checking':
            return { ...INITIAL_STATE, status: 'checking' };
          case 'available':
            return { ...prev, status: 'available', version: data.version ?? null, downloaded: false };
          case 'not-available':
            return { ...prev, status: 'not-available', version: data.current ?? null };
          case 'progress':
            return { ...prev, status: 'progress', percent: data.percent ?? null };
          case 'downloaded':
            return { ...prev, status: 'downloaded', version: data.version ?? prev.version, downloaded: true };
          case 'error':
            return { ...prev, status: 'error', message: data.message ?? '' };
          default:
            return prev;
        }
      });
    });
    return unsubscribe;
  }, []);

  if (!isAdmin) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Paramètres</h1>
        </header>
        <div className="empty-state">Accès réservé aux administrateurs.</div>
      </div>
    );
  }

  const handleOpenFile = async () => {
    setOpening(true);
    try {
      const result = await window.api.config.openFile();
      addToast(`Fichier ouvert: ${result.path}`, 'success');
    } catch (err: unknown) {
      addToast((err as Error).message || 'Impossible d\'ouvrir le fichier', 'error');
    } finally {
      setOpening(false);
    }
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      const result = await window.api.config.reload();
      if (result.success) {
        addToast('Configuration rechargée. La connexion au serveur utilisera les nouvelles valeurs.', 'success');
      } else {
        addToast('Le rechargement a échoué', 'error');
      }
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur lors du rechargement', 'error');
    } finally {
      setReloading(false);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const result = await window.api.updater.check();
      if (!result.checked) {
        addToast(result.reason ?? 'Vérification impossible', 'warning');
      }
    } catch (err: unknown) {
      addToast((err as Error).message || 'Erreur lors de la vérification', 'error');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await window.api.updater.install();
    } catch (err: unknown) {
      addToast((err as Error).message || 'Installation impossible', 'error');
      setInstalling(false);
    }
  };

  const statusLabel = formatStatus(updaterState);

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Paramètres</h1>
        <p className="page-subtitle">Configuration du serveur et mises à jour de l'application</p>
      </header>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2 className="card-title">Configuration</h2>
          <p className="card-subtitle">
            Modifiez le fichier <code>.env</code> pour changer l'URL du serveur backend ou la clé API.
            Les changements prennent effet après avoir cliqué sur « Recharger ».
          </p>
        </div>
        <div className="card-body">
          <div className="form-row" style={{ marginBottom: 16 }}>
            <label className="form-label">Chemin du fichier</label>
            <input
              type="text"
              className="form-input"
              readOnly
              value={loadingPath ? 'Chargement…' : configPath}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={handleOpenFile}
              disabled={opening || loadingPath}
            >
              {opening ? 'Ouverture…' : 'Ouvrir le fichier'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleReload}
              disabled={reloading}
            >
              {reloading ? 'Rechargement…' : 'Recharger la configuration'}
            </button>
          </div>
          <p className="form-help" style={{ marginTop: 12 }}>
            Astuce: après édition du fichier, enregistrez-le puis cliquez sur « Recharger ».
            Un redémarrage de l'application n'est pas nécessaire.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Mises à jour</h2>
          <p className="card-subtitle">
            L'application vérifie automatiquement les mises à jour toutes les 6 heures.
            Vous pouvez aussi lancer une vérification manuelle.
          </p>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <button
              className="btn btn-primary"
              onClick={handleCheckUpdate}
              disabled={checkingUpdate || updaterState.status === 'checking'}
            >
              {checkingUpdate || updaterState.status === 'checking' ? 'Vérification…' : 'Vérifier les mises à jour'}
            </button>
            {updaterState.downloaded && (
              <button
                className="btn btn-success"
                onClick={handleInstall}
                disabled={installing}
              >
                {installing ? 'Installation…' : 'Installer maintenant et redémarrer'}
              </button>
            )}
          </div>

          {statusLabel && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: updaterState.status === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                color: updaterState.status === 'error' ? '#dc2626' : 'inherit',
                fontSize: 14,
              }}
            >
              {statusLabel}
            </div>
          )}

          {updaterState.status === 'progress' && updaterState.percent != null && (
            <div
              style={{
                marginTop: 12,
                height: 6,
                background: 'rgba(0,0,0,0.08)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${updaterState.percent}%`,
                  background: '#3b82f6',
                  transition: 'width 200ms ease',
                }}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
