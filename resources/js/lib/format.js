/**
 * The server sends every amount as an integer number of minor units. Nothing
 * in the UI converts to a float until the moment it is rendered, so a total
 * displayed on screen is always the exact sum the database holds.
 */

const CURRENCY_META = {
    INR: { locale: 'en-IN', symbol: '₹' },
    USD: { locale: 'en-US', symbol: '$' },
    EUR: { locale: 'de-DE', symbol: '€' },
    GBP: { locale: 'en-GB', symbol: '£' },
};

const formatterCache = new Map();

function formatterFor(currency, options) {
    const key = `${currency}|${JSON.stringify(options)}`;

    if (!formatterCache.has(key)) {
        const meta = CURRENCY_META[currency] ?? CURRENCY_META.INR;
        formatterCache.set(
            key,
            new Intl.NumberFormat(meta.locale, { currency, ...options })
        );
    }

    return formatterCache.get(key);
}

/** Full currency string: ₹1,25,000.50 */
export function money(minor, currency = 'INR') {
    return formatterFor(currency, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format((minor ?? 0) / 100);
}

/** Number only, no symbol — for table columns that carry the symbol in the header. */
export function amount(minor) {
    return formatterFor('INR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format((minor ?? 0) / 100);
}

/** Compact form for chart axes and tight stat blocks: ₹1.3L, ₹12.5K */
export function compactMoney(minor, currency = 'INR') {
    const meta = CURRENCY_META[currency] ?? CURRENCY_META.INR;
    const value = (minor ?? 0) / 100;

    return (
        meta.symbol +
        formatterFor(currency, {
            notation: 'compact',
            maximumFractionDigits: 1,
        }).format(value)
    );
}

export function currencySymbol(currency = 'INR') {
    return (CURRENCY_META[currency] ?? CURRENCY_META.INR).symbol;
}

/** "14 Mar 2026" — unambiguous, and never the US month-first order. */
export function shortDate(iso) {
    if (!iso) return '—';

    // Parse as a plain calendar date. `new Date('2026-03-14')` is UTC midnight,
    // which renders as the 13th anywhere west of Greenwich.
    const [y, m, d] = iso.split('-').map(Number);

    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function todayIso() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');

    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Percentage change between two periods, or null when there is no baseline. */
export function delta(current, previous) {
    if (!previous) return null;

    return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
