<?php

namespace Tests\Feature;

use App\Services\LedgerService;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\Attributes\Test;
use Tests\LedgerTestCase;

class LedgerServiceTest extends LedgerTestCase
{
    private LedgerService $ledger;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ledger = app(LedgerService::class);
    }

    #[Test]
    public function month_totals_only_count_the_month_asked_for(): void
    {
        $user = $this->makeUser();

        $this->makeTransaction($user, ['type' => 'income', 'amount' => 500000, 'occurred_on' => CarbonImmutable::create(2026, 3, 1)]);
        $this->makeTransaction($user, ['type' => 'expense', 'amount' => 120000, 'occurred_on' => CarbonImmutable::create(2026, 3, 31)]);

        // Boundaries in both directions: the last instant of February and the
        // first of April must both fall outside March.
        $this->makeTransaction($user, ['type' => 'expense', 'amount' => 999999, 'occurred_on' => CarbonImmutable::create(2026, 2, 28)]);
        $this->makeTransaction($user, ['type' => 'expense', 'amount' => 999999, 'occurred_on' => CarbonImmutable::create(2026, 4, 1)]);

        $totals = $this->ledger->monthTotals((string) $user->getKey(), 2026, 3);

        $this->assertSame(500000, $totals['income']);
        $this->assertSame(120000, $totals['expense']);
        $this->assertSame(380000, $totals['net']);
        $this->assertSame(2, $totals['count']);
    }

    #[Test]
    public function totals_never_include_another_users_entries(): void
    {
        $mine = $this->makeUser();
        $theirs = $this->makeUser();

        $this->makeTransaction($mine, ['type' => 'expense', 'amount' => 10000]);
        $this->makeTransaction($theirs, ['type' => 'expense', 'amount' => 5000000]);

        $totals = $this->ledger->monthTotals(
            (string) $mine->getKey(),
            (int) now()->year,
            (int) now()->month
        );

        $this->assertSame(10000, $totals['expense']);
    }

    #[Test]
    public function the_breakdown_shares_add_up_to_one_hundred_percent(): void
    {
        $user = $this->makeUser();
        $rent = $this->makeCategory($user, ['name' => 'Rent']);
        $food = $this->makeCategory($user, ['name' => 'Food']);

        // Deliberately awkward: 1/3 splits do not divide cleanly into percent.
        foreach ([[$rent, 33333], [$food, 33333], [null, 33334]] as [$category, $amount]) {
            $this->makeTransaction($user, [
                'category_id' => $category ? (string) $category->getKey() : null,
                'amount' => $amount,
            ]);
        }

        $breakdown = $this->ledger->categoryBreakdown(
            (string) $user->getKey(),
            (int) now()->year,
            (int) now()->month
        );

        $this->assertSame(100000, array_sum(array_column($breakdown, 'amount')));
        $this->assertEqualsWithDelta(100.0, array_sum(array_column($breakdown, 'share')), 0.3);
    }

    #[Test]
    public function an_entry_without_a_category_is_reported_rather_than_dropped(): void
    {
        $user = $this->makeUser();
        $this->makeTransaction($user, ['category_id' => null, 'amount' => 45000]);

        $breakdown = $this->ledger->categoryBreakdown(
            (string) $user->getKey(),
            (int) now()->year,
            (int) now()->month
        );

        $this->assertCount(1, $breakdown);
        $this->assertNull($breakdown[0]['id']);
        $this->assertSame('Uncategorised', $breakdown[0]['name']);
        $this->assertSame(45000, $breakdown[0]['amount']);
    }

    #[Test]
    public function the_trend_keeps_empty_months_as_zero_columns(): void
    {
        $user = $this->makeUser();
        $anchor = CarbonImmutable::create(2026, 6, 1);

        $this->makeTransaction($user, ['type' => 'income', 'amount' => 700000, 'occurred_on' => $anchor]);

        $trend = $this->ledger->trend((string) $user->getKey(), 6, $anchor);

        $this->assertCount(6, $trend, 'A quiet month must still occupy a column.');
        $this->assertSame('2026-06', $trend[5]['key']);
        $this->assertSame(700000, $trend[5]['income']);
        $this->assertSame(0, $trend[0]['income']);
        $this->assertSame(0, $trend[0]['expense']);
    }

    #[Test]
    public function budget_pressure_flags_a_category_that_is_over(): void
    {
        $user = $this->makeUser();
        $food = $this->makeCategory($user, ['name' => 'Food', 'monthly_budget' => 100000]);
        $rent = $this->makeCategory($user, ['name' => 'Rent', 'monthly_budget' => 500000]);

        $this->makeTransaction($user, ['category_id' => (string) $food->getKey(), 'amount' => 150000]);
        $this->makeTransaction($user, ['category_id' => (string) $rent->getKey(), 'amount' => 250000]);

        $pressure = $this->ledger->budgetPressure(
            (string) $user->getKey(),
            (int) now()->year,
            (int) now()->month
        );

        // Sorted by pressure, worst first.
        $this->assertSame('Food', $pressure[0]['name']);
        $this->assertSame(1.5, $pressure[0]['ratio']);
        $this->assertSame(0.5, $pressure[1]['ratio']);
    }

    #[Test]
    public function categories_without_a_budget_are_left_out_of_budget_pressure(): void
    {
        $user = $this->makeUser();
        $category = $this->makeCategory($user, ['monthly_budget' => 0]);
        $this->makeTransaction($user, ['category_id' => (string) $category->getKey(), 'amount' => 999999]);

        $this->assertSame([], $this->ledger->budgetPressure(
            (string) $user->getKey(),
            (int) now()->year,
            (int) now()->month
        ));
    }
}
