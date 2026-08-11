import { useState } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { Block, Btn, ConfirmDialog, EmptyState, Field, Modal } from '../../Components/Ui';
import { currencySymbol, money } from '../../lib/format';

export default function Index({ categories, palette, monthLabel }) {
    const { auth } = usePage().props;
    const currency = auth.user?.currency ?? 'INR';

    const [editing, setEditing] = useState(null);
    const [confirming, setConfirming] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Set when a delete is refused because the category still holds entries.
    // Raised on the client for instant feedback; the server enforces it too, so
    // a crafted request cannot get past it.
    const [blocked, setBlocked] = useState(null);

    const requestDelete = (category) => {
        if (category.transaction_count > 0) {
            setBlocked(category);

            return;
        }

        setBlocked(null);
        setConfirming(category);
    };

    const income = categories.filter((c) => c.type === 'income');
    const expense = categories.filter((c) => c.type === 'expense');

    return (
        <AppLayout
            title="Categories"
            actions={
                <Btn onClick={() => setEditing({})}>
                    <Plus size={16} strokeWidth={3} />
                    New category
                </Btn>
            }
        >
            {/* -------------------- Blocked-delete notice -------------------- */}
            {blocked && (
                <div
                    className="mb-5 flex items-start gap-3 rounded-[var(--radius-lg)] p-4"
                    style={{ background: 'var(--error-container)', color: 'var(--on-error-container)' }}
                    role="alert"
                >
                    <AlertTriangle size={20} className="mt-0.5 shrink-0" />

                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">Cannot delete &ldquo;{blocked.name}&rdquo;</p>
                        <p className="mt-0.5 text-sm">
                            {blocked.transaction_count}{' '}
                            {blocked.transaction_count === 1 ? 'entry uses' : 'entries use'} this
                            category. Reassign or delete{' '}
                            {blocked.transaction_count === 1 ? 'it' : 'them'} in the ledger first.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setBlocked(null)}
                        aria-label="Dismiss"
                        className="state grid size-8 shrink-0 place-items-center rounded-full"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>
            )}

            {categories.length === 0 ? (
                <Block>
                    <EmptyState
                        icon={Tags}
                        title="No categories"
                        body="Categories are the buckets your entries are filed into."
                        action={
                            <Btn className="mt-2" onClick={() => setEditing({})}>
                                <Plus size={16} strokeWidth={3} />
                                Create one
                            </Btn>
                        }
                    />
                </Block>
            ) : (
                <div className="flex flex-col gap-7">
                    <Group
                        title="Expense"
                        subtitle={`Spending in ${monthLabel}`}
                        items={expense}
                        currency={currency}
                        onEdit={setEditing}
                        onDelete={requestDelete}
                    />
                    <Group
                        title="Income"
                        subtitle="Earning buckets"
                        items={income}
                        currency={currency}
                        onEdit={setEditing}
                        onDelete={requestDelete}
                    />
                </div>
            )}

            <ConfirmDialog
                open={confirming !== null}
                title="Delete category"
                message={
                    confirming?.transaction_count > 0
                        ? `Its ${confirming.transaction_count} ${
                              confirming.transaction_count === 1 ? 'entry stays' : 'entries stay'
                          } in the ledger and become uncategorised. No total changes.`
                        : 'This category has no entries, so nothing else is affected.'
                }
                detail={
                    confirming && (
                        <div className="flex items-center gap-3">
                            <span
                                aria-hidden
                                className="size-8 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                                style={{ background: confirming.color }}
                            />
                            <div>
                                <p className="text-sm font-bold">{confirming.name}</p>
                                <p className="text-xs text-[var(--on-surface-variant)]">
                                    {confirming.type}
                                </p>
                            </div>
                        </div>
                    )
                }
                busy={deleting}
                onCancel={() => setConfirming(null)}
                onConfirm={() =>
                    router.delete(`/categories/${confirming.id}`, {
                        preserveScroll: true,
                        onStart: () => setDeleting(true),
                        onFinish: () => {
                            setDeleting(false);
                            setConfirming(null);
                        },
                    })
                }
            />

            <CategoryModal
                key={editing?.id ?? 'new'}
                category={editing}
                palette={palette}
                currency={currency}
                onClose={() => setEditing(null)}
            />
        </AppLayout>
    );
}

function Group({ title, subtitle, items, currency, onEdit, onDelete }) {
    if (items.length === 0) {
        return null;
    }

    return (
        <section>
            <div className="mb-3">
                <p className="eyebrow">{subtitle}</p>
                <h2 className="display text-xl font-bold tracking-tight">{title}</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((category) => {
                    const overBudget =
                        category.monthly_budget > 0 && category.spent_this_month > category.monthly_budget;

                    return (
                        <Block key={category.id} className="flex flex-col p-5">
                            <div className="flex items-start gap-3">
                                <span
                                    aria-hidden
                                    className="mt-0.5 size-10 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                                    style={{ background: category.color }}
                                />

                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-base font-bold tracking-tight">{category.name}</h3>
                                    <p className="text-xs text-[var(--on-surface-variant)]">
                                        {category.transaction_count}{' '}
                                        {category.transaction_count === 1 ? 'entry' : 'entries'}
                                    </p>
                                </div>
                            </div>

                            {category.type === 'expense' && (
                                <div className="mt-3">
                                    {category.monthly_budget > 0 ? (
                                        <>
                                            <div className="track" style={{ height: '0.55rem' }}>
                                                <span
                                                    style={{
                                                        width: `${Math.min(
                                                            (category.spent_this_month / category.monthly_budget) * 100,
                                                            100
                                                        )}%`,
                                                        background: overBudget
                                                            ? 'var(--error)'
                                                            : category.color,
                                                    }}
                                                />
                                            </div>
                                            <p className="tnum mt-2 font-mono text-xs text-[var(--on-surface-variant)]">
                                                {money(category.spent_this_month, currency)} of{' '}
                                                {money(category.monthly_budget, currency)}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="tnum font-mono text-xs text-[var(--on-surface-variant)]">
                                            {money(category.spent_this_month, currency)} this month · no budget set
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="mt-4 flex gap-2 pt-1">
                                <Btn variant="ghost" className="flex-1" onClick={() => onEdit(category)}>
                                    <Pencil size={14} strokeWidth={2.5} />
                                    Edit
                                </Btn>
                                <Btn variant="ghost" className="flex-1" onClick={() => onDelete(category)}>
                                    <Trash2 size={14} strokeWidth={2.5} />
                                    Delete
                                </Btn>
                            </div>
                        </Block>
                    );
                })}
            </div>
        </section>
    );
}

function CategoryModal({ category, palette, currency, onClose }) {
    const isEdit = Boolean(category?.id);
    const locked = isEdit && category.transaction_count > 0;

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: category?.name ?? '',
        type: category?.type ?? 'expense',
        color: category?.color ?? palette[0],
        monthly_budget: category?.monthly_budget ? String(category.monthly_budget / 100) : '',
    });

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
            put(`/categories/${category.id}`, visit);
        } else {
            post('/categories', visit);
        }
    };

    return (
        <Modal open={category !== null} onClose={onClose} title={isEdit ? 'Edit category' : 'New category'}>
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                <Field
                    label="Name"
                    required
                    autoFocus
                    maxLength={40}
                    placeholder="Groceries"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    error={errors.name}
                />

                <div>
                    <span className="label">Type</span>
                    <div className="grid grid-cols-2 gap-2">
                        {['expense', 'income'].map((type) => {
                            const active = data.type === type;

                            return (
                                <button
                                    key={type}
                                    type="button"
                                    disabled={locked}
                                    aria-pressed={active}
                                    onClick={() => setData('type', type)}
                                    className="btn"
                                    style={{
                                        background: active
                                            ? type === 'income'
                                                ? 'var(--primary)'
                                                : 'var(--tertiary)'
                                            : 'var(--surface-container)',
                                        color: active
                                            ? type === 'income'
                                                ? 'var(--on-primary)'
                                                : 'var(--on-tertiary)'
                                            : 'var(--on-surface)',
                                    }}
                                >
                                    {type}
                                </button>
                            );
                        })}
                    </div>

                    {locked && (
                        <p className="mt-1 font-mono text-xs text-[var(--on-surface-variant)]">
                            Locked — this category already has entries filed under it.
                        </p>
                    )}
                    {errors.type && (
                        <p className="mt-1 font-mono text-xs font-semibold text-[var(--error)]">{errors.type}</p>
                    )}
                </div>

                <div>
                    <span className="label">Colour</span>
                    <div className="flex flex-wrap gap-2">
                        {palette.map((color) => {
                            const active = data.color === color;

                            return (
                                <button
                                    key={color}
                                    type="button"
                                    aria-label={`Colour ${color}`}
                                    aria-pressed={active}
                                    onClick={() => setData('color', color)}
                                    className="size-11 rounded-full transition-transform"
                                    style={{
                                        background: color,
                                        outline: active ? '2px solid var(--on-surface)' : '1px solid rgb(0 0 0 / 0.12)',
                                        outlineOffset: active ? '3px' : '0',
                                        transform: active ? 'scale(1.06)' : 'none',
                                    }}
                                />
                            );
                        })}
                    </div>
                    {errors.color && (
                        <p className="mt-1 font-mono text-xs font-semibold text-[var(--error)]">{errors.color}</p>
                    )}
                </div>

                {data.type === 'expense' && (
                    <Field
                        label={`Monthly budget (${currencySymbol(currency)}) — optional`}
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={data.monthly_budget}
                        onChange={(e) => setData('monthly_budget', e.target.value)}
                        error={errors.monthly_budget}
                        hint="Leave blank for no budget. Budgets show as a bar on the dashboard."
                    />
                )}

                <div className="flex gap-2 pt-1">
                    <Btn variant="ghost" type="button" onClick={onClose} className="flex-1">
                        Cancel
                    </Btn>
                    <Btn type="submit" disabled={processing} className="flex-1">
                        {processing ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
                    </Btn>
                </div>
            </form>
        </Modal>
    );
}
