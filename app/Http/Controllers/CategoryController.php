<?php

namespace App\Http\Controllers;

use App\Http\Requests\CategoryRequest;
use App\Models\Category;
use App\Models\Transaction;
use App\Services\LedgerService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    public function __construct(private readonly LedgerService $ledger)
    {
    }

    public function index(Request $request): Response
    {
        $userId = (string) $request->user()->getKey();
        $now = CarbonImmutable::now();

        $categories = Category::ownedBy($userId)->orderBy('type')->orderBy('name')->get();

        // One grouped pass instead of a count query per category.
        $usage = Transaction::ownedBy($userId)
            ->get(['category_id'])
            ->countBy(fn ($t) => (string) $t->category_id);

        $spendThisMonth = collect($this->ledger->categoryBreakdown($userId, (int) $now->year, (int) $now->month))
            ->keyBy('id');

        return Inertia::render('Categories/Index', [
            'categories' => $categories->map(fn (Category $c) => [
                'id' => (string) $c->getKey(),
                'name' => $c->name,
                'type' => $c->type,
                'color' => $c->color,
                'monthly_budget' => (int) $c->monthly_budget,
                'transaction_count' => (int) ($usage[(string) $c->getKey()] ?? 0),
                'spent_this_month' => (int) ($spendThisMonth[(string) $c->getKey()]['amount'] ?? 0),
            ])->values()->all(),
            'palette' => Category::PALETTE,
            'monthLabel' => $now->format('F Y'),
        ]);
    }

    public function store(CategoryRequest $request): RedirectResponse
    {
        $attributes = $request->toAttributes();

        if ($this->nameTaken($attributes['user_id'], $attributes['name'], $attributes['type'])) {
            return back()->withErrors(['name' => 'You already have a category with that name.']);
        }

        Category::create($attributes);

        return back()->with('success', 'Category added.');
    }

    public function update(CategoryRequest $request, string $category): RedirectResponse
    {
        $model = $this->findOwned($request, $category);
        $attributes = $request->toAttributes();

        if ($this->nameTaken($attributes['user_id'], $attributes['name'], $attributes['type'], $category)) {
            return back()->withErrors(['name' => 'You already have a category with that name.']);
        }

        // Flipping an expense category to income would orphan the direction of
        // every entry already filed under it, so the type is locked once used.
        if ($model->type !== $attributes['type'] && $this->isInUse($model)) {
            return back()->withErrors([
                'type' => 'This category already has entries, so its type cannot change.',
            ]);
        }

        $model->update($attributes);

        return back()->with('success', 'Category updated.');
    }

    public function destroy(Request $request, string $category): RedirectResponse
    {
        $model = $this->findOwned($request, $category);

        $inUse = Transaction::ownedBy((string) $request->user()->getKey())
            ->where('category_id', (string) $model->getKey())
            ->count();

        /*
         * A category that is in use cannot be deleted.
         *
         * The earlier behaviour detached its entries into "Uncategorised",
         * which preserved every total but quietly destroyed the classification
         * — and there was no undo. Refusing is the safer default: reassign or
         * delete the entries first, and the intent stays explicit.
         */
        if ($inUse > 0) {
            return back()->with(
                'error',
                sprintf(
                    '"%s" is used by %d %s. Reassign or delete %s first.',
                    $model->name,
                    $inUse,
                    $inUse === 1 ? 'entry' : 'entries',
                    $inUse === 1 ? 'it' : 'them',
                )
            );
        }

        $model->delete();

        return back()->with('success', 'Category deleted.');
    }

    private function isInUse(Category $category): bool
    {
        return Transaction::where('category_id', (string) $category->getKey())->exists();
    }

    private function nameTaken(string $userId, string $name, string $type, ?string $exceptId = null): bool
    {
        $query = Category::ownedBy($userId)
            ->where('type', $type)
            ->whereRaw(['name' => ['$regex' => '^'.preg_quote($name, '/').'$', '$options' => 'i']]);

        if ($exceptId) {
            $query->where('_id', '!=', $exceptId);
        }

        return $query->exists();
    }

    private function findOwned(Request $request, string $id): Category
    {
        return Category::ownedBy((string) $request->user()->getKey())
            ->where('_id', $id)
            ->firstOrFail();
    }
}
