import { Link, usePage } from '@inertiajs/react';
import {
    ArrowDownRight,
    ArrowUpRight,
    Scale,
    Receipt,
    TrendingUp,
} from 'lucide-react';
import AppLayout from '../Layouts/AppLayout';
import { Block, CategoryChip, EmptyState, SectionTitle } from '../Components/Ui';
import { IsoStat } from '../Components/IsoStat';
import TrendChart from '../Components/TrendChart';
import PeriodBar from '../Components/PeriodBar';
import { delta, money, shortDate } from '../lib/format';

export default function Dashboard({ period, totals, previousTotals, breakdown, trend, budgets, recent }) {
    const { auth } = usePage().props;
    const currency = auth.user?.currency ?? 'INR';

    const spendChange = delta(totals.expense, previousTotals.expense);
    const savingsRate =
        totals.income > 0 ? Math.round(((totals.income - totals.expense) / totals.income) * 100) : null;

    return (
        <AppLayout title="Dashboard">
            <PeriodBar period={period} basePath="/dashboard" />

            {/* -------------------- KPI slabs -------------------- */}
            <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                <IsoStat
                    eyebrow="Income"
                    value={money(totals.income, currency)}
                    sub={`${period.label}`}
                    tone="income"
                    icon={ArrowUpRight}
                />
                <IsoStat
                    eyebrow="Spent"
                    value={money(totals.expense, currency)}
                    sub={
                        spendChange === null
                            ? 'No prior month to compare'
                            : `${spendChange > 0 ? '+' : ''}${spendChange}% vs last month`
                    }
                    tone="expense"
                    icon={ArrowDownRight}
                />
                <IsoStat
                    eyebrow="Net balance"
                    value={money(totals.net, currency)}
                    sub={totals.net < 0 ? 'Spending exceeded income' : 'In the black'}
                    tone={totals.net < 0 ? 'alert' : 'neutral'}
                    icon={Scale}
                />
                <IsoStat
                    eyebrow="Saved"
                    value={savingsRate === null ? '—' : `${savingsRate}%`}
                    sub={`${totals.count} ${totals.count === 1 ? 'entry' : 'entries'} this month`}
                    tone="neutral"
                    icon={TrendingUp}
                />
            </div>

            {/* -------------------- Trend + breakdown -------------------- */}
            <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                <Block className="p-4 sm:p-5">
                    <SectionTitle eyebrow="Last 6 months" title="Income vs spending" />
                    <TrendChart data={trend} currency={currency} />
                </Block>

                <Block className="p-4 sm:p-5">
                    <SectionTitle eyebrow={period.label} title="Where it went" />

                    {breakdown.length === 0 ? (
                        <EmptyState
                            icon={Receipt}
                            title="Nothing spent yet"
                            body="Spending in this month will break down by category here."
                        />
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {breakdown.slice(0, 7).map((row) => (
                                <li key={row.id ?? 'none'}>
                                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                                        <span className="truncate text-sm font-bold">{row.name}</span>
                                        <span className="tnum shrink-0 font-mono text-sm">
                                            {money(row.amount, currency)}
                                        </span>
                                    </div>

                                    <div className="track">
                                        <span
                                            style={{
                                                width: `${Math.max(row.share, 2)}%`,
                                                background: row.color,
                                            }}
                                        />
                                    </div>

                                    <p className="mt-1.5 text-xs text-[var(--on-surface-variant)]">
                                        {row.share}% of spending
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </Block>
            </div>

            {/* -------------------- Budget pressure -------------------- */}
            {budgets.length > 0 && (
                <Block className="mt-5 p-4 sm:p-5">
                    <SectionTitle eyebrow="Set on the categories page" title="Budgets" />

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {budgets.map((budget) => {
                            const over = budget.ratio > 1;
                            const pct = Math.min(budget.ratio * 100, 100);

                            return (
                                <div key={budget.name} className="blk-flat p-4">
                                    <div className="mb-2 flex items-baseline justify-between gap-2">
                                        <span className="truncate text-sm font-bold">{budget.name}</span>
                                        <span
                                            className="tag shrink-0 rounded-full"
                                            style={{
                                                background: over ? 'var(--error-container)' : undefined,
                                                color: over ? 'var(--on-error-container)' : undefined,
                                                borderColor: over ? 'transparent' : undefined,
                                            }}
                                        >
                                            {Math.round(budget.ratio * 100)}%
                                        </span>
                                    </div>

                                    <div className="track" style={{ height: '0.6rem' }}>
                                        <span
                                            style={{
                                                width: `${pct}%`,
                                                background: over ? 'var(--error)' : budget.color,
                                            }}
                                        />
                                    </div>

                                    <p className="tnum mt-1.5 font-mono text-[0.6875rem] text-[var(--on-surface-variant)]">
                                        {money(budget.spent, currency)} of {money(budget.budget, currency)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </Block>
            )}

            {/* -------------------- Recent entries -------------------- */}
            <Block className="blk-clip mt-5">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--outline-variant)] bg-[var(--surface-low)] px-4 py-3">
                    <div>
                        <p className="eyebrow">Most recent</p>
                        <h2 className="text-lg font-bold tracking-tight">Latest entries</h2>
                    </div>

                    <Link href="/transactions" className="btn btn-ghost">
                        View all
                    </Link>
                </div>

                {recent.length === 0 ? (
                    <EmptyState
                        icon={Receipt}
                        title="The ledger is empty"
                        body="Record your first income or expense to see it here."
                        action={
                            <Link href="/transactions" className="btn btn-primary mt-2">
                                Open the ledger
                            </Link>
                        }
                    />
                ) : (
                    <>
                        {/* Table on desktop… */}
                        <div className="scroll-x hidden sm:block">
                            <table className="ledger-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Date</th>
                                        <th scope="col">Category</th>
                                        <th scope="col">Note</th>
                                        <th scope="col" className="text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recent.map((entry) => (
                                        <tr key={entry.id}>
                                            <td className="whitespace-nowrap">{shortDate(entry.occurred_on)}</td>
                                            <td><CategoryChip category={entry.category} /></td>
                                            <td className="max-w-xs truncate text-[var(--on-surface-variant)]">
                                                {entry.note || '—'}
                                            </td>
                                            <td className="tnum whitespace-nowrap text-right font-semibold">
                                                <AmountCell entry={entry} currency={currency} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* …stacked bordered cards on mobile. Same data, no scroll. */}
                        <ul className="flex flex-col sm:hidden">
                            {recent.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="flex items-start justify-between gap-3 border-b border-[var(--outline-variant)] p-3 last:border-b-0"
                                >
                                    <div className="min-w-0">
                                        <CategoryChip category={entry.category} />
                                        <p className="mt-1.5 truncate text-sm">{entry.note || '—'}</p>
                                        <p className="font-mono text-[0.6875rem] text-[var(--on-surface-variant)]">
                                            {shortDate(entry.occurred_on)}
                                        </p>
                                    </div>

                                    <span className="tnum shrink-0 font-mono text-sm font-semibold">
                                        <AmountCell entry={entry} currency={currency} />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </Block>
        </AppLayout>
    );
}

function AmountCell({ entry, currency }) {
    const income = entry.type === 'income';

    return (
        <span style={{ color: income ? undefined : 'var(--error)' }}>
            {income ? '+' : '−'}
            {money(entry.amount, currency).replace('-', '')}
        </span>
    );
}

