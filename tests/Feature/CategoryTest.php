<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Transaction;
use App\Services\LedgerService;
use PHPUnit\Framework\Attributes\Test;
use Tests\LedgerTestCase;

class CategoryTest extends LedgerTestCase
{
    /**
     * A category holding entries cannot be deleted at all.
     *
     * The earlier behaviour detached them into "Uncategorised" — totals were
     * preserved, but the classification was destroyed with no undo. Refusing
     * keeps the intent explicit: reassign or delete the entries first.
     */
    #[Test]
    public function a_category_in_use_cannot_be_deleted(): void
    {
        $user = $this->makeUser();
        $category = $this->makeCategory($user, ['name' => 'Groceries']);

        $this->makeTransaction($user, ['category_id' => (string) $category->getKey(), 'amount' => 30000]);
        $this->makeTransaction($user, ['category_id' => (string) $category->getKey(), 'amount' => 20000]);

        $ledger = app(LedgerService::class);
        $before = $ledger->monthTotals((string) $user->getKey(), (int) now()->year, (int) now()->month);

        $response = $this->actingAs($user)->delete("/categories/{$category->getKey()}");

        $response->assertRedirect();
        $response->assertSessionHas('error');

        $after = $ledger->monthTotals((string) $user->getKey(), (int) now()->year, (int) now()->month);

        $this->assertSame(1, Category::count(), 'The category must survive.');
        $this->assertSame(2, Transaction::count());
        $this->assertSame($before, $after, 'Nothing about the ledger may change.');
        $this->assertSame(
            (string) $category->getKey(),
            (string) Transaction::first()->category_id,
            'Entries stay attached.'
        );
    }

    #[Test]
    public function the_refusal_says_how_many_entries_are_in_the_way(): void
    {
        $user = $this->makeUser();
        $category = $this->makeCategory($user, ['name' => 'Groceries']);
        $this->makeTransaction($user, ['category_id' => (string) $category->getKey()]);

        $this->actingAs($user)->delete("/categories/{$category->getKey()}");

        $this->assertStringContainsString('Groceries', session('error'));
        $this->assertStringContainsString('1 entry', session('error'));
    }

    #[Test]
    public function an_unused_category_deletes_cleanly(): void
    {
        $user = $this->makeUser();
        $category = $this->makeCategory($user);

        $this->actingAs($user)
            ->delete("/categories/{$category->getKey()}")
            ->assertSessionHas('success');

        $this->assertSame(0, Category::count());
    }

    /**
     * Detaching an entry frees the category, so the refusal is a state, not a
     * life sentence.
     */
    #[Test]
    public function a_category_becomes_deletable_once_its_entries_are_gone(): void
    {
        $user = $this->makeUser();
        $category = $this->makeCategory($user);
        $entry = $this->makeTransaction($user, ['category_id' => (string) $category->getKey()]);

        $this->actingAs($user)->delete("/categories/{$category->getKey()}");
        $this->assertSame(1, Category::count());

        $this->actingAs($user)->delete("/transactions/{$entry->getKey()}");

        $this->actingAs($user)
            ->delete("/categories/{$category->getKey()}")
            ->assertSessionHas('success');

        $this->assertSame(0, Category::count());
    }

    #[Test]
    public function a_category_in_use_cannot_change_type(): void
    {
        $user = $this->makeUser();
        $category = $this->makeCategory($user, ['type' => 'expense']);
        $this->makeTransaction($user, ['category_id' => (string) $category->getKey()]);

        $this->actingAs($user)->put("/categories/{$category->getKey()}", [
            'name' => $category->name,
            'type' => 'income',
            'color' => Category::PALETTE[0],
        ])->assertSessionHasErrors('type');

        $this->assertSame('expense', $category->fresh()->type);
    }

    #[Test]
    public function an_unused_category_may_change_type(): void
    {
        $user = $this->makeUser();
        $category = $this->makeCategory($user, ['type' => 'expense']);

        $this->actingAs($user)->put("/categories/{$category->getKey()}", [
            'name' => 'Bonus',
            'type' => 'income',
            'color' => Category::PALETTE[1],
        ])->assertSessionHasNoErrors();

        $this->assertSame('income', $category->fresh()->type);
    }

    #[Test]
    public function duplicate_names_within_the_same_type_are_rejected_case_insensitively(): void
    {
        $user = $this->makeUser();
        $this->makeCategory($user, ['name' => 'Groceries', 'type' => 'expense']);

        $this->actingAs($user)->post('/categories', [
            'name' => 'groceries',
            'type' => 'expense',
            'color' => Category::PALETTE[0],
        ])->assertSessionHasErrors('name');

        $this->assertSame(1, Category::count());
    }

    #[Test]
    public function the_same_name_is_allowed_across_different_types(): void
    {
        $user = $this->makeUser();
        $this->makeCategory($user, ['name' => 'Interest', 'type' => 'expense']);

        $this->actingAs($user)->post('/categories', [
            'name' => 'Interest',
            'type' => 'income',
            'color' => Category::PALETTE[0],
        ])->assertSessionHasNoErrors();

        $this->assertSame(2, Category::count());
    }

    #[Test]
    public function a_budget_is_stored_in_minor_units_and_only_on_expense_categories(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->post('/categories', [
            'name' => 'Food',
            'type' => 'expense',
            'color' => Category::PALETTE[0],
            'monthly_budget' => '1200.50',
        ]);

        $this->actingAs($user)->post('/categories', [
            'name' => 'Salary',
            'type' => 'income',
            'color' => Category::PALETTE[0],
            'monthly_budget' => '9999',
        ]);

        $this->assertSame(120050, Category::where('name', 'Food')->first()->monthly_budget);
        $this->assertSame(0, Category::where('name', 'Salary')->first()->monthly_budget);
    }

    #[Test]
    public function a_colour_outside_the_palette_is_rejected(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->post('/categories', [
            'name' => 'Rogue',
            'type' => 'expense',
            'color' => '#123456',
        ])->assertSessionHasErrors('color');
    }

    #[Test]
    public function one_user_cannot_touch_another_users_category(): void
    {
        $owner = $this->makeUser();
        $stranger = $this->makeUser();
        $category = $this->makeCategory($owner);

        $this->actingAs($stranger)
            ->delete("/categories/{$category->getKey()}")
            ->assertNotFound();

        $this->assertSame(1, Category::count());
    }
}
