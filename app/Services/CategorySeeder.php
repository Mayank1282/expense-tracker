<?php

namespace App\Services;

use App\Models\Category;
use App\Models\User;

/**
 * Gives a brand-new account something to categorise against immediately.
 */
class CategorySeeder
{
    /** @var list<array{name:string,type:string,color:string}> */
    private const DEFAULTS = [
        ['name' => 'Salary',        'type' => 'income',  'color' => '#BEF264'],
        ['name' => 'Freelance',     'type' => 'income',  'color' => '#14B8A6'],
        ['name' => 'Rent',          'type' => 'expense', 'color' => '#6D28D9'],
        ['name' => 'Groceries',     'type' => 'expense', 'color' => '#F97316'],
        ['name' => 'Eating Out',    'type' => 'expense', 'color' => '#EC4899'],
        ['name' => 'Transport',     'type' => 'expense', 'color' => '#22D3EE'],
        ['name' => 'Utilities',     'type' => 'expense', 'color' => '#FACC15'],
        ['name' => 'Subscriptions', 'type' => 'expense', 'color' => '#A78BFA'],
        ['name' => 'Health',        'type' => 'expense', 'color' => '#EF4444'],
    ];

    public function seedDefaults(User $user): void
    {
        foreach (self::DEFAULTS as $category) {
            Category::create([
                'user_id' => (string) $user->getKey(),
                ...$category,
            ]);
        }
    }
}
