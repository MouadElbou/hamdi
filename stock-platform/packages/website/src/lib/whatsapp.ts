/**
 * WhatsApp business lines.
 *
 * The shop answers on TWO WhatsApp numbers, so every "Commander" entry point
 * lets the customer pick which one to message instead of hard-wiring one.
 *
 * These are deliberately literals and not read from NEXT_PUBLIC_STORE_PHONE:
 * that variable is documented in .env.example with the shop's 0536… landline,
 * which has no WhatsApp account — pointing wa.me at it silently breaks every
 * order link. Both numbers below are the ones published on /contact.
 */

export interface WaLine {
  /** Digits only, international format without "+" — the shape wa.me expects. */
  phone: string;
  /** Pretty form shown in the UI. */
  display: string;
  /** Short disambiguator shown above the number. */
  label: string;
}

/** "212622265053" → "+212 622 26 50 53" */
function pretty(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('212') && d.length === 12) {
    const n = d.slice(3);
    return `+212 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
  }
  return `+${d}`;
}

const PHONES: Array<[string, string]> = [
  ['212622265053', 'Ligne 1'],
  ['212672532998', 'Ligne 2'],
];

export const WA_LINES: WaLine[] = PHONES.map(([phone, label]) => ({
  phone,
  label,
  display: pretty(phone),
}));

/** First line — used where a single link is unavoidable (footer, metadata). */
export const WA_PRIMARY: WaLine = WA_LINES[0] as WaLine;

/** Build a wa.me deep link, optionally pre-filling the message. */
export function waLink(phone: string, text?: string): string {
  return text
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${phone}`;
}
