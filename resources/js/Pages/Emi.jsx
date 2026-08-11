import { useEffect, useMemo, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { Calculator } from 'lucide-react';
import AppLayout from '../Layouts/AppLayout';
import { Block, Btn, Field, NumberField } from '../Components/Ui';
import TableFooter, { usePageWindow } from '../Components/TableFooter';
import { IsoSlab } from '../Components/IsoStat';
import { amortize } from '../lib/emi';
import { currencySymbol, money } from '../lib/format';

const PRESETS = [
    { label: 'Car', principal: 800000, rate: 9.5, years: 5 },
    { label: 'Home', principal: 4000000, rate: 8.4, years: 20 },
    { label: 'Personal', principal: 300000, rate: 13.5, years: 3 },
    { label: 'Phone', principal: 80000, rate: 0, years: 1 },
];

export default function Emi() {
    const { auth } = usePage().props;
    const currency = auth.user?.currency ?? 'INR';
    const symbol = currencySymbol(currency);

    const [principal, setPrincipal] = useState('800000');
    const [rate, setRate] = useState('9.5');
    const [tenure, setTenure] = useState('5');
    const [unit, setUnit] = useState('years');
    const [page, setPage] = useState(0);
    const [perPage, setPerPage] = useState(10);

    const months = unit === 'years' ? Math.round(Number(tenure) * 12) : Math.round(Number(tenure));
    const principalMinor = Math.round((Number(principal) || 0) * 100);
    const annualRate = Number(rate) || 0;

    // Recomputed on every keystroke — the whole schedule is a few hundred
    // integer operations, so there is nothing to debounce or submit.
    const result = useMemo(
        () => amortize(principalMinor, annualRate, months),
        [principalMinor, annualRate, months]
    );

    const valid = principalMinor > 0 && months >= 1 && months <= 480;
    const interestShare = result.totalPayable > 0 ? (result.totalInterest / result.totalPayable) * 100 : 0;

    const { pageCount, safePage, firstRow, visible: visibleRows } = usePageWindow(
        result.rows,
        perPage,
        page
    );

    // Changing the loan or the page size changes how many pages exist; staying
    // on page 4 of a schedule that now has two would show an empty table.
    useEffect(() => {
        setPage(0);
    }, [principalMinor, annualRate, months, perPage]);

    return (
        <AppLayout title="EMI calculator">
            <p className="mb-5 max-w-2xl text-sm leading-relaxed text-[var(--on-surface-variant)]">
                Work out the monthly instalment on a loan before you commit to it. Everything is
                calculated in the browser as you type — nothing is sent anywhere or stored.
            </p>

            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                {/* -------------------- Inputs -------------------- */}
                <Block className="p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap gap-2">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                    setPrincipal(String(preset.principal));
                                    setRate(String(preset.rate));
                                    setTenure(String(preset.years));
                                    setUnit('years');
                                }}
                                className="tag state min-h-10 rounded-full px-4"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-4">
                        <NumberField
                            label={`Loan amount (${symbol})`}
                            min="0"
                            step="1000"
                            inputMode="decimal"
                            value={principal}
                            onChange={setPrincipal}
                            error={principalMinor <= 0 ? 'Enter an amount above zero.' : undefined}
                        />

                        <div>
                            <NumberField
                                label="Annual interest rate (%)"
                                min="0"
                                max="100"
                                step="0.05"
                                inputMode="decimal"
                                value={rate}
                                onChange={setRate}
                            />
                            <input
                                type="range"
                                min="0"
                                max="24"
                                step="0.05"
                                value={Math.min(annualRate, 24)}
                                onChange={(e) => setRate(e.target.value)}
                                aria-label="Interest rate slider"
                                className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--surface-highest)]"
                                style={{ accentColor: 'var(--tertiary)' }}
                            />
                        </div>

                        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                            <NumberField
                                label="Tenure"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                value={tenure}
                                onChange={setTenure}
                                error={
                                    months < 1
                                        ? 'Tenure must be at least one month.'
                                        : months > 480
                                          ? 'Cap is 40 years.'
                                          : undefined
                                }
                            />

                            <div className="flex">
                                {['years', 'months'].map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        aria-pressed={unit === option}
                                        onClick={() => setUnit(option)}
                                        className="btn"
                                        style={{
                                            background:
                                                unit === option ? 'var(--secondary-container)' : 'transparent',
                                            color:
                                                unit === option
                                                    ? 'var(--on-secondary-container)'
                                                    : 'var(--on-surface-variant)',
                                            border: '1px solid var(--outline-variant)',
                                            borderRadius:
                                                option === 'years' ? '999px 0 0 999px' : '0 999px 999px 0',
                                            marginLeft: option === 'months' ? '-1px' : 0,
                                        }}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <p className="font-mono text-xs text-[var(--on-surface-variant)]">
                            {months} monthly instalment{months === 1 ? '' : 's'}
                        </p>
                    </div>
                </Block>

                {/* -------------------- Results -------------------- */}
                <div className="flex flex-col gap-5">
                    <IsoSlab depth={18} faceColor="var(--primary)" interactive={false}>
                        <div className="p-5 text-[var(--on-primary)]">
                            <p className="eyebrow" style={{ color: 'currentColor', opacity: 0.72 }}>
                                Monthly instalment
                            </p>
                            <p className="tnum mt-1 font-mono text-4xl font-semibold leading-none sm:text-5xl">
                                {valid ? money(result.emi, currency) : '—'}
                            </p>
                            <p className="mt-2 font-mono text-xs" style={{ opacity: 0.8 }}>
                                {valid ? `for ${months} months at ${annualRate}% p.a.` : 'Fill in the fields'}
                            </p>
                        </div>
                    </IsoSlab>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <ResultTile
                            label="Total interest"
                            value={valid ? money(result.totalInterest, currency) : '—'}
                            tone="expense"
                        />
                        <ResultTile
                            label="Total payable"
                            value={valid ? money(result.totalPayable, currency) : '—'}
                        />
                    </div>

                    {/* Principal vs interest, as one honest bar. */}
                    {valid && (
                        <Block className="p-4">
                            <p className="eyebrow mb-2">Principal vs interest</p>

                            <div className="flex h-3.5 overflow-hidden rounded-full bg-[var(--surface-highest)]">
                                <div
                                    className="bg-[var(--primary)]"
                                    style={{ width: `${100 - interestShare}%` }}
                                    title="Principal"
                                />
                                <div
                                    className="bg-[var(--tertiary)]"
                                    style={{ width: `${interestShare}%` }}
                                    title="Interest"
                                />
                            </div>

                            <div className="mt-2 flex flex-wrap justify-between gap-2 font-mono text-xs">
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-block size-2.5 rounded-full bg-[var(--primary)]" />
                                    Principal {(100 - interestShare).toFixed(1)}%
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-block size-2.5 rounded-full bg-[var(--tertiary)]" />
                                    Interest {interestShare.toFixed(1)}%
                                </span>
                            </div>

                            {interestShare > 40 && (
                                <p className="mt-4 rounded-[var(--radius-md)] p-3 text-xs font-semibold"
                                    style={{ background: 'var(--error-container)', color: 'var(--on-error-container)' }}>
                                    Interest is {interestShare.toFixed(0)}% of everything you would pay.
                                    A shorter tenure cuts this sharply.
                                </p>
                            )}
                        </Block>
                    )}
                </div>
            </div>

            {/* -------------------- Amortisation -------------------- */}
            {valid && result.rows.length > 0 && (
                <Block className="blk-clip mt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--outline-variant)] bg-[var(--surface-low)] px-4 py-3">
                        <div>
                            <p className="eyebrow">Month by month</p>
                            <h2 className="text-lg font-bold tracking-tight">Amortisation schedule</h2>
                        </div>

                    </div>

                    <div className="scroll-x hidden sm:block">
                        <table className="ledger-table">
                            <thead>
                                <tr>
                                    <th scope="col">#</th>
                                    <th scope="col" className="text-right">Opening</th>
                                    <th scope="col" className="text-right">Principal</th>
                                    <th scope="col" className="text-right">Interest</th>
                                    <th scope="col" className="text-right">Closing</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((row) => (
                                    <tr key={row.month}>
                                        <td className="font-semibold">{row.month}</td>
                                        <td className="tnum text-right">{money(row.opening, currency)}</td>
                                        <td className="tnum text-right">{money(row.principal, currency)}</td>
                                        <td className="tnum text-right text-[var(--on-surface-variant)]">
                                            {money(row.interest, currency)}
                                        </td>
                                        <td className="tnum text-right font-semibold">
                                            {money(row.closing, currency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <ul className="flex flex-col sm:hidden">
                        {visibleRows.map((row) => (
                            <li key={row.month} className="border-b border-[var(--outline-variant)] p-3 last:border-b-0">
                                <div className="mb-1.5 flex items-center justify-between">
                                    <span className="tag">Month {row.month}</span>
                                    <span className="tnum font-mono text-sm font-semibold">
                                        {money(row.closing, currency)} left
                                    </span>
                                </div>

                                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
                                    <dt className="text-[var(--on-surface-variant)]">Principal</dt>
                                    <dd className="tnum text-right">{money(row.principal, currency)}</dd>
                                    <dt className="text-[var(--on-surface-variant)]">Interest</dt>
                                    <dd className="tnum text-right">{money(row.interest, currency)}</dd>
                                </dl>
                            </li>
                        ))}
                    </ul>

                    <TableFooter
                        page={safePage}
                        pageCount={pageCount}
                        perPage={perPage}
                        onPageChange={setPage}
                        onPerPageChange={setPerPage}
                        firstRow={firstRow}
                        shown={visibleRows.length}
                        total={result.rows.length}
                        label="schedule"
                    />

                    <p className="border-t border-[var(--outline-variant)] bg-[var(--surface-low)] px-4 py-2.5 font-mono text-[0.6875rem] text-[var(--on-surface-variant)]">
                        <Calculator size={12} strokeWidth={2.5} className="mr-1 inline" />
                        The final instalment absorbs rounding so the balance closes at exactly zero.
                    </p>
                </Block>
            )}
        </AppLayout>
    );
}

function ResultTile({ label, value, tone = 'neutral' }) {
    const background = tone === 'expense' ? 'var(--tertiary)' : 'var(--surface-container)';
    const color = tone === 'expense' ? 'var(--on-tertiary)' : 'var(--on-surface)';

    return (
        <div className="blk p-4" style={{ background, color }}>
            <p className="eyebrow" style={{ color: 'currentColor', opacity: 0.72 }}>
                {label}
            </p>
            <p className="tnum mt-1 font-mono text-xl font-semibold sm:text-2xl">{value}</p>
        </div>
    );
}
