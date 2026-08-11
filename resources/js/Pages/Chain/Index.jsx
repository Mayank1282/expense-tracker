import { router, usePage } from '@inertiajs/react';
import {
    Blocks,
    CircleAlert,
    ShieldCheck,
    ShieldX,
    Link2,
    RotateCcw,
    Wrench,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { Block as Card, Btn, EmptyState } from '../../Components/Ui';
import { money } from '../../lib/format';

const EVENT_LABEL = {
    'genesis': 'Ledger opened',
    'transaction.created': 'Entry recorded',
    'transaction.updated': 'Entry edited',
    'transaction.deleted': 'Entry deleted',
};

export default function Index({ blocks, verification, canDemo }) {
    const { auth } = usePage().props;
    const currency = auth.user?.currency ?? 'INR';
    const valid = verification.valid;

    return (
        <AppLayout
            title="Audit chain"
            actions={
                <>
                    {canDemo && blocks.data.length > 0 && (
                        <Btn
                            variant="ghost"
                            onClick={() => router.post('/chain/tamper', {}, { preserveScroll: true })}
                        >
                            <Wrench size={16} />
                            Tamper (demo)
                        </Btn>
                    )}

                    <Btn onClick={() => router.post('/chain/verify', {}, { preserveScroll: true })}>
                        <ShieldCheck size={16} />
                        Verify chain
                    </Btn>
                </>
            }
        >
            <p className="mb-5 max-w-3xl text-sm leading-relaxed text-[var(--on-surface-variant)]">
                Every change to the ledger is committed to an append-only chain, each block
                carrying the hash of the one before it. Alter or remove any past record and every
                block after it stops verifying. The transactions themselves stay editable — this
                sits alongside them as the tamper-evident history.
            </p>

            {/* -------------------- Verification banner -------------------- */}
            <div
                className="flex flex-col gap-3 rounded-[var(--radius-xl)] p-5 sm:flex-row sm:items-center sm:justify-between"
                style={{
                    background: valid ? 'var(--primary-container)' : 'var(--error-container)',
                    color: valid ? 'var(--on-primary-container)' : 'var(--on-error-container)',
                }}
            >
                <div className="flex items-start gap-3">
                    {valid ? (
                        <ShieldCheck size={26} className="mt-0.5 shrink-0" />
                    ) : (
                        <ShieldX size={26} className="mt-0.5 shrink-0" />
                    )}

                    <div>
                        <p className="text-lg font-bold tracking-tight">
                            {valid ? 'Chain intact' : `Chain broken at block #${verification.brokenAt}`}
                        </p>
                        <p className="mt-0.5 text-sm opacity-90">
                            {valid
                                ? `${verification.length} ${verification.length === 1 ? 'block' : 'blocks'} verified — every hash matches the block before it.`
                                : verification.reason}
                        </p>
                    </div>
                </div>

                {verification.head && (
                    <div className="shrink-0 sm:text-right">
                        <p className="eyebrow" style={{ color: 'currentColor', opacity: 0.75 }}>
                            Head
                        </p>
                        <p className="font-mono text-xs break-all">{verification.head.slice(0, 24)}…</p>
                    </div>
                )}
            </div>

            {!valid && canDemo && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-container)] p-4">
                    <CircleAlert size={18} className="shrink-0 text-[var(--error)]" />
                    <p className="flex-1 text-sm text-[var(--on-surface-variant)]">
                        That is the demo tamper. Clear the chain to start clean — the next ledger
                        change begins a new one.
                    </p>
                    <Btn
                        variant="ghost"
                        onClick={() => router.delete('/chain', { preserveScroll: true })}
                    >
                        <RotateCcw size={15} />
                        Reset chain
                    </Btn>
                </div>
            )}

            {/* -------------------- Blocks -------------------- */}
            <Card className="blk-clip mt-6">
                {blocks.data.length === 0 ? (
                    <EmptyState
                        icon={Blocks}
                        title="No blocks yet"
                        body="Record, edit or delete a transaction and the first blocks appear here."
                    />
                ) : (
                    <ul className="flex flex-col">
                        {blocks.data.map((block) => {
                            const broken =
                                !valid && verification.brokenAt !== null && block.index >= verification.brokenAt;

                            return (
                                <li
                                    key={block.index}
                                    className="border-b border-[var(--outline-variant)] p-4 last:border-b-0 sm:p-5"
                                    style={{
                                        background: broken
                                            ? 'color-mix(in oklab, var(--error) 8%, transparent)'
                                            : undefined,
                                    }}
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="tag rounded-full font-semibold">#{block.index}</span>

                                        <span
                                            className="tag rounded-full"
                                            style={
                                                block.event === 'transaction.deleted'
                                                    ? {
                                                          background: 'var(--error-container)',
                                                          color: 'var(--on-error-container)',
                                                          borderColor: 'transparent',
                                                      }
                                                    : block.event === 'genesis'
                                                      ? {
                                                            background: 'var(--tertiary-container)',
                                                            color: 'var(--on-tertiary-container)',
                                                            borderColor: 'transparent',
                                                        }
                                                      : undefined
                                            }
                                        >
                                            {EVENT_LABEL[block.event] ?? block.event}
                                        </span>

                                        {block.payload?.amount !== undefined && (
                                            <span className="tnum font-mono text-sm font-semibold">
                                                {block.payload.type === 'income' ? '+' : '−'}
                                                {money(block.payload.amount, currency)}
                                            </span>
                                        )}

                                        <span className="ml-auto text-xs text-[var(--on-surface-variant)]">
                                            {block.created_at}
                                        </span>
                                    </div>

                                    {block.payload?.note && (
                                        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                                            {block.payload.note}
                                        </p>
                                    )}

                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        <HashLine label="Hash" value={block.short_hash} strong />
                                        <HashLine
                                            label="Previous"
                                            value={block.index === 0 ? 'genesis' : block.short_previous}
                                        />
                                    </div>

                                    {broken && (
                                        <p className="mt-3 text-xs font-semibold text-[var(--error)]">
                                            {block.index === verification.brokenAt
                                                ? verification.reason
                                                : 'Invalidated by the broken block above it.'}
                                        </p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>

            <p className="mt-5 max-w-3xl text-xs leading-relaxed text-[var(--on-surface-variant)]">
                <strong>Scope, honestly:</strong> this is a local hash chain, not a distributed
                ledger — no network, no consensus, no wallet, no gas. It is also the exact
                structure you would anchor on-chain later: publish the head hash to a testnet and
                every block beneath it inherits that guarantee, without a single private amount
                leaving the database.
            </p>
        </AppLayout>
    );
}

function HashLine({ label, value, strong }) {
    return (
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--surface-low)] px-3 py-2">
            <Link2 size={13} className="shrink-0 text-[var(--on-surface-variant)]" />
            <span className="eyebrow shrink-0">{label}</span>
            <span
                className={`truncate font-mono text-xs ${strong ? 'font-semibold' : ''}`}
                style={{ color: strong ? 'var(--primary)' : 'var(--on-surface-variant)' }}
            >
                {value}
            </span>
        </div>
    );
}
