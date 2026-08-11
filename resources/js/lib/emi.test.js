import { describe, expect, it } from 'vitest';
import { amortize, calculateEmi } from './emi';

const rupees = (value) => Math.round(value * 100);

describe('calculateEmi', () => {
    it('matches the published figure for a standard loan', () => {
        // ₹10,00,000 at 9% for 120 months is ₹12,667.58 by the standard formula.
        const emi = calculateEmi(rupees(1000000), 9, 120);

        expect(emi).toBe(1266758);
    });

    it('divides evenly when there is no interest', () => {
        // The general formula divides by zero at r = 0, so this path is separate.
        expect(calculateEmi(rupees(120000), 0, 12)).toBe(rupees(10000));
    });

    it('returns zero rather than NaN for unusable input', () => {
        expect(calculateEmi(0, 9, 120)).toBe(0);
        expect(calculateEmi(rupees(100000), 9, 0)).toBe(0);
    });

    it('gives a single instalment equal to principal plus one month of interest', () => {
        const emi = calculateEmi(rupees(100000), 12, 1);

        expect(emi).toBe(rupees(101000));
    });
});

describe('amortize', () => {
    it('closes the schedule at exactly zero', () => {
        // Awkward on purpose: neither the principal nor the rate divides cleanly,
        // so per-row rounding accumulates over 60 months.
        const { rows } = amortize(rupees(799999.99), 9.37, 60);

        expect(rows).toHaveLength(60);
        expect(rows.at(-1).closing).toBe(0);
    });

    it('never lets a balance go negative', () => {
        const { rows } = amortize(rupees(333333.33), 13.75, 36);

        rows.forEach((row) => {
            expect(row.closing).toBeGreaterThanOrEqual(0);
            expect(row.principal).toBeGreaterThanOrEqual(0);
        });
    });

    it('keeps principal + interest = total payable, to the paisa', () => {
        const principal = rupees(2500000);
        const { totalInterest, totalPayable } = amortize(principal, 8.4, 240);

        expect(principal + totalInterest).toBe(totalPayable);
    });

    it('sums the principal column back to the original loan', () => {
        const principal = rupees(645321.17);
        const { rows } = amortize(principal, 11.11, 84);

        const repaid = rows.reduce((sum, row) => sum + row.principal, 0);

        expect(repaid).toBe(principal);
    });

    it('holds all three invariants across a spread of awkward inputs', () => {
        const cases = [
            [0.01, 9, 12],
            [799.99, 0, 6],
            [3333.33, 24, 3],
            [10000000, 7.25, 360],
            [123456.78, 18.99, 47],
        ];

        cases.forEach(([amount, rate, months]) => {
            const principal = rupees(amount);
            const { rows, totalInterest, totalPayable } = amortize(principal, rate, months);

            expect(rows.at(-1).closing, `closing for ${amount} @ ${rate}%`).toBe(0);
            expect(
                rows.reduce((sum, row) => sum + row.principal, 0),
                `principal sum for ${amount} @ ${rate}%`
            ).toBe(principal);
            expect(principal + totalInterest, `payable for ${amount} @ ${rate}%`).toBe(totalPayable);
        });
    });

    it('front-loads interest, which is the whole point of showing the table', () => {
        const { rows } = amortize(rupees(1000000), 9, 120);

        expect(rows[0].interest).toBeGreaterThan(rows[0].principal);
        expect(rows.at(-1).interest).toBeLessThan(rows.at(-1).principal);
    });
});
