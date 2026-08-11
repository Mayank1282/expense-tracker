/**
 * EMI maths. Pure functions, no I/O — this is the whole "backend" of the
 * calculator, which is why the page needs no controller and no round trip.
 *
 *   EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)
 *
 * where r is the MONTHLY rate as a fraction and n is the number of months.
 *
 * Everything works in paise (integers) and rounds once, at the point a figure
 * is produced. The final instalment absorbs the accumulated rounding remainder
 * so the schedule closes at exactly zero rather than a few paise adrift — a
 * table that ends at ₹0.03 outstanding is the sort of detail that makes a
 * finance tool look wrong even when the EMI itself is right.
 */

export function monthlyRate(annualRatePercent) {
    return annualRatePercent / 12 / 100;
}

/**
 * @param {number} principalMinor whole paise
 * @param {number} annualRatePercent e.g. 9.5
 * @param {number} months
 * @returns {number} EMI in paise, rounded to the nearest paisa
 */
export function calculateEmi(principalMinor, annualRatePercent, months) {
    if (!principalMinor || !months || months < 1) {
        return 0;
    }

    const r = monthlyRate(annualRatePercent);

    // An interest-free loan is a straight division; the general formula divides
    // by zero here, so it is handled separately rather than nudged with an
    // epsilon.
    if (r === 0) {
        return Math.max(1, Math.round(principalMinor / months));
    }

    const growth = Math.pow(1 + r, months);
    const emi = Math.round((principalMinor * r * growth) / (growth - 1));

    // A principal small enough that the instalment rounds to zero — a loan of a
    // few paise — would otherwise produce a schedule that never repays anything
    // and an empty table. One paisa is the smallest instalment that terminates.
    return Math.max(1, emi);
}

/**
 * Full month-by-month schedule.
 *
 * @returns {{
 *   emi: number,
 *   totalInterest: number,
 *   totalPayable: number,
 *   rows: Array<{month:number, opening:number, principal:number, interest:number, closing:number}>
 * }}
 */
export function amortize(principalMinor, annualRatePercent, months) {
    const emi = calculateEmi(principalMinor, annualRatePercent, months);

    if (!emi) {
        return { emi: 0, totalInterest: 0, totalPayable: 0, rows: [] };
    }

    const r = monthlyRate(annualRatePercent);
    const rows = [];

    let balance = principalMinor;
    let totalInterest = 0;
    let totalPaid = 0;

    for (let month = 1; month <= months; month++) {
        const interest = Math.round(balance * r);
        const isLast = month === months;

        // The last row clears whatever is left, so rounding never strands a
        // balance or overshoots into a negative closing figure.
        const principalPart = isLast ? balance : Math.min(emi - interest, balance);
        const payment = principalPart + interest;
        const closing = balance - principalPart;

        rows.push({
            month,
            opening: balance,
            principal: principalPart,
            interest,
            closing,
            payment,
        });

        totalInterest += interest;
        totalPaid += payment;
        balance = closing;
    }

    return {
        emi,
        totalInterest,
        totalPayable: totalPaid,
        rows,
    };
}
