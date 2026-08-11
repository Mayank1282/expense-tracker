<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Transaction;
use App\Services\LedgerService;
use App\Support\TransactionPresenter;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(private readonly LedgerService $ledger)
    {
    }

    public function __invoke(Request $request): Response
    {
        $userId = (string) $request->user()->getKey();
        $now = CarbonImmutable::now();

        $month = (int) $request->integer('month', $now->month);
        $year = (int) $request->integer('year', $now->year);

        // Clamp rather than 404 — a hand-typed ?month=99 should show something
        // sensible, not an error page.
        $month = max(1, min(12, $month));
        $year = max(2000, min((int) $now->year + 1, $year));

        $cursor = CarbonImmutable::create($year, $month, 1);

        $totals = $this->ledger->monthTotals($userId, $year, $month);
        $previous = $this->ledger->monthTotals(
            $userId,
            (int) $cursor->subMonth()->year,
            (int) $cursor->subMonth()->month
        );

        $recent = Transaction::ownedBy($userId)
            ->orderBy('occurred_on', 'desc')
            ->orderBy('created_at', 'desc')
            ->limit(8)
            ->get();

        $categories = Category::ownedBy($userId)->get()->keyBy(fn ($c) => (string) $c->getKey());

        return Inertia::render('Dashboard', [
            'period' => [
                'year' => $year,
                'month' => $month,
                'label' => $cursor->format('F Y'),
                'isCurrent' => $year === (int) $now->year && $month === (int) $now->month,
                'prev' => ['year' => (int) $cursor->subMonth()->year, 'month' => (int) $cursor->subMonth()->month],
                'next' => ['year' => (int) $cursor->addMonth()->year, 'month' => (int) $cursor->addMonth()->month],
            ],
            'totals' => $totals,
            'previousTotals' => $previous,
            'breakdown' => $this->ledger->categoryBreakdown($userId, $year, $month),
            'trend' => $this->ledger->trend($userId, 6, $cursor),
            'budgets' => $this->ledger->budgetPressure($userId, $year, $month),
            'recent' => TransactionPresenter::collection($recent, $categories),
        ]);
    }
}
