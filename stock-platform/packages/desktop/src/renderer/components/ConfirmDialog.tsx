import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ConfirmState {
  message: string;
  resolve: (value: boolean) => void;
}

export function useConfirm(): [
  (message: string) => Promise<boolean>,
  React.JSX.Element | null
] {
  const [state, setState] = useState<ConfirmState | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ message, resolve });
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    state?.resolve(result);
    setState(null);
  }, [state]);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape key handling
  useEffect(() => {
    if (!state) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { handleClose(false); return; }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [state, handleClose]);

  const dialog = state ? (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(false); }}
    >
      <div className="confirm-dialog" ref={dialogRef} role="alertdialog" aria-modal="true" aria-label={state.message}>
        <div className="confirm-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="confirm-message">{state.message}</div>
        <div className="confirm-actions">
          <button className="btn btn-cancel" onClick={() => handleClose(false)}>Annuler</button>
          <button className="btn btn-danger" onClick={() => handleClose(true)} autoFocus>Confirmer</button>
        </div>
      </div>
    </div>
  ) : null;

  return [confirm, dialog];
}
