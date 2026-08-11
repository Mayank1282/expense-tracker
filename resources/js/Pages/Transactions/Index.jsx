import { useEffect, useMemo, useState } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { Filter, Pencil, Plus, Receipt, Search, Trash2, X } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import {
    Block,
    Btn,
    CategoryChip,
    ConfirmDialog,
    EmptyState,
    Field,
    Modal,
} from '../../Components/Ui';
import { currencySymbol, money, shortDate, todayIso } from '../../lib/format';
import TableFooter from '../../Components/TableFooter';

export default function Index({ transactions, filteredTotals, filters, categories, pageSizes }) {
    const { auth } = usePage().props;
    const currency = auth.user?.currency ?? 'INR';

    const [editing, setEditing] = useState(null); // null = closed, {} = new entry
    const [confirmingId, setConfirmingId] = useState(null);
    const [deleting, setDeleting] = useState(false);

    /*
     * Bulk selection is scoped to the CURRENT PAGE, deliberately.
     *
     * A "select all 153" that reaches beyond what you can see is how people
     * delete things they never looked at. Select-all here means "everything on
     * this page", which is exactly what the checkbox column shows.
     */
    const [selected, setSelected] = useState([]);
    const [confirmingBulk, setConfirmingBulk] = useState(false);

    const pageIds = transactions.data.map((entry) => entry.id);
    const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
    const someOnPageSelected = pageIds.some((id) => selected.includes(id));

    const toggleRow = (id) =>
        setSelected((current) =>
            current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
        );

    const toggleAllOnPage = () =>
        setSelected((current) =>
            allOnPageSelected
                ? current.filter((id) => !pageIds.includes(id))
                : [...new Set([...current, ...pageIds])]
        );

    // Changing page or filters clears the selection: carrying hidden rows into
    // a delete is precisely the accident this guards against.
    useEffect(() => {
        setSelected([]);
    }, [transactions.meta.current_page, filters.type, filters.category_id, filters.from, filters.to, filters.search]);

    const deleteSelected = () =>
        router.delete('/transactions', {
            data: { ids: selected },
            preserveScroll: true,
            onStart: () => setDeleting(true),
            onFinish: () => {
                setDeleting(false);
                setConfirmingBulk(false);
                setSelected([]);
            },
        });

    // The row being confirmed, so the dialog can show what is about to go.
    const confirming = transactions.data.find((entry) => entry.id === confirmingId) ?? null;

    // `per_page` is a display preference, not a filter — counting it would make
    // "Clear 1" appear on a page nobody has filtered.
    const activeFilterCount = Object.entries(filters).filter(
        ([key, value]) => key !== 'per_page' && Boolean(value)
    ).length;

    /*
     * Filters are STAGED, not live.
     *
     * Firing a request on every keystroke and every dropdown change meant the
     * table reshuffled underneath you while you were still deciding what to ask
     * for, and a half-typed search word matched nothing, so the screen went
     * empty mid-thought. Nothing is applied until Search is pressed.
     */
    const blankDraft = {
        type: filters.type ?? '',
        category_id: filters.category_id ?? '',
        from: filters.from ?? '',
        to: filters.to ?? '',
        search: filters.search ?? '',
    };

    const [draft, setDraft] = useState(blankDraft);

    // Re-sync when the server sends different filters back (Clear, the back
    // button, a link carrying filters) so the inputs never disagree with the URL.
    useEffect(() => {
        setDraft({
            type: filters.type ?? '',
            category_id: filters.category_id ?? '',
            from: filters.from ?? '',
            to: filters.to ?? '',
            search: filters.search ?? '',
        });
    }, [filters.type, filters.category_id, filters.from, filters.to, filters.search]);

    const set = (patch) => setDraft((current) => ({ ...current, ...patch }));

    // Something typed but not yet applied: Clear must still be reachable.
    const isDirty = Object.values(draft).some(Boolean);

    /** Navigate keeping the applied filters, changing only what is passed. */
    const go = (patch) =>
        router.get('/transactions', clean({ ...filters, ...patch }), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });

    const runSearch = (event) => {
        event?.preventDefault();

        // Back to page 1: page 6 of the previous result set means nothing here.
        router.get('/transactions', clean({ ...draft, per_page: filters.per_page, page: null }), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const clearAll = () => {
        setDraft({ type: '', category_id: '', from: '', to: '', search: '' });

        // per_page is a display preference and deliberately survives a clear.
        router.get('/transactions', clean({ per_page: filters.per_page }), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <AppLayout
            title="Ledger"
            actions={
                <Btn onClick={() => setEditing({})}>
                    <Plus size={16} strokeWidth={3} />
                    Add entry
                </Btn>
            }
        >
            {/* -------------------- Filters -------------------- */}
            <Block as="form" onSubmit={runSearch} className="p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="eyebrow flex items-center gap-1.5">
                        <Filter size={12} strokeWidth={2.5} />
                        Filters
                    </p>

                    {activeFilterCount > 0 && (
                        <span className="tag rounded-full">{activeFilterCount} applied</span>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Field label="Type">
                        {(props) => (
                            <select
                                {...props}
                                className="field"
                                value={draft.type}
                                onChange={(e) => set({ type: e.target.value })}
                            >
                                <option value="">All</option>
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                            </select>
                        )}
                    </Field>

                    <Field label="Category">
                        {(props) => (
                            <select
                                {...props}
                                className="field"
                                value={draft.category_id}
                                onChange={(e) => set({ category_id: e.target.value })}
                            >
                                <option value="">All</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </Field>

                    <Field label="From" error={undefined}>
                        {(props) => (
                            <input
                                {...props}
                                type="date"
                                className="field"
                                max={draft.to || todayIso()}
                                value={draft.from}
                                onChange={(e) => set({ from: e.target.value })}
                            />
                        )}
                    </Field>

                    <Field label="To">
                        {(props) => (
                            <input
                                {...props}
                                type="date"
                                className="field"
                                min={draft.from || undefined}
                                max={todayIso()}
                                value={draft.to}
                                onChange={(e) => set({ to: e.target.value })}
                            />
                        )}
                    </Field>

                    <Field
                        label="Search notes"
                        placeholder="coffee, rent…"
                        value={draft.search}
                        onChange={(e) => set({ search: e.target.value })}
                    />
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Btn
                        type="button"
                        variant="ghost"
                        onClick={clearAll}
                        disabled={activeFilterCount === 0 && !isDirty}
                    >
                        <X size={16} strokeWidth={2.5} />
                        Clear
                    </Btn>

                    <Btn type="submit">
                        <Search size={16} strokeWidth={2.5} />
                        Search
                    </Btn>
                </div>
            </Block>

            {/* -------------------- Filtered totals -------------------- */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <TotalTile label="Entries" value={filteredTotals.count} mono />
                <TotalTile label="Income" value={money(filteredTotals.income, currency)} tone="income" />
                <TotalTile label="Spent" value={money(filteredTotals.expense, currency)} tone="expense" />
                <TotalTile
                    label="Net"
                    value={money(filteredTotals.net, currency)}
                    tone={filteredTotals.net < 0 ? 'alert' : 'neutral'}
                />
            </div>

            {/* -------------------- Bulk actions -------------------- */}
            {selected.length > 0 && (
                <div
                    className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] px-4 py-3"
                    style={{ background: 'var(--secondary-container)', color: 'var(--on-secondary-container)' }}
                    role="status"
                >
                    <p className="text-sm font-semibold">
                        {selected.length} selected
                    </p>

                    <div className="flex items-center gap-2">
                        <Btn variant="ghost" type="button" onClick={() => setSelected([])}>
                            Clear selection
                        </Btn>

                        <Btn variant="danger" type="button" onClick={() => setConfirmingBulk(true)}>
                            <Trash2 size={16} strokeWidth={2.5} />
                            Delete selected
                        </Btn>
                    </div>
                </div>
            )}

            {/* -------------------- Entries -------------------- */}
            <Block className="blk-clip mt-4">
                {transactions.data.length === 0 ? (
                    <EmptyState
                        icon={Receipt}
                        title={activeFilterCount ? 'Nothing matches those filters' : 'No entries yet'}
                        body={
                            activeFilterCount
                                ? 'Widen or clear the filters to see more of the ledger.'
                                : 'Every income and expense you record will be listed here.'
                        }
                        action={
                            <Btn className="mt-2" onClick={() => setEditing({})}>
                                <Plus size={16} strokeWidth={3} />
                                Add entry
                            </Btn>
                        }
                    />
                ) : (
                    <>
                        <div className="scroll-x hidden md:block">
                            <table className="ledger-table">
                                <thead>
                                    <tr>
                                        <th scope="col" className="w-10">
                                            <input
                                                type="checkbox"
                                                className="tick"
                                                aria-label="Select all entries on this page"
                                                checked={allOnPageSelected}
                                                ref={(el) => {
                                                    // Partial selection is neither
                                                    // checked nor unchecked.
                                                    if (el) {
                                                        el.indeterminate =
                                                            someOnPageSelected && !allOnPageSelected;
                                                    }
                                                }}
                                                onChange={toggleAllOnPage}
                                            />
                                        </th>
                                        <th scope="col">Date</th>
                                        <th scope="col">Category</th>
                                        <th scope="col">Note</th>
                                        <th scope="col" className="text-right">Amount</th>
                                        <th scope="col" className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.data.map((entry) => (
                                        <tr
                                            key={entry.id}
                                            style={{
                                                background: selected.includes(entry.id)
                                                    ? 'color-mix(in oklab, var(--primary) 8%, transparent)'
                                                    : undefined,
                                            }}
                                        >
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    className="tick"
                                                    aria-label={`Select entry from ${shortDate(entry.occurred_on)}`}
                                                    checked={selected.includes(entry.id)}
                                                    onChange={() => toggleRow(entry.id)}
                                                />
                                            </td>
                                            <td className="whitespace-nowrap">{shortDate(entry.occurred_on)}</td>
                                            <td><CategoryChip category={entry.category} /></td>
                                            <td className="max-w-sm truncate text-[var(--on-surface-variant)]">
                                                {entry.note || '—'}
                                            </td>
                                            <td className="tnum whitespace-nowrap text-right font-semibold">
                                                <Amount entry={entry} currency={currency} />
                                            </td>
                                            <td>
                                                <div className="flex justify-end gap-1.5">
                                                    <RowButton label="Edit" onClick={() => setEditing(entry)}>
                                                        <Pencil size={14} strokeWidth={2.5} />
                                                    </RowButton>
                                                    <RowButton label="Delete" onClick={() => setConfirmingId(entry.id)}>
                                                        <Trash2 size={14} strokeWidth={2.5} />
                                                    </RowButton>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Cards below md — no horizontal scroll anywhere. */}
                        <ul className="flex flex-col md:hidden">
                            {transactions.data.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="border-b border-[var(--outline-variant)] p-3 last:border-b-0"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 gap-3">
                                            <input
                                                type="checkbox"
                                                className="tick mt-1 shrink-0"
                                                aria-label={`Select entry from ${shortDate(entry.occurred_on)}`}
                                                checked={selected.includes(entry.id)}
                                                onChange={() => toggleRow(entry.id)}
                                            />

                                            <div className="min-w-0">
                                            <CategoryChip category={entry.category} />
                                            <p className="mt-1.5 break-words text-sm">{entry.note || '—'}</p>
                                            <p className="text-xs text-[var(--on-surface-variant)]">
                                                {shortDate(entry.occurred_on)}
                                            </p>
                                            </div>
                                        </div>

                                        <span className="tnum shrink-0 font-mono text-sm font-semibold">
                                            <Amount entry={entry} currency={currency} />
                                        </span>
                                    </div>

                                    <div className="mt-2.5 flex gap-2">
                                        <Btn variant="ghost" className="flex-1" onClick={() => setEditing(entry)}>
                                            <Pencil size={14} strokeWidth={2.5} />
                                            Edit
                                        </Btn>
                                        <Btn variant="ghost" className="flex-1" onClick={() => setConfirmingId(entry.id)}>
                                            <Trash2 size={14} strokeWidth={2.5} />
                                            Delete
                                        </Btn>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </Block>

            <ConfirmDialog
                open={confirmingBulk}
                title={`Delete ${selected.length} ${selected.length === 1 ? 'entry' : 'entries'}`}
                message="Every selected amount is removed from all totals. Each deletion is recorded in the audit chain, so the history still shows what was here."
                confirmLabel={`Delete ${selected.length}`}
                busy={deleting}
                onCancel={() => setConfirmingBulk(false)}
                onConfirm={deleteSelected}
            />

            <ConfirmDialog
                open={confirmingId !== null}
                title="Delete entry"
                message="This removes the amount from every total. The deletion itself is recorded in the audit chain, so the history still shows what was here."
                detail={
                    confirming && (
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <CategoryChip category={confirming.category} />
                                <p className="mt-1.5 truncate text-sm">{confirming.note || '—'}</p>
                                <p className="text-xs text-[var(--on-surface-variant)]">
                                    {shortDate(confirming.occurred_on)}
                                </p>
                            </div>

                            <span className="tnum shrink-0 font-mono text-sm font-semibold">
                                <Amount entry={confirming} currency={currency} />
                            </span>
                        </div>
                    )
                }
                busy={deleting}
                onCancel={() => setConfirmingId(null)}
                onConfirm={() =>
                    router.delete(`/transactions/${confirmingId}`, {
                        preserveScroll: true,
                        onStart: () => setDeleting(true),
                        onFinish: () => {
                            setDeleting(false);
                            setConfirmingId(null);
                        },
                    })
                }
            />

            <div className="blk blk-clip mt-4">
                <TableFooter
                    page={transactions.meta.current_page - 1}
                    pageCount={transactions.meta.last_page}
                    perPage={filters.per_page ?? 10}
                    sizes={[...pageSizes, 'all']}
                    onPageChange={(zeroBased) => go({ page: zeroBased + 1 })}
                    onPerPageChange={(size) => go({ per_page: size, page: null })}
                    firstRow={(transactions.meta.from ?? 1) - 1}
                    shown={transactions.data.length}
                    total={transactions.meta.total}
                    label="ledger"
                />
            </div>

            <EntryModal
                key={editing?.id ?? 'new'}
                entry={editing}
                categories={categories}
                currency={currency}
                onClose={() => setEditing(null)}
            />
        </AppLayout>
    );
}

/* -------------------------------------------------------------------------- */

function EntryModal({ entry, categories, currency, onClose }) {
    const isEdit = Boolean(entry?.id);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        type: entry?.type ?? 'expense',
        amount: entry ? String((entry.amount ?? 0) / 100) : '',
        occurred_on: entry?.occurred_on ?? todayIso(),
        category_id: entry?.category?.id ?? '',
        note: entry?.note ?? '',
    });

    // Only categories matching the chosen direction — the server enforces this
    // too, but offering an impossible option is a bad form to begin with.
    const options = useMemo(
        () => categories.filter((category) => category.type === data.type),
        [categories, data.type]
    );

    const submit = (event) => {
        event.preventDefault();

        const visit = {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
            },
        };

        if (isEdit) {
            put(`/transactions/${entry.id}`, visit);
        } else {
            post('/transactions', visit);
        }
    };

    return (
        <Modal open={entry !== null} onClose={onClose} title={isEdit ? 'Edit entry' : 'New entry'}>
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                {/* Direction is a segmented control, not a dropdown — it is the
                    single most consequential field on the form. */}
                <div>
                    <span className="label">Direction</span>
                    <div className="grid grid-cols-2 gap-2">
                        {['expense', 'income'].map((type) => {
                            const active = data.type === type;

                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => {
                                        setData((current) => ({ ...current, type, category_id: '' }));
                                    }}
                                    aria-pressed={active}
                                    className="btn capitalize"
                                    style={{
                                        background: active
                                            ? type === 'income'
                                                ? 'var(--primary-container)'
                                                : 'var(--tertiary-container)'
                                            : 'transparent',
                                        color: active
                                            ? type === 'income'
                                                ? 'var(--on-primary-container)'
                                                : 'var(--on-tertiary-container)'
                                            : 'var(--on-surface-variant)',
                                        borderColor: active ? 'transparent' : 'var(--outline-variant)',
                                    }}
                                >
                                    {type}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <Field label={`Amount (${currencySymbol(currency)})`} error={errors.amount}>
                    {(props) => (
                        <input
                            {...props}
                            className="field text-lg font-semibold"
                            type="number"
                            step="0.01"
                            min="0.01"
                            inputMode="decimal"
                            placeholder="0.00"
                            required
                            autoFocus
                            value={data.amount}
                            onChange={(e) => setData('amount', e.target.value)}
                        />
                    )}
                </Field>

                <Field
                    label="Date"
                    type="date"
                    max={todayIso()}
                    required
                    value={data.occurred_on}
                    onChange={(e) => setData('occurred_on', e.target.value)}
                    error={errors.occurred_on}
                />

                <Field label="Category" error={errors.category_id}>
                    {(props) => (
                        <select
                            {...props}
                            className="field"
                            required
                            value={data.category_id}
                            onChange={(e) => setData('category_id', e.target.value)}
                        >
                            {/* Disabled: this is a placeholder, not a real choice.
                                Every entry needs a real category, so the empty
                                value can be the initial state but can never be
                                deliberately re-selected. */}
                            <option value="" disabled>
                                Select a category
                            </option>
                            {options.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    )}
                </Field>

                <Field
                    label="Note"
                    placeholder="What was it for?"
                    maxLength={240}
                    value={data.note}
                    onChange={(e) => setData('note', e.target.value)}
                    error={errors.note}
                />

                <div className="flex gap-2 pt-1">
                    <Btn variant="ghost" type="button" onClick={onClose} className="flex-1">
                        Cancel
                    </Btn>
                    <Btn type="submit" disabled={processing} className="flex-1">
                        {processing ? 'Saving…' : isEdit ? 'Save changes' : 'Record entry'}
                    </Btn>
                </div>
            </form>
        </Modal>
    );
}

function Amount({ entry, currency }) {
    const income = entry.type === 'income';

    return (
        <span style={{ color: income ? undefined : 'var(--error)' }}>
            {income ? '+' : '−'}
            {money(entry.amount, currency).replace('-', '')}
        </span>
    );
}

function TotalTile({ label, value, tone = 'neutral' }) {
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
        <div
            className="rounded-[var(--radius-lg)] border border-transparent p-4"
            style={{ background, color }}
        >
            <p className="eyebrow" style={{ color: 'currentColor', opacity: 0.75 }}>
                {label}
            </p>
            <p className="tnum mt-1 truncate font-mono text-base font-semibold sm:text-lg">{value}</p>
        </div>
    );
}

function RowButton({ children, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="state grid size-10 place-items-center rounded-full text-[var(--on-surface-variant)]"
        >
            {children}
        </button>
    );
}

/** Drop empty values so the URL only ever carries filters that are actually on. */
function clean(params) {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== null && value !== '' && value !== undefined)
    );
}
