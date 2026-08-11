import { useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { Download, Printer, Receipt } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { Block, CategoryChip, EmptyState } from '../../Components/Ui';
import PeriodBar from '../../Components/PeriodBar';
import TableFooter, { usePageWindow } from '../../Components/TableFooter';
import { money, shortDate } from '../../lib/format';

export default function Monthly({
    period,
    totals,
    expenseBreakdown,
    incomeBreakdown,
    entries,
    generatedAt,
}) {
    const { auth } = usePage().props;
    const currency = auth.user?.currency ?? 'INR';
    const query = `year=${period.year}&month=${period.month}`;

    const [page, setPage] = useState(0);
    const [perPage, setPerPage] = useState(10);
    const { pageCount, safePage, firstRow, visible } = usePageWindow(entries, perPage, page);

    return (
        <AppLayout
            title="Monthly report"
            actions={
                <>
                    <a href={`/reports/export?${query}`} className="btn btn-ghost">
                        <Download size={16} strokeWidth={2.5} />
                        CSV
                    </a>
                    {/* Opens the standalone print sheet, which auto-triggers the
                        dialog. Printing the app page meant hiding half of it. */}
                    <a
                        href={`/reports/print?${query}&autoprint=1`}
                        target="_blank"
                        rel="noopener"
                        className="btn btn-violet"
                    >
                        <Printer size={16} strokeWidth={2.5} />
                        Print
                    </a>
                </>
            }
        >
            <div className="no-print">
                <PeriodBar period={period} basePath="/reports/monthly" />
            </div>

            {/* Print-only masthead. The screen already shows this in the chrome. */}
            <div className="mb-4 hidden print:block">
                <h1 className="text-2xl font-bold">Ledger — {period.label}</h1>
                <p className="font-mono text-xs">
                    {auth.user?.name} · generated {generatedAt}
                </p>
            </div>

            {/* -------------------- Summary -------------------- */}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryTile label="Income" value={money(totals.income, currency)} tone="income" />
                <SummaryTile label="Spent" value={money(totals.expense, currency)} tone="expense" />
                <SummaryTile
                    label="Net"
                    value={money(totals.net, currency)}
                    tone={totals.net < 0 ? 'alert' : 'neutral'}
                />
            </div>

            {/* -------------------- Breakdowns -------------------- */}
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <BreakdownBlock
                    title="Spending by category"
                    rows={expenseBreakdown}
                    currency={currency}
                    emptyBody="No spending recorded in this month."
                />
                <BreakdownBlock
                    title="Income by category"
                    rows={incomeBreakdown}
                    currency={currency}
                    emptyBody="No income recorded in this month."
                />
            </div>

            {/* -------------------- Full ledger -------------------- */}
            <Block className="blk-clip mt-5">
                <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-low)] px-4 py-3">
                    <p className="eyebrow">Every entry</p>
                    <h2 className="text-lg font-bold tracking-tight">
                        {period.label} — {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                    </h2>
                </div>

                {entries.length === 0 ? (
                    <EmptyState
                        icon={Receipt}
                        title="Nothing recorded"
                        body="This month has no entries yet."
                        action={
                            <Link href="/transactions" className="btn btn-primary mt-2">
                                Open the ledger
                            </Link>
                        }
                    />
                ) : (
                    <>
                        <div className="scroll-x hidden sm:block">
                            <table className="ledger-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Date</th>
                                        <th scope="col">Category</th>
                                        <th scope="col">Note</th>
                                        <th scope="col" className="text-right">Income</th>
                                        <th scope="col" className="text-right">Expense</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((entry) => (
                                        <tr key={entry.id}>
                                            <td className="whitespace-nowrap">{shortDate(entry.occurred_on)}</td>
                                            <td><CategoryChip category={entry.category} /></td>
                                            <td className="max-w-sm truncate text-[var(--on-surface-variant)]">
                                                {entry.note || '—'}
                                            </td>
                                            <td className="tnum text-right">
                                                {entry.type === 'income' ? money(entry.amount, currency) : ''}
                                            </td>
                                            <td className="tnum text-right">
                                                {entry.type === 'expense' ? money(entry.amount, currency) : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>

                                <tfoot>
                                    <tr className="border-t border-[var(--outline-variant)] bg-[var(--surface-low)] font-semibold">
                                        <td colSpan={3} className="px-3 py-2.5 font-mono text-xs uppercase tracking-wider">
                                            Totals
                                        </td>
                                        <td className="tnum px-3 py-2.5 text-right">{money(totals.income, currency)}</td>
                                        <td className="tnum px-3 py-2.5 text-right">{money(totals.expense, currency)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <ul className="flex flex-col sm:hidden">
                            {visible.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="flex items-start justify-between gap-3 border-b border-[var(--outline-variant)] p-3 last:border-b-0"
                                >
                                    <div className="min-w-0">
                                        <CategoryChip category={entry.category} />
                                        <p className="mt-1.5 break-words text-sm">{entry.note || '—'}</p>
                                        <p className="font-mono text-[0.6875rem] text-[var(--on-surface-variant)]">
                                            {shortDate(entry.occurred_on)}
                                        </p>
                                    </div>

                                    <span
                                        className="tnum shrink-0 font-mono text-sm font-semibold"
                                        style={{
                                            color: entry.type === 'expense' ? 'var(--error)' : undefined,
                                        }}
                                    >
                                        {entry.type === 'income' ? '+' : '−'}
                                        {money(entry.amount, currency).replace('-', '')}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <div className="no-print">
                            <TableFooter
                                page={safePage}
                                pageCount={pageCount}
                                perPage={perPage}
                                onPageChange={setPage}
                                onPerPageChange={(size) => {
                                    setPerPage(size);
                                    setPage(0);
                                }}
                                firstRow={firstRow}
                                shown={visible.length}
                                total={entries.length}
                                label="report"
                            />
                        </div>
                    </>
                )}
            </Block>
        </AppLayout>
    );
}

function SummaryTile({ label, value, tone }) {
    const background = {
        neutral: 'var(--surface-high)',
        income: 'var(--primary-container)',
        expense: 'var(--tertiary-container)',
        alert: 'var(--error-container)',
    }[tone];

    const color = {
        neutral: 'var(--on-surface)',
        income: 'var(--on-primary-container)',
        expense: 'var(--on-tertiary-container)',
        alert: 'var(--on-error-container)',
    }[tone];

    return (
        <div className="blk p-4" style={{ background, color }}>
            <p className="eyebrow" style={{ color: 'currentColor', opacity: 0.72 }}>
                {label}
            </p>
            <p className="tnum mt-1 font-mono text-2xl font-semibold">{value}</p>
        </div>
    );
}

function BreakdownBlock({ title, rows, currency, emptyBody }) {
    return (
        <Block className="p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-bold tracking-tight">{title}</h2>

            {rows.length === 0 ? (
                <p className="py-6 text-center font-mono text-xs text-[var(--on-surface-variant)]">{emptyBody}</p>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {rows.map((row) => (
                        <li key={row.id ?? 'none'} className="flex items-center gap-3">
                            <span
                                aria-hidden
                                className="size-3.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                                style={{ background: row.color }}
                            />

                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.name}</span>

                            <span className="tnum shrink-0 font-mono text-sm">{money(row.amount, currency)}</span>

                            <span className="tag shrink-0 rounded-full">{row.share}%</span>
                        </li>
                    ))}
                </ul>
            )}
        </Block>
    );
}
