import React, { useEffect, useState, useCallback } from 'react';

interface ConflictRow {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload: string;
  version: number;
  created_at: string;
  status: string;
}

interface Props {
  onClose: () => void;
}

export function SyncConflictsModal({ onClose }: Props): React.JSX.Element {
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.api.sync.listConflicts();
      setConflicts(list);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDismiss = async (id: string) => {
    setActionId(id);
    try {
      await window.api.sync.dismissConflict(id);
      await load();
    } catch { /* dismiss failed — will show on next load */ }
    finally { setActionId(null); }
  };

  const handleRetry = async (id: string) => {
    setActionId(id);
    try {
      await window.api.sync.retryConflict(id);
      await load();
    } catch { /* retry failed — will show on next load */ }
    finally { setActionId(null); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content conflicts-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Conflits de synchronisation</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading && <p>Chargement…</p>}
          {!loading && conflicts.length === 0 && <p>Aucun conflit.</p>}
          {!loading && conflicts.length > 0 && (
            <table className="conflicts-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Opération</th>
                  <th>Entité</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map(c => (
                  <tr key={c.id}>
                    <td>{c.entity_type}</td>
                    <td>{c.operation}</td>
                    <td className="entity-id-cell" title={c.entity_id}>{c.entity_id.slice(0, 12)}…</td>
                    <td><span className={`conflict-status ${c.status}`}>{c.status}</span></td>
                    <td>{new Date(c.created_at).toLocaleString()}</td>
                    <td className="conflict-actions">
                      <button
                        disabled={actionId === c.id}
                        onClick={() => handleRetry(c.id)}
                        title="Réessayer avec les données actuelles"
                      >↻</button>
                      <button
                        disabled={actionId === c.id}
                        onClick={() => handleDismiss(c.id)}
                        title="Ignorer ce conflit"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
