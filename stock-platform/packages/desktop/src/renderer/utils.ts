/** Convert a user-entered decimal string (e.g. "35.50") to centimes. Throws if not a valid finite number. */
export function parseCents(value: string, fieldName = 'Montant'): number {
    const trimmed = value.trim();
    if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) throw new Error(`${fieldName}: valeur numérique invalide`);
    const parts = trimmed.split('.');
    const whole = parseInt(parts[0], 10);
    let frac = 0;
    if (parts[1] !== undefined) {
        // Pad or truncate to exactly 2 decimal places, then round
        const fracStr = (parts[1] + '00').slice(0, 3); // take 3 digits for rounding
        frac = Math.round(parseInt(fracStr, 10) / 10);
    }
    const cents = whole * 100 + (whole < 0 ? -frac : frac);
    if (!Number.isFinite(cents) || cents < 0) throw new Error(`${fieldName}: valeur numérique invalide`);
    return cents;
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
