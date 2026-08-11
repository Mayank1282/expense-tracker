<?php

namespace App\Services;

use App\Models\Block;
use App\Models\Transaction;
use Carbon\CarbonImmutable;

/**
 * The ledger's tamper-evident audit chain.
 *
 * This is a blockchain in the sense that matters here — an append-only chain of
 * blocks, each committing to the hash of the one before it, so that altering or
 * removing any past record invalidates every block after it. What it is not is
 * a distributed one: there is no network, no consensus, no wallet, no gas, and
 * nothing about a single user's grocery spending belongs on a public ledger.
 *
 * That is a deliberate stopping point, not an unfinished one. The structure
 * here is exactly what you would anchor on-chain later: publish
 * `headHash($userId)` (or a Merkle root over a day's blocks) to a testnet and
 * every block underneath it inherits that guarantee, without a single private
 * amount leaving the database.
 */
class LedgerChain
{
    /**
     * Append a block recording something that happened to the ledger.
     */
    public function append(string $userId, string $event, array $payload): Block
    {
        $head = $this->head($userId);

        // The very first write for a user seeds a genesis block, so every chain
        // has a fixed, verifiable starting point rather than beginning midway.
        if (! $head) {
            $head = $this->createBlock($userId, 0, 'genesis', [
                'message' => 'Ledger opened',
            ], Block::GENESIS_PREVIOUS);
        }

        return $this->createBlock(
            $userId,
            $head->index + 1,
            $event,
            $payload,
            $head->hash
        );
    }

    /** Convenience: record a transaction event from the model itself. */
    public function recordTransaction(string $event, Transaction $transaction): Block
    {
        return $this->append((string) $transaction->user_id, $event, [
            'transaction_id' => (string) $transaction->getKey(),
            'type' => $transaction->type,
            'amount' => (int) $transaction->amount,
            'occurred_on' => $transaction->occurred_on?->format('Y-m-d'),
            'category_id' => $transaction->category_id ? (string) $transaction->category_id : null,
            'note' => $transaction->note,
        ]);
    }

    /**
     * Walk the chain and check that it still holds.
     *
     * Three separate things can be wrong, and they are reported separately
     * because they mean different things:
     *   - a block's own hash no longer matches its contents  → it was edited
     *   - a block's previous_hash does not match the block before → one was
     *     removed or reordered
     *   - the payload no longer hashes to payload_hash → the data was swapped
     *
     * @return array{valid:bool, length:int, brokenAt:int|null, reason:string|null, head:string|null}
     */
    public function verify(string $userId): array
    {
        $blocks = Block::ownedBy($userId)->orderBy('index')->get();

        if ($blocks->isEmpty()) {
            return ['valid' => true, 'length' => 0, 'brokenAt' => null, 'reason' => null, 'head' => null];
        }

        $previousHash = Block::GENESIS_PREVIOUS;
        $expectedIndex = 0;

        foreach ($blocks as $block) {
            if ((int) $block->index !== $expectedIndex) {
                return $this->broken($blocks, (int) $block->index, 'A block is missing from the chain.');
            }

            if ($block->previous_hash !== $previousHash) {
                return $this->broken($blocks, (int) $block->index, 'This block does not follow the one before it.');
            }

            if ($this->hashPayload($block->payload ?? []) !== $block->payload_hash) {
                return $this->broken($blocks, (int) $block->index, 'The recorded data was altered after the fact.');
            }

            if ($block->computeHash() !== $block->hash) {
                return $this->broken($blocks, (int) $block->index, 'This block was tampered with.');
            }

            $previousHash = $block->hash;
            $expectedIndex++;
        }

        return [
            'valid' => true,
            'length' => $blocks->count(),
            'brokenAt' => null,
            'reason' => null,
            'head' => $blocks->last()->hash,
        ];
    }

    public function head(string $userId): ?Block
    {
        return Block::ownedBy($userId)->orderBy('index', 'desc')->first();
    }

    public function headHash(string $userId): ?string
    {
        return $this->head($userId)?->hash;
    }

    /**
     * Canonical hash of a payload.
     *
     * Keys are sorted before encoding so that two payloads meaning the same
     * thing hash the same regardless of the order PHP happened to build them.
     */
    public function hashPayload(array $payload): string
    {
        ksort($payload);

        return hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    private function createBlock(
        string $userId,
        int $index,
        string $event,
        array $payload,
        string $previousHash
    ): Block {
        $block = new Block([
            'index' => $index,
            'user_id' => $userId,
            'event' => $event,
            'payload' => $payload,
            'payload_hash' => $this->hashPayload($payload),
            'previous_hash' => $previousHash,
            'created_at' => CarbonImmutable::now(),
        ]);

        $block->hash = $block->computeHash();
        $block->save();

        return $block;
    }

    private function broken($blocks, int $index, string $reason): array
    {
        return [
            'valid' => false,
            'length' => $blocks->count(),
            'brokenAt' => $index,
            'reason' => $reason,
            'head' => $blocks->last()->hash,
        ];
    }
}
