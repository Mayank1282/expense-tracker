<?php

namespace Tests\Feature;

use Carbon\CarbonImmutable;
use PHPUnit\Framework\Attributes\Test;
use Tests\LedgerTestCase;

/**
 * Query-string handling. Every value on these pages comes from the URL, so
 * hand-typed and malformed input has to land somewhere sensible instead of
 * throwing — a portfolio app gets its URL bar poked at.
 */
class FilterAndReportTest extends LedgerTestCase
{
    #[Test]
    public function a_nonsense_month_or_year_is_clamped_rather_than_fatal(): void
    {
        $user = $this->makeUser();

        foreach (['?month=99', '?month=0', '?year=abc', '?year=0&month=3', '?month=-4&year=99999'] as $query) {
            $this->actingAs($user)->get("/dashboard{$query}")->assertOk();
            $this->actingAs($user)->get("/reports/monthly{$query}")->assertOk();
            $this->actingAs($user)->get("/transactions{$query}")->assertOk();
        }
    }

    #[Test]
    public function a_note_search_containing_regex_characters_does_not_break_the_query(): void
    {
        $user = $this->makeUser();
        $this->makeTransaction($user, ['note' => 'coffee (large) [oat] .50']);

        foreach (['(', '[oat]', '.50', '.*', 'coffee (large)'] as $term) {
            $response = $this->actingAs($user)->get('/transactions?search='.urlencode($term));

            $response->assertOk();
        }

        // A literal search must not behave as a wildcard.
        $this->actingAs($user)
            ->get('/transactions?search='.urlencode('.*'))
            ->assertInertia(fn ($page) => $page->where('filteredTotals.count', 0));
    }

    #[Test]
    public function an_unknown_filter_type_is_ignored_rather_than_applied(): void
    {
        $user = $this->makeUser();
        $this->makeTransaction($user, ['type' => 'expense']);
        $this->makeTransaction($user, ['type' => 'income']);

        $this->actingAs($user)
            ->get('/transactions?type=banana')
            ->assertInertia(fn ($page) => $page->where('filteredTotals.count', 2));
    }

    #[Test]
    public function a_date_range_includes_both_of_its_bounds(): void
    {
        $user = $this->makeUser();

        foreach (['2026-03-09', '2026-03-10', '2026-03-15', '2026-03-20', '2026-03-21'] as $date) {
            $this->makeTransaction($user, ['occurred_on' => CarbonImmutable::parse($date)]);
        }

        // Picking the 10th and the 20th must include entries ON those days —
        // an exclusive upper bound would silently drop the last one.
        $this->actingAs($user)
            ->get('/transactions?from=2026-03-10&to=2026-03-20')
            ->assertInertia(fn ($page) => $page->where('filteredTotals.count', 3));
    }

    #[Test]
    public function an_open_ended_range_filters_from_one_side_only(): void
    {
        $user = $this->makeUser();

        foreach (['2026-03-01', '2026-03-15', '2026-03-30'] as $date) {
            $this->makeTransaction($user, ['occurred_on' => CarbonImmutable::parse($date)]);
        }

        $this->actingAs($user)
            ->get('/transactions?from=2026-03-15')
            ->assertInertia(fn ($page) => $page->where('filteredTotals.count', 2));

        $this->actingAs($user)
            ->get('/transactions?to=2026-03-15')
            ->assertInertia(fn ($page) => $page->where('filteredTotals.count', 2));
    }

    #[Test]
    public function an_unparseable_date_widens_the_view_rather_than_erroring(): void
    {
        $user = $this->makeUser();
        $this->makeTransaction($user);

        foreach (['from=yesterday', 'to=31-12-2026', 'from=2026-13-45', 'to='] as $query) {
            $this->actingAs($user)
                ->get("/transactions?{$query}")
                ->assertOk()
                ->assertInertia(fn ($page) => $page->where('filteredTotals.count', 1));
        }
    }

    #[Test]
    public function the_page_size_is_ten_by_default_and_respects_the_selector(): void
    {
        $user = $this->makeUser();

        for ($i = 0; $i < 25; $i++) {
            $this->makeTransaction($user);
        }

        $this->actingAs($user)->get('/transactions')
            ->assertInertia(fn ($page) => $page->has('transactions.data', 10)->where('filters.per_page', 10));

        $this->actingAs($user)->get('/transactions?per_page=20')
            ->assertInertia(fn ($page) => $page->has('transactions.data', 20));

        // An unsupported size falls back rather than being honoured.
        $this->actingAs($user)->get('/transactions?per_page=9999')
            ->assertInertia(fn ($page) => $page->has('transactions.data', 10));

        $this->actingAs($user)->get('/transactions?per_page=all')
            ->assertInertia(fn ($page) => $page->has('transactions.data', 25)->where('filters.per_page', 'all'));
    }

    #[Test]
    public function the_csv_export_covers_the_month_asked_for(): void
    {
        $user = $this->makeUser();
        $category = $this->makeCategory($user, ['name' => 'Groceries']);

        $this->makeTransaction($user, [
            'amount' => 125050,
            'occurred_on' => CarbonImmutable::create(2026, 4, 15),
            'category_id' => (string) $category->getKey(),
            'note' => 'Weekly shop',
        ]);
        $this->makeTransaction($user, [
            'amount' => 999999,
            'occurred_on' => CarbonImmutable::create(2026, 5, 1),
        ]);

        $csv = $this->actingAs($user)
            ->get('/reports/export?year=2026&month=4')
            ->streamedContent();

        $this->assertStringContainsString('2026-04-15,expense,Groceries,1250.50', $csv);
        $this->assertStringNotContainsString('9999.99', $csv, 'May must not appear in an April export.');
    }

    #[Test]
    public function a_csv_field_starting_with_a_formula_character_is_not_left_executable(): void
    {
        $user = $this->makeUser();
        $this->makeTransaction($user, ['note' => '=1+1']);

        $csv = $this->actingAs($user)
            ->get('/reports/export?year='.now()->year.'&month='.now()->month)
            ->streamedContent();

        $this->assertStringNotContainsString(',=1+1', $csv, 'A note must not open as a spreadsheet formula.');
    }

    #[Test]
    public function the_export_only_ever_contains_the_signed_in_users_entries(): void
    {
        $mine = $this->makeUser();
        $theirs = $this->makeUser();

        $this->makeTransaction($mine, ['note' => 'mine-only']);
        $this->makeTransaction($theirs, ['note' => 'theirs-only']);

        $csv = $this->actingAs($mine)
            ->get('/reports/export?year='.now()->year.'&month='.now()->month)
            ->streamedContent();

        $this->assertStringContainsString('mine-only', $csv);
        $this->assertStringNotContainsString('theirs-only', $csv);
    }
}
