<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use MongoDB\Laravel\Eloquent\Builder;
use MongoDB\Laravel\Eloquent\Model;
use MongoDB\Laravel\Relations\BelongsTo;

/**
 * One line in the ledger.
 *
 * `amount` is always a POSITIVE integer in minor units (paise). Direction is
 * carried by `type`, never by the sign of the amount — mixing the two is how
 * a ledger ends up with -₹0.00 rows that sum incorrectly. Project 3's pricing
 * bugs all traced back to money in floats; this project never stores a float.
 *
 * @property string $_id
 * @property string $user_id
 * @property string|null $category_id
 * @property string $type income|expense
 * @property int $amount minor units, always positive
 * @property CarbonImmutable $occurred_on
 * @property string|null $note
 */
class Transaction extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'transactions';

    protected $fillable = [
        'user_id',
        'category_id',
        'type',
        'amount',
        'occurred_on',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'occurred_on' => 'immutable_date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function scopeOwnedBy(Builder $query, string $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Restrict to a calendar month. Bounds are computed in PHP and compared as
     * dates so the query stays a plain indexed range scan rather than relying
     * on any server-side date expression.
     */
    public function scopeInMonth(Builder $query, int $year, int $month): Builder
    {
        $start = CarbonImmutable::create($year, $month, 1)->startOfDay();

        return $query
            ->where('occurred_on', '>=', $start)
            ->where('occurred_on', '<', $start->addMonth());
    }

    public function scopeOfType(Builder $query, ?string $type): Builder
    {
        return $type ? $query->where('type', $type) : $query;
    }

    /** Signed value in minor units — income positive, expense negative. */
    public function signedAmount(): int
    {
        return $this->type === 'income' ? $this->amount : -$this->amount;
    }
}
