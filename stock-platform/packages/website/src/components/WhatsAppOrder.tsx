'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { WA_LINES, waLink, type WaLine } from '@/lib/whatsapp';

/* ───────────────────────────── icons ───────────────────────────── */

export function WhatsAppGlyph({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden focusable="false">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.03 0 1.2.87 2.35.99 2.52.12.16 1.71 2.61 4.15 3.66.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}

/* ─────────────────────────── line buttons ─────────────────────────── */

/**
 * The shop's two WhatsApp lines, side by side.
 * Renders links by default; pass `onPick` to intercept (used by the cart, which
 * has to build the order message before opening the conversation).
 */
export function WaLineButtons({
  onPick,
  compact = false,
}: {
  onPick?: (line: WaLine) => void;
  compact?: boolean;
}): React.JSX.Element {
  return (
    <div className={`wa-lines${compact ? ' wa-lines--compact' : ''}`}>
      {WA_LINES.map((line) => {
        const inner = (
          <>
            <span className="wa-line-glyph" aria-hidden><WhatsAppGlyph size={compact ? 18 : 20} /></span>
            <span className="wa-line-text">
              <span className="wa-line-label">{line.label}</span>
              <span className="wa-line-number">{line.display}</span>
            </span>
            <span className="wa-line-go" aria-hidden>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M12 5l7 7-7 7" /></svg>
            </span>
          </>
        );

        return onPick ? (
          <button key={line.phone} type="button" className="wa-line" onClick={() => onPick(line)}>
            {inner}
          </button>
        ) : (
          <a
            key={line.phone}
            className="wa-line"
            href={waLink(line.phone)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {inner}
          </a>
        );
      })}
    </div>
  );
}

/* ──────────────────────── header "Commander" ──────────────────────── */

function useHoverCapable(): boolean {
  const [can, setCan] = useState(false);
  useEffect(() => {
    setCan(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  }, []);
  return can;
}

/** Green "Commander" pill that reveals both WhatsApp lines. */
export function OrderButton({ closeKey }: { closeKey?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCapable = useHoverCapable();
  const panelId = useId();

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const schedule = useCallback((next: boolean, delay: number) => {
    clear();
    timer.current = setTimeout(() => setOpen(next), delay);
  }, []);

  useEffect(() => clear, []);
  useEffect(() => { setOpen(false); }, [closeKey]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="order-menu"
      onMouseEnter={hoverCapable ? () => schedule(true, 60) : undefined}
      onMouseLeave={hoverCapable ? () => schedule(false, 180) : undefined}
    >
      <button
        type="button"
        className={`order-trigger${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        onClick={() => { clear(); setOpen((v) => !v); }}
      >
        <WhatsAppGlyph size={19} />
        <span>Commander</span>
        <svg className="order-caret" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div id={panelId} className="order-pop">
          <p className="order-pop-title">Commander sur WhatsApp</p>
          <p className="order-pop-sub">Choisissez la ligne à contacter — réponse rapide 7j/7.</p>
          <WaLineButtons />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── floating action button ─────────────────────── */

/** Bottom-right WhatsApp bubble; expands to both lines. */
export function WaFab(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="wa-fab-wrap">
      {open && (
        <div id={panelId} className="wa-fab-pop">
          <p className="order-pop-title">Nos lignes WhatsApp</p>
          <WaLineButtons compact />
        </div>
      )}
      <button
        type="button"
        className={`wa-fab${open ? ' is-open' : ''}`}
        aria-label={open ? 'Fermer les lignes WhatsApp' : 'Commander sur WhatsApp'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {open
          ? <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          : <WhatsAppGlyph size={28} />}
      </button>
    </div>
  );
}
