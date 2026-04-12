import { useEffect, useRef } from 'react';

/**
 * Detects barcode scanner input (rapid keystrokes ending with Enter).
 * Barcode scanners act as HID keyboards — they type characters very fast (~10-50ms apart)
 * then send Enter. We distinguish from human typing by checking inter-keystroke timing.
 */
export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  enabled = true,
): void {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const MAX_INTER_KEY_MS = 80; // max ms between keystrokes from a scanner
    const MIN_LENGTH = 4; // minimum barcode length

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea/select (unless it's Enter completing a scan)
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      const now = Date.now();

      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        if (barcode.length >= MIN_LENGTH) {
          e.preventDefault();
          e.stopPropagation();
          onScanRef.current(barcode);
        }
        bufferRef.current = '';
        lastKeyTimeRef.current = 0;
        return;
      }

      // Only accumulate printable single chars
      if (e.key.length !== 1) {
        // Non-printable key resets buffer
        bufferRef.current = '';
        lastKeyTimeRef.current = 0;
        return;
      }

      // If too much time passed since last key, reset (human typing)
      if (lastKeyTimeRef.current > 0 && (now - lastKeyTimeRef.current) > MAX_INTER_KEY_MS) {
        bufferRef.current = '';
      }

      // If typing in an input and buffer is empty, this is probably normal typing — skip accumulation
      if (isInput && bufferRef.current === '' && lastKeyTimeRef.current === 0) {
        lastKeyTimeRef.current = now;
        return;
      }

      bufferRef.current += e.key;
      lastKeyTimeRef.current = now;
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled]);
}
