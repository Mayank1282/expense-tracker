<?php

namespace Tests;

use App\Models\Category;
use App\Models\PasswordReset;
use App\Models\Transaction;
use App\Models\User;

/**
 * Base class for tests that touch the database.
 *
 * `RefreshDatabase` is built around SQL transactions and migrations, neither of
 * which applies to a document store used this way. Truncating the four
 * collections is both faster and honest about what is actually happening.
 */
abstract class LedgerTestCase extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->wipe();
    }

    protected function tearDown(): void
    {
        $this->wipe();

        parent::tearDown();
    }

    private function wipe(): void
    {
        Transaction::truncate();
        Category::truncate();
        PasswordReset::truncate();
        User::truncate();
    }

    protected function makeUser(array $attributes = []): User
    {
        return User::create([
            'name' => 'Test User',
            'email' => 'user'.uniqid().'@example.test',
            'password' => 'password',
            'currency' => 'INR',
            ...$attributes,
        ]);
    }

    protected function makeCategory(User $user, array $attributes = []): Category
    {
        return Category::create([
            'user_id' => (string) $user->getKey(),
            'name' => 'Groceries',
            'type' => 'expense',
            'color' => Category::PALETTE[0],
            'monthly_budget' => 0,
            ...$attributes,
        ]);
    }

    protected function makeTransaction(User $user, array $attributes = []): Transaction
    {
        return Transaction::create([
            'user_id' => (string) $user->getKey(),
            'category_id' => null,
            'type' => 'expense',
            'amount' => 10000,
            'occurred_on' => now()->startOfDay(),
            'note' => null,
            ...$attributes,
        ]);
    }
}
