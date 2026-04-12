/** Convert a user-entered decimal string (e.g. "35.50") to centimes. Throws if not a valid finite number. */
export function parseCents(value: string, fieldName = 'Montant'): number {
    const n = parseFloat(value);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${fieldName}: valeur numérique invalide`);
    return Math.round(n * 100);
}

/** Parse a positive integer from string. Throws if not a valid integer > 0. */
export function parsePositiveInt(value: string, fieldName = 'Quantité'): number {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${fieldName}: entier positif requis`);
    return n;
}

/** Get today's date in YYYY-MM-DD format using local timezone (not UTC). */
export function todayLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
