<?php

namespace App\Http\Controllers;

use App\Http\Requests\TransactionRequest;
use App\Models\Category;
use App\Models\Transaction;
use App\Services\LedgerChain;
use App\Services\LedgerService;
use App\Support\TransactionPresenter;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TransactionController extends Controller
{
    /** Offered in the rows-per-page control. */
    public const PAGE_SIZES = [10, 20, 50, 100];

    /** What "All" actually means. */
    public const ALL_CAP = 1000;

    public const DEFAULT_PAGE_SIZE = 10;

    public function __construct(
        private readonly LedgerService $ledger,
        private readonly LedgerChain $chain,
    ) {
    }

    public function index(Request $request): Response
    {
        $userId = (string) $request->user()->getKey();

        $filters = [
            'type' => in_array($request->query('type'), ['income', 'expense'], true)
                ? $request->query('type')
                : null,
            'category_id' => $request->query('category_id') ?: null,
            // A pair of dates rather than month/year dropdowns: a range is what
            // people actually want ("that fortnight in July"), and month/year
            // could not express one.
            'from' => $this->parseDate($request->query('from')),
            'to' => $this->parseDate($request->query('to')),
            'search' => trim((string) $request->query('search')) ?: null,
        ];

        $perPage = $this->parsePerPage($request->query('per_page'));

        $query = Transaction::ownedBy($userId)->ofType($filters['type']);

        if ($filters['category_id']) {
            $query->where('category_id', $filters['category_id']);
        }

        // Both bounds are inclusive, which is what a person picking two dates
        // means. `to` therefore compares against the start of the NEXT day.
        if ($filters['from']) {
            $query->where('occurred_on', '>=', CarbonImmutable::parse($filters['from'])->startOfDay());
        }

        if ($filters['to']) {
            $query->where('occurred_on', '<', CarbonImmutable::parse($filters['to'])->startOfDay()->addDay());
        }

        if ($filters['search']) {
            $query->where('note', 'like', '%'.$filters['search'].'%');
        }

        // Cloned BEFORE paginating. `paginate()` applies its limit and offset to
        // this same builder, so a clone taken afterwards would quietly inherit
        // them and the "filtered" totals would only ever describe one page.
        $totalsQuery = clone $query;

        $transactions = $query
            ->orderBy('occurred_on', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage)
            ->withQueryString();

        $categories = Category::ownedBy($userId)->orderBy('name')->get();
        $categoryMap = $categories->keyBy(fn ($c) => (string) $c->getKey());

        return Inertia::render('Transactions/Index', [
            'transactions' => [
                'data' => TransactionPresenter::collection($transactions->getCollection(), $categoryMap),
                'links' => $transactions->linkCollection()->toArray(),
                'meta' => [
                    'current_page' => $transactions->currentPage(),
                    'last_page' => $transactions->lastPage(),
                    'total' => $transactions->total(),
                    'from' => $transactions->firstItem(),
                    'to' => $transactions->lastItem(),
                ],
            ],
            // Totals reflect the ACTIVE FILTER, not the page — a filtered view
            // that showed only the visible page's sum would be misleading.
            'filteredTotals' => $this->ledger->totalsFrom(
                $totalsQuery->get(['type', 'amount'])
            ),
            'filters' => [...$filters, 'per_page' => $request->query('per_page') === 'all' ? 'all' : $perPage],
            'pageSizes' => self::PAGE_SIZES,
            'categories' => $categories->map(fn ($c) => [
                'id' => (string) $c->getKey(),
                'name' => $c->name,
                'type' => $c->type,
                'color' => $c->color,
            ])->values()->all(),
        ]);
    }

    public function store(TransactionRequest $request): RedirectResponse
    {
        $transaction = Transaction::create($request->toAttributes());

        // Every change to the ledger is committed to the audit chain.
        $this->chain->recordTransaction('transaction.created', $transaction);

        return back()->with('success', 'Entry recorded.');
    }

    public function update(TransactionRequest $request, string $transaction): RedirectResponse
    {
        $model = $this->findOwned($request, $transaction);
        $model->update($request->toAttributes());

        $this->chain->recordTransaction('transaction.updated', $model->fresh());

        return back()->with('success', 'Entry updated.');
    }

    public function destroy(Request $request, string $transaction): RedirectResponse
    {
        $model = $this->findOwned($request, $transaction);

        // Recorded BEFORE the delete, so the block still captures what was
        // removed — a deletion with no record of what vanished is useless.
        $this->chain->recordTransaction('transaction.deleted', $model);
        $model->delete();

        return back()->with('success', 'Entry deleted.');
    }

    /**
     * Delete several entries at once.
     *
     * Every id is re-scoped to the signed-in user rather than trusted from the
     * request, so a crafted payload can only ever delete rows the caller already
     * owns. Anything that does not resolve is silently skipped — the response
     * reports how many actually went, not how many were asked for.
     */
    public function destroyMany(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:'.self::ALL_CAP],
            'ids.*' => ['required', 'string'],
        ]);

        $owned = Transaction::ownedBy((string) $request->user()->getKey())
            ->whereIn('_id', $validated['ids'])
            ->get();

        if ($owned->isEmpty()) {
            return back()->with('error', 'Nothing was deleted.');
        }

        // One block per entry, recorded before the delete so the chain captures
        // what each row held. A single "deleted 12 things" block would lose the
        // detail that makes the audit trail worth having.
        foreach ($owned as $entry) {
            $this->chain->recordTransaction('transaction.deleted', $entry);
        }

        $count = $owned->count();

        Transaction::ownedBy((string) $request->user()->getKey())
            ->whereIn('_id', $owned->map(fn ($t) => (string) $t->getKey())->all())
            ->delete();

        return back()->with('success', $count === 1
            ? 'Entry deleted.'
            : "{$count} entries deleted.");
    }

    /**
     * Scoping the lookup by user is the whole authorisation model here — there
     * is no route-model binding, so an id belonging to someone else must 404
     * rather than resolve.
     */
    private function findOwned(Request $request, string $id): Transaction
    {
        return Transaction::ownedBy((string) $request->user()->getKey())
            ->where('_id', $id)
            ->firstOrFail();
    }

    /**
     * Normalise a date from the query string.
     *
     * Anything unparseable becomes null rather than throwing — this is a URL,
     * and a mistyped date should widen the view, not produce an error page.
     */
    private function parseDate(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        try {
            // `!` zeroes the time so today's clock cannot leak in, and the
            // round-trip comparison is what makes this strict: Carbon happily
            // "parses" 31-12-2026 and 2026-13-45 into something, so only a
            // value that formats back to itself is genuinely a Y-m-d date.
            $date = CarbonImmutable::createFromFormat('!Y-m-d', $value);

            return $date && $date->format('Y-m-d') === $value ? $date->toDateString() : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * `all` is capped rather than unbounded: a genuinely unlimited page would
     * hand the browser every document a user has ever written.
     */
    private function parsePerPage(mixed $value): int
    {
        if ($value === 'all') {
            return self::ALL_CAP;
        }

        $size = (int) $value;

        return in_array($size, self::PAGE_SIZES, true) ? $size : self::DEFAULT_PAGE_SIZE;
    }
}
