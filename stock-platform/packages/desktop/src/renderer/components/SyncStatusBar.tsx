import React, { useEffect, useState, useCallback } from 'react';
import { SyncConflictsModal } from './SyncConflictsModal.js';

export function SyncStatusBar(): React.JSX.Element {
  const [status, setStatus] = useState<{ connected: boolean; pendingOps: number; lastSync: string | null; errorMessage?: string }>({ connected: false, pendingOps: 0, lastSync: null });
  const [retrying, setRetrying] = useState(false);
  const [conflictCount, setConflictCount] = useState(0);
  const [showConflicts, setShowConflicts] = useState(false);

  const refreshConflicts = useCallback(async () => {
    try {
      const conflicts = await window.api.sync.listConflicts();
      setConflictCount(conflicts.length);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const refresh = async () => {
      try {
        const s = await window.api.sync.status();
        setStatus(s);
      } catch (err) {
        console.error('[SyncStatusBar] ERROR:', err);
      }
    };
    refresh();
    refreshConflicts();
    const id = setInterval(() => { refresh(); refreshConflicts(); }, 10_000);
    return () => clearInterval(id);
  }, [refreshConflicts]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const s = await window.api.sync.trigger() as typeof status | undefined;
      if (s) setStatus(s);
    } catch { /* ignore */ }
    setRetrying(false);
    refreshConflicts();
  }, [refreshConflicts]);

  return (
    <>
      <div className="sync-bar">
        <div className="status-indicator">
          <span className={`status-dot ${status.connected ? 'connected' : 'disconnected'}`} />
          <span className="sync-label">
            {status.connected ? 'Connecté' : 'Hors ligne'}
            {!status.connected && status.errorMessage && (
              <span className="sync-error"> — {status.errorMessage}</span>
            )}
          </span>
        </div>
        {status.pendingOps > 0 && (
          <span className="sync-pending">{status.pendingOps} en attente</span>
        )}
        {conflictCount > 0 && (
          <button
            className="sync-conflict-btn"
            onClick={() => setShowConflicts(true)}
            title="Voir les conflits de synchronisation"
          >
            ⚠ {conflictCount} conflit{conflictCount > 1 ? 's' : ''}
          </button>
        )}
        {status.connected && status.lastSync && (
          <div className="sync-detail">
            Sync {new Date(status.lastSync).toLocaleTimeString()}
          </div>
        )}
        {!status.connected && (
          <button className="sync-retry-btn" onClick={handleRetry} disabled={retrying} title="Réessayer la connexion">
            {retrying ? '…' : '↻'}
          </button>
        )}
      </div>
      {showConflicts && (
        <SyncConflictsModal
          onClose={() => { setShowConflicts(false); refreshConflicts(); }}
        />
      )}
    </>
  );
}
