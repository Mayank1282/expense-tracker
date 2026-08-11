import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZES = [10, 20, 50, 100, 'all'];

/**
 * The single pagination footer used under every table in the app.
 *
 * Rows-per-page sits hard left, page numbers hard right, both below the table —
 * a reader reaches the controls exactly where they run out of rows, rather than
 * scrolling back to a header.
 *
 * It is driven by callbacks rather than links so the same component serves both
 * the client-side tables (the EMI schedule, the monthly report) and the
 * server-paginated ledger. Three near-identical copies would have drifted apart
 * within a week.
 */
export default function TableFooter({
    page,
    pageCount,
    perPage,
    onPageChange,
    onPerPageChange,
    firstRow,
    shown,
    total,
    sizes = PAGE_SIZES,
    label = 'rows',
}) {
    const showingAll = perPage === 'all';

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--outline-variant)] px-3 py-3">
            <div className="flex items-center gap-2.5">
                <label htmlFor={`per-page-${label}`} className="text-xs text-[var(--on-surface-variant)]">
                    Rows
                </label>

                <select
                    id={`per-page-${label}`}
                    className="field min-h-9 w-auto py-1 pr-8 text-xs"
                    value={String(perPage)}
                    onChange={(e) => {
                        const next = e.target.value;
                        onPerPageChange(next === 'all' ? 'all' : Number(next));
                    }}
                >
                    {sizes.map((size) => (
                        <option key={size} value={String(size)}>
                            {size === 'all' ? 'All' : size}
                        </option>
                    ))}
                </select>

                <span className="font-mono text-xs text-[var(--on-surface-variant)]">
                    {total === 0
                        ? 'None'
                        : showingAll
                          ? `All ${total}`
                          : `${firstRow + 1}–${firstRow + shown} of ${total}`}
                </span>
            </div>

            {pageCount > 1 ? (
                <Pager page={page} pageCount={pageCount} onChange={onPageChange} />
            ) : (
                <span />
            )}
        </div>
    );
}

function Pager({ page, pageCount, onChange }) {
    // At most seven numbers, centred on the current page — a 360-month schedule
    // would otherwise render 36 buttons and wrap onto three lines.
    const window = 7;
    const start = Math.max(0, Math.min(page - Math.floor(window / 2), pageCount - window));
    const pages = Array.from({ length: Math.min(window, pageCount) }, (_, i) => start + i);

    return (
        <nav className="flex flex-wrap items-center justify-end gap-1" aria-label="Pagination">
            <button
                type="button"
                onClick={() => onChange(page - 1)}
                disabled={page === 0}
                aria-label="Previous page"
                className="state grid size-10 place-items-center rounded-full text-[var(--on-surface-variant)] disabled:opacity-35"
            >
                <ChevronLeft size={17} />
            </button>

            {start > 0 && <span className="px-1 text-[var(--on-surface-variant)]">…</span>}

            {pages.map((p) => {
                const active = p === page;

                return (
                    <button
                        key={p}
                        type="button"
                        onClick={() => onChange(p)}
                        aria-current={active ? 'page' : undefined}
                        aria-label={`Page ${p + 1}`}
                        className="state grid min-h-10 min-w-10 place-items-center rounded-full px-2 font-mono text-sm font-semibold"
                        style={{
                            background: active ? 'var(--primary)' : 'transparent',
                            color: active ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                        }}
                    >
                        {p + 1}
                    </button>
                );
            })}

            {start + pages.length < pageCount && (
                <span className="px-1 text-[var(--on-surface-variant)]">…</span>
            )}

            <button
                type="button"
                onClick={() => onChange(page + 1)}
                disabled={page >= pageCount - 1}
                aria-label="Next page"
                className="state grid size-10 place-items-center rounded-full text-[var(--on-surface-variant)] disabled:opacity-35"
            >
                <ChevronRight size={17} />
            </button>
        </nav>
    );
}

/**
 * Client-side paging maths, shared by the tables that hold all their rows in
 * memory (the EMI schedule and the monthly report).
 */
export function usePageWindow(rows, perPage, page) {
    const showingAll = perPage === 'all';
    const size = showingAll ? Math.max(rows.length, 1) : perPage;
    const pageCount = showingAll ? 1 : Math.max(Math.ceil(rows.length / size), 1);
    const safePage = Math.min(page, pageCount - 1);
    const firstRow = safePage * size;

    return {
        showingAll,
        pageCount,
        safePage,
        firstRow,
        visible: showingAll ? rows : rows.slice(firstRow, firstRow + size),
    };
}
