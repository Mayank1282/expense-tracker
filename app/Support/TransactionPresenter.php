<?php

namespace App\Support;

use App\Models\Transaction;
use Illuminate\Support\Collection;

/**
 * Shapes a Transaction document into the props the React layer expects.
 *
 * Amounts cross the wire as integer minor units and are formatted in the
 * browser. Sending a pre-formatted string instead would make the client unable
 * to re-total anything without re-parsing currency text.
 */
final class TransactionPresenter
{
    /**
     * @param  Collection<int, mixed>|null  $categories  keyed by id
     */
    public static function one(Transaction $transaction, ?Collection $categories = null): array
    {
        $category = $categories
            ? $categories->get((string) $transaction->category_id)
            : $transaction->category;

        return [
            'id' => (string) $transaction->getKey(),
            'type' => $transaction->type,
            'amount' => (int) $transaction->amount,
            'occurred_on' => $transaction->occurred_on?->format('Y-m-d'),
            'note' => $transaction->note,
            'category' => $category ? [
                'id' => (string) $category->getKey(),
                'name' => $category->name,
                'color' => $category->color,
            ] : null,
        ];
    }

    /**
     * @param  Collection<int, Transaction>  $transactions
     * @param  Collection<int, mixed>|null  $categories
     * @return list<array<string, mixed>>
     */
    public static function collection(Collection $transactions, ?Collection $categories = null): array
    {
        return $transactions
            ->map(fn (Transaction $t) => self::one($t, $categories))
            ->values()
            ->all();
    }
}
