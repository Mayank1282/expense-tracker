<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Transaction;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * All read-side aggregation for the ledger.
 *
 * Grouping happens in PHP rather than in an aggregation pipeline. For a
 * single-user personal tracker a month is a few hundred documents at most, so
 * the pipeline buys nothing — and keeping the arithmetic in PHP means every
 * total stays an integer in minor units and every number below is covered by a
 * plain unit test with no database involved.
 */
class LedgerService
{
    /**
     * Income / expense / net for one calendar month, in minor units.
     *
     * @return array{income:int,expense:int,net:int,count:int}
     */
    public function monthTotals(string $userId, int $year, int $month): array
    {
        $rows = Transaction::ownedBy($userId)
            ->inMonth($year, $month)
            ->get(['type', 'amount']);

        return $this->totalsFrom($rows);
    }

    /**
     * @param  Collection<int, Transaction>  $rows
     * @return array{income:int,expense:int,net:int,count:int}
     */
    public function totalsFrom(Collection $rows): array
    {
        $income = 0;
        $expense = 0;

        foreach ($rows as $row) {
            if ($row->type === 'income') {
                $income += (int) $row->amount;
            } else {
                $expense += (int) $row->amount;
            }
        }

        return [
            'income' => $income,
            'expense' => $expense,
            'net' => $income - $expense,
            'count' => $rows->count(),
        ];
    }

    /**
     * Spend per category for a month, largest first.
     *
     * @return list<array{id:string|null,name:string,color:string,amount:int,share:float}>
     */
    public function categoryBreakdown(string $userId, int $year, int $month, string $type = 'expense'): array
    {
        $rows = Transaction::ownedBy($userId)
            ->inMonth($year, $month)
            ->where('type', $type)
            ->get(['category_id', 'amount']);

        $categories = Category::ownedBy($userId)->get()->keyBy(fn ($c) => (string) $c->getKey());

        $totals = [];

        foreach ($rows as $row) {
            $key = $row->category_id ? (string) $row->category_id : '__none__';
            $totals[$key] = ($totals[$key] ?? 0) + (int) $row->amount;
        }

        $grandTotal = array_sum($totals);

        $breakdown = [];

        foreach ($totals as $key => $amount) {
            $category = $categories->get($key);

            $breakdown[] = [
                'id' => $key === '__none__' ? null : $key,
                'name' => $category?->name ?? 'Uncategorised',
                'color' => $category?->color ?? '#5C5C56',
                'amount' => $amount,
                // Share is presentational only; the integer amount stays the
                // source of truth so rounding here can never affect a total.
                'share' => $grandTotal > 0 ? round($amount / $grandTotal * 100, 1) : 0.0,
            ];
        }

        usort($breakdown, fn ($a, $b) => $b['amount'] <=> $a['amount']);

        return $breakdown;
    }

    /**
     * Income vs expense for the last N months, oldest first — the trend chart.
     *
     * @return list<array{key:string,label:string,income:int,expense:int,net:int}>
     */
    public function trend(string $userId, int $months = 6, ?CarbonImmutable $endingIn = null): array
    {
        $end = ($endingIn ?? CarbonImmutable::now())->startOfMonth();
        $start = $end->subMonths($months - 1);

        $rows = Transaction::ownedBy($userId)
            ->where('occurred_on', '>=', $start)
            ->where('occurred_on', '<', $end->addMonth())
            ->get(['type', 'amount', 'occurred_on']);

        // Seed every bucket first so a month with no activity still renders as
        // a zero column instead of vanishing from the axis.
        $buckets = [];

        for ($i = 0; $i < $months; $i++) {
            $cursor = $start->addMonths($i);
            $buckets[$cursor->format('Y-m')] = [
                'key' => $cursor->format('Y-m'),
                'label' => $cursor->format('M'),
                'income' => 0,
                'expense' => 0,
                'net' => 0,
            ];
        }

        foreach ($rows as $row) {
            $key = $row->occurred_on->format('Y-m');

            if (! isset($buckets[$key])) {
                continue;
            }

            $buckets[$key][$row->type] += (int) $row->amount;
        }

        foreach ($buckets as $key => $bucket) {
            $buckets[$key]['net'] = $bucket['income'] - $bucket['expense'];
        }

        return array_values($buckets);
    }

    /**
     * Categories that are over, or close to, their monthly budget.
     *
     * @return list<array{name:string,color:string,spent:int,budget:int,ratio:float}>
     */
    public function budgetPressure(string $userId, int $year, int $month): array
    {
        $budgeted = Category::ownedBy($userId)
            ->where('type', 'expense')
            ->where('monthly_budget', '>', 0)
            ->get();

        if ($budgeted->isEmpty()) {
            return [];
        }

        $spendByCategory = collect($this->categoryBreakdown($userId, $year, $month))
            ->keyBy('id');

        $pressure = [];

        foreach ($budgeted as $category) {
            $spent = (int) ($spendByCategory[(string) $category->getKey()]['amount'] ?? 0);
            $budget = (int) $category->monthly_budget;

            $pressure[] = [
                'name' => $category->name,
                'color' => $category->color,
                'spent' => $spent,
                'budget' => $budget,
                'ratio' => round($spent / $budget, 3),
            ];
        }

        usort($pressure, fn ($a, $b) => $b['ratio'] <=> $a['ratio']);

        return $pressure;
    }
}
