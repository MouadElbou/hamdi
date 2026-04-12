import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export function Modal({ open, onClose, title, children, width }: ModalProps): React.JSX.Element | null {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      // Focus trap: cycle focus within modal
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
        );
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
    // Auto-focus first input/select/textarea, falling back to first focusable
    requestAnimationFrame(() => {
      const firstInput = panelRef.current?.querySelector<HTMLElement>(
        'input, select, textarea'
      );
      if (firstInput) {
        firstInput.focus();
      } else {
        panelRef.current?.querySelector<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        )?.focus();
      }
    });
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="modal-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" style={width ? { maxWidth: width } : undefined}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <h3 className="modal-title" id="modal-title">{title}</h3>
          </div>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Fermer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
