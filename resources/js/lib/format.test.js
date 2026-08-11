import { describe, expect, it } from 'vitest';
import { delta, money, shortDate } from './format';

describe('money', () => {
    it('renders minor units as a currency amount', () => {
        // Non-breaking spaces vary by ICU build, so compare on digits.
        expect(money(125050, 'INR')).toContain('1,250.50');
        expect(money(1, 'INR')).toContain('0.01');
        expect(money(0, 'INR')).toContain('0.00');
    });

    it('always shows two decimal places', () => {
        expect(money(100000, 'INR')).toContain('1,000.00');
    });

    it('handles a missing amount without printing NaN', () => {
        expect(money(undefined)).toContain('0.00');
        expect(money(null)).toContain('0.00');
    });
});

describe('shortDate', () => {
    it('renders the calendar date it was given, not a UTC-shifted one', () => {
        // `new Date('2026-03-01')` is UTC midnight and prints as 28 Feb in any
        // timezone west of Greenwich. This is the bug the parser avoids.
        expect(shortDate('2026-03-01')).toBe('01 Mar 2026');
        expect(shortDate('2026-12-31')).toBe('31 Dec 2026');
    });

    it('falls back rather than throwing on an empty value', () => {
        expect(shortDate(null)).toBe('—');
        expect(shortDate('')).toBe('—');
    });
});

describe('delta', () => {
    it('reports the percentage change between two periods', () => {
        expect(delta(150, 100)).toBe(50);
        expect(delta(50, 100)).toBe(-50);
    });

    it('returns null when there is no baseline to compare against', () => {
        expect(delta(500, 0)).toBeNull();
    });
});
