<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use App\Services\CategorySeeder;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Eight months of plausible activity for the demo account.
 *
 * The numbers are generated rather than fixed so the dashboard has real
 * variance to chart — but the shape is deliberate: rent is constant, groceries
 * drift, eating out spikes at weekends, and one month runs at a loss so the
 * negative-balance and over-budget states are actually visible in a demo
 * instead of being states nobody ever sees.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $email = 'demo@yopmail.com';

        // Re-runnable: wipe the demo user's data rather than stacking a second
        // eight months on top every time the seeder is called.
        $existing = User::where('email', $email)->first();

        if ($existing) {
            Transaction::where('user_id', (string) $existing->getKey())->delete();
            Category::where('user_id', (string) $existing->getKey())->delete();
            $existing->delete();
        }

        $user = User::create([
            'name' => 'Demo User',
            'email' => $email,
            'password' => 'password',
            'currency' => 'INR',
        ]);

        app(CategorySeeder::class)->seedDefaults($user);

        $userId = (string) $user->getKey();
        $categories = Category::ownedBy($userId)->get()->keyBy('name');

        // Budgets, so the dashboard's budget block has something to render.
        $this->setBudget($categories, 'Groceries', 1200000);
        $this->setBudget($categories, 'Eating Out', 600000);
        $this->setBudget($categories, 'Transport', 400000);
        $this->setBudget($categories, 'Subscriptions', 150000);

        $rows = [];
        $start = CarbonImmutable::now()->startOfMonth()->subMonths(7);

        for ($m = 0; $m < 8; $m++) {
            $month = $start->addMonths($m);
            $lean = $m === 5; // one deliberately bad month

            $rows[] = $this->entry($userId, $categories, 'Salary', 'income', 9500000, $month->addDays(0));

            if ($m % 3 === 1) {
                $rows[] = $this->entry($userId, $categories, 'Freelance', 'income', random_int(1500000, 4000000), $month->addDays(17));
            }

            $rows[] = $this->entry($userId, $categories, 'Rent', 'expense', 2800000, $month->addDays(1), 'Monthly rent');
            $rows[] = $this->entry($userId, $categories, 'Utilities', 'expense', random_int(180000, 320000), $month->addDays(4));
            $rows[] = $this->entry($userId, $categories, 'Subscriptions', 'expense', 129900, $month->addDays(6), 'Streaming + music');

            // Weekly groceries.
            foreach ([3, 10, 17, 24] as $day) {
                $rows[] = $this->entry(
                    $userId, $categories, 'Groceries', 'expense',
                    random_int(220000, 380000) * ($lean ? 1.3 : 1),
                    $month->addDays($day)
                );
            }

            // Eating out, heavier at weekends.
            for ($i = 0; $i < random_int(4, 9); $i++) {
                $rows[] = $this->entry(
                    $userId, $categories, 'Eating Out', 'expense',
                    random_int(45000, 220000) * ($lean ? 1.6 : 1),
                    $month->addDays(random_int(0, 27))
                );
            }

            for ($i = 0; $i < random_int(3, 7); $i++) {
                $rows[] = $this->entry(
                    $userId, $categories, 'Transport', 'expense',
                    random_int(15000, 90000),
                    $month->addDays(random_int(0, 27))
                );
            }

            if ($m % 2 === 0) {
                $rows[] = $this->entry($userId, $categories, 'Health', 'expense', random_int(80000, 450000), $month->addDays(random_int(5, 25)));
            }

            if ($lean) {
                $rows[] = $this->entry($userId, $categories, null, 'expense', 3200000, $month->addDays(12), 'Laptop replacement — uncategorised on purpose');
            }
        }

        // One insert per chunk rather than one per row.
        foreach (array_chunk($rows, 200) as $chunk) {
            Transaction::insert($chunk);
        }

        $this->command?->info(sprintf('Seeded %d entries for %s (password: password)', count($rows), $email));
    }

    private function setBudget($categories, string $name, int $minor): void
    {
        $categories->get($name)?->update(['monthly_budget' => $minor]);
    }

    private function entry(
        string $userId,
        $categories,
        ?string $categoryName,
        string $type,
        float|int $amount,
        CarbonImmutable $date,
        ?string $note = null
    ): array {
        return [
            'user_id' => $userId,
            'category_id' => $categoryName ? (string) $categories->get($categoryName)?->getKey() : null,
            'type' => $type,
            'amount' => (int) round($amount),
            // Insert bypasses the model's casts, so the date is converted here.
            'occurred_on' => new \MongoDB\BSON\UTCDateTime($date->startOfDay()),
            'note' => $note,
            'created_at' => new \MongoDB\BSON\UTCDateTime(CarbonImmutable::now()),
            'updated_at' => new \MongoDB\BSON\UTCDateTime(CarbonImmutable::now()),
        ];
    }
}
