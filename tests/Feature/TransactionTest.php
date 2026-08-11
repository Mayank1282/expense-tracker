<?php

namespace Tests\Feature;

use App\Models\Transaction;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\Attributes\Test;
use Tests\LedgerTestCase;

class TransactionTest extends LedgerTestCase
{
    #[Test]
    public function an_amount_is_stored_as_integer_minor_units(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->post('/transactions', [
            'type' => 'expense',
            'amount' => '1250.50',
            'occurred_on' => '2026-05-04',
        ])->assertRedirect();

        $entry = Transaction::first();

        $this->assertSame(125050, $entry->amount);
        $this->assertIsInt($entry->amount);
    }

    #[Test]
    public function direction_is_carried_by_type_not_by_a_negative_amount(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->post('/transactions', [
            'type' => 'expense',
            'amount' => '99.99',
            'occurred_on' => now()->toDateString(),
        ]);

        $entry = Transaction::first();

        $this->assertSame(9999, $entry->amount, 'The stored amount is always positive.');
        $this->assertSame(-9999, $entry->signedAmount());
    }

    #[Test]
    public function it_rejects_an_amount_of_zero_or_less(): void
    {
        $user = $this->makeUser();

        foreach (['0', '-1', '-0.01'] as $amount) {
            $this->actingAs($user)->post('/transactions', [
                'type' => 'expense',
                'amount' => $amount,
                'occurred_on' => now()->toDateString(),
            ])->assertSessionHasErrors('amount');
        }

        $this->assertSame(0, Transaction::count());
    }

    #[Test]
    public function it_rejects_a_genuinely_future_date(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->post('/transactions', [
            'type' => 'expense',
            'amount' => '10',
            'occurred_on' => now()->addDays(3)->toDateString(),
        ])->assertSessionHasErrors('occurred_on');

        $this->assertSame(0, Transaction::count());
    }

    /**
     * The server runs in UTC; the date picker sends the browser's local
     * calendar date. At 03:31 IST the browser says the 10th while the server
     * still says the 9th, so a strict `before_or_equal:today` rejected a user's
     * actual today as "the future" — every night, for everyone east of UTC.
     */
    #[Test]
    public function todays_date_is_accepted_from_a_timezone_ahead_of_the_server(): void
    {
        $user = $this->makeUser();

        // Fix the server clock late in the UTC day, so the next calendar date
        // is already "today" across Asia.
        $this->travelTo(CarbonImmutable::create(2026, 8, 9, 22, 1, 0, 'UTC'));

        $this->actingAs($user)->post('/transactions', [
            'type' => 'expense',
            'amount' => '250',
            // 03:31 IST on the 10th — the same instant.
            'occurred_on' => '2026-08-10',
        ])->assertSessionHasNoErrors();

        $this->assertSame(1, Transaction::count());

        $this->travelBack();
    }

    /**
     * Filing income under an expense category would silently corrupt every
     * breakdown on the dashboard, so the mismatch is rejected outright rather
     * than merely hidden in the UI's category dropdown.
     */
    #[Test]
    public function it_rejects_a_category_whose_type_does_not_match(): void
    {
        $user = $this->makeUser();
        $expenseCategory = $this->makeCategory($user, ['type' => 'expense']);

        $this->actingAs($user)->post('/transactions', [
            'type' => 'income',
            'amount' => '500',
            'occurred_on' => now()->toDateString(),
            'category_id' => (string) $expenseCategory->getKey(),
        ])->assertSessionHasErrors('category_id');

        $this->assertSame(0, Transaction::count());
    }

    #[Test]
    public function a_category_belonging_to_another_user_is_rejected(): void
    {
        $mine = $this->makeUser();
        $theirs = $this->makeUser();
        $theirCategory = $this->makeCategory($theirs);

        $this->actingAs($mine)->post('/transactions', [
            'type' => 'expense',
            'amount' => '500',
            'occurred_on' => now()->toDateString(),
            'category_id' => (string) $theirCategory->getKey(),
        ])->assertSessionHasErrors('category_id');
    }

    #[Test]
    public function one_user_cannot_edit_or_delete_another_users_entry(): void
    {
        $owner = $this->makeUser();
        $stranger = $this->makeUser();
        $entry = $this->makeTransaction($owner, ['amount' => 12345]);

        $this->actingAs($stranger)
            ->put("/transactions/{$entry->getKey()}", [
                'type' => 'expense',
                'amount' => '1',
                'occurred_on' => now()->toDateString(),
            ])
            ->assertNotFound();

        $this->actingAs($stranger)
            ->delete("/transactions/{$entry->getKey()}")
            ->assertNotFound();

        $this->assertSame(12345, $entry->fresh()->amount);
    }

    #[Test]
    public function a_guest_cannot_reach_the_ledger(): void
    {
        $this->get('/transactions')->assertRedirect('/login');
        $this->post('/transactions', [])->assertRedirect('/login');
    }

    #[Test]
    public function the_index_totals_describe_the_filter_not_the_page(): void
    {
        $user = $this->makeUser();

        // 25 entries — more than one page of 20 — so a page-scoped total would
        // visibly disagree with the filtered total.
        for ($i = 0; $i < 25; $i++) {
            $this->makeTransaction($user, ['type' => 'expense', 'amount' => 1000]);
        }

        $response = $this->actingAs($user)->get('/transactions?type=expense');

        $response->assertInertia(fn ($page) => $page
            ->where('filteredTotals.expense', 25000)
            ->where('filteredTotals.count', 25)
            // Default page size is 10, so the totals describing 25 while the
            // page holds 10 is exactly the disagreement being guarded against.
            ->has('transactions.data', 10)
        );
    }

    /**
     * `gt:0` is not the same as `min:0.01`. A sub-paisa amount passes the first
     * and then rounds to zero on the way into storage, leaving a 0.00 line that
     * counts as an entry but moves no money.
     */
    #[Test]
    public function it_rejects_an_amount_that_would_round_down_to_zero(): void
    {
        $user = $this->makeUser();

        foreach (['0.001', '0.004', '0.0001'] as $amount) {
            $this->actingAs($user)->post('/transactions', [
                'type' => 'expense',
                'amount' => $amount,
                'occurred_on' => now()->toDateString(),
            ])->assertSessionHasErrors('amount');
        }

        $this->assertSame(0, Transaction::count());
    }

    #[Test]
    public function the_smallest_recordable_amount_is_accepted(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->post('/transactions', [
            'type' => 'expense',
            'amount' => '0.01',
            'occurred_on' => now()->toDateString(),
        ])->assertSessionHasNoErrors();

        $this->assertSame(1, Transaction::first()->amount);
    }

    /* ------------------------------------------------------------------ */
    /* Bulk delete                                                        */
    /* ------------------------------------------------------------------ */

    #[Test]
    public function several_entries_can_be_deleted_at_once(): void
    {
        $user = $this->makeUser();
        $entries = collect(range(1, 5))->map(fn () => $this->makeTransaction($user));
        $doomed = $entries->take(3)->map(fn ($t) => (string) $t->getKey())->all();

        $this->actingAs($user)
            ->delete('/transactions', ['ids' => $doomed])
            ->assertRedirect();

        $this->assertSame(2, Transaction::count());
    }

    /**
     * The ids come from the browser, so they are re-scoped to the signed-in
     * user rather than trusted. Slipping someone else's id into the array must
     * delete nothing of theirs.
     */
    #[Test]
    public function a_bulk_delete_cannot_reach_another_users_entries(): void
    {
        $mine = $this->makeUser();
        $theirs = $this->makeUser();

        $myEntry = $this->makeTransaction($mine);
        $theirEntry = $this->makeTransaction($theirs);

        $this->actingAs($mine)->delete('/transactions', [
            'ids' => [(string) $myEntry->getKey(), (string) $theirEntry->getKey()],
        ]);

        $this->assertSame(0, Transaction::ownedBy((string) $mine->getKey())->count());
        $this->assertSame(1, Transaction::ownedBy((string) $theirs->getKey())->count(), 'Their entry must survive.');
    }

    #[Test]
    public function a_bulk_delete_records_one_audit_block_per_entry(): void
    {
        $user = $this->makeUser();
        $entries = collect(range(1, 3))->map(fn () => $this->makeTransaction($user, ['amount' => 5000]));

        \App\Models\Block::truncate();

        $this->actingAs($user)->delete('/transactions', [
            'ids' => $entries->map(fn ($t) => (string) $t->getKey())->all(),
        ]);

        // Genesis + one per deleted entry: a single "deleted 3 things" block
        // would lose what each row actually held.
        $deletions = \App\Models\Block::where('event', 'transaction.deleted')->get();

        $this->assertCount(3, $deletions);
        $this->assertTrue(app(\App\Services\LedgerChain::class)->verify((string) $user->getKey())['valid']);

        \App\Models\Block::truncate();
    }

    #[Test]
    public function a_bulk_delete_needs_at_least_one_id(): void
    {
        $user = $this->makeUser();
        $this->makeTransaction($user);

        $this->actingAs($user)->delete('/transactions', ['ids' => []])
            ->assertSessionHasErrors('ids');

        $this->assertSame(1, Transaction::count());
    }

    #[Test]
    public function a_guest_cannot_bulk_delete(): void
    {
        $this->delete('/transactions', ['ids' => ['anything']])->assertRedirect('/login');
    }
}
