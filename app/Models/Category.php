<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Builder;
use MongoDB\Laravel\Eloquent\Model;
use MongoDB\Laravel\Relations\BelongsTo;
use MongoDB\Laravel\Relations\HasMany;

/**
 * A spending or earning bucket owned by one user.
 *
 * @property string $_id
 * @property string $user_id
 * @property string $name
 * @property string $type  income|expense
 * @property string $color hex swatch shown as a hard-bordered chip
 */
class Category extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'categories';

    protected $fillable = [
        'user_id',
        'name',
        'type',
        'color',
        'monthly_budget',
    ];

    protected function casts(): array
    {
        return [
            // Stored in minor units (paise) so no category budget can drift.
            'monthly_budget' => 'integer',
        ];
    }

    /**
     * The palette offered in the UI. Deliberately flat and high-contrast so
     * every swatch survives a 2px ink border in both themes.
     */
    public const PALETTE = [
        '#BEF264', '#A3E635', '#6D28D9', '#A78BFA', '#EF4444',
        '#F97316', '#FACC15', '#22D3EE', '#EC4899', '#14B8A6',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function scopeOwnedBy(Builder $query, string $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    public function scopeOfType(Builder $query, ?string $type): Builder
    {
        return $type ? $query->where('type', $type) : $query;
    }
}
