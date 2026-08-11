<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use MongoDB\Laravel\Eloquent\Builder;
use MongoDB\Laravel\Eloquent\Model;

/**
 * One block in the ledger's audit chain.
 *
 * The transactions collection stays editable — this is a personal finance app,
 * people fix typos. The chain is a SEPARATE append-only record of every change
 * that has ever been made, with each block committing to the one before it.
 *
 * That is the honest shape for this problem. Hashing the transactions
 * themselves would mean an edit either breaks the chain or silently rewrites
 * history; keeping the chain alongside means the ledger stays usable and the
 * audit trail stays tamper-evident.
 *
 * @property int $index        position in this user's chain, 0 = genesis
 * @property string $user_id
 * @property string $event     genesis | transaction.created | .updated | .deleted
 * @property array $payload    snapshot of what changed
 * @property string $payload_hash
 * @property string $previous_hash
 * @property string $hash
 */
class Block extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'blocks';

    public $timestamps = false;

    protected $fillable = [
        'index',
        'user_id',
        'event',
        'payload',
        'payload_hash',
        'previous_hash',
        'hash',
        'created_at',
    ];

    /** The previous_hash of the genesis block. */
    public const GENESIS_PREVIOUS = '0000000000000000000000000000000000000000000000000000000000000000';

    protected function casts(): array
    {
        return [
            'index' => 'integer',
            'payload' => 'array',
            'created_at' => 'immutable_datetime',
        ];
    }

    public function scopeOwnedBy(Builder $query, string $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Recompute this block's own hash from its contents.
     *
     * Field order is fixed and the payload is hashed separately, so the digest
     * cannot be changed by reordering keys — two blocks with the same meaning
     * always produce the same hash.
     */
    public function computeHash(): string
    {
        return hash('sha256', implode('|', [
            $this->index,
            $this->user_id,
            $this->event,
            $this->payload_hash,
            $this->previous_hash,
            $this->created_at instanceof CarbonImmutable
                ? $this->created_at->toIso8601String()
                : (string) $this->created_at,
        ]));
    }

    /** Short form for display — a full sha256 is unreadable in a table. */
    public function shortHash(): string
    {
        return substr($this->hash, 0, 12);
    }
}
