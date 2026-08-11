<?php

namespace Tests\Feature;

use App\Models\Block;
use App\Models\Transaction;
use App\Services\LedgerChain;
use PHPUnit\Framework\Attributes\Test;
use Tests\LedgerTestCase;

class LedgerChainTest extends LedgerTestCase
{
    private LedgerChain $chain;

    protected function setUp(): void
    {
        parent::setUp();

        Block::truncate();
        $this->chain = app(LedgerChain::class);
    }

    protected function tearDown(): void
    {
        Block::truncate();

        parent::tearDown();
    }

    #[Test]
    public function the_first_append_seeds_a_genesis_block(): void
    {
        $user = $this->makeUser();

        $this->chain->append((string) $user->getKey(), 'transaction.created', ['amount' => 100]);

        $blocks = Block::orderBy('index')->get();

        $this->assertCount(2, $blocks);
        $this->assertSame('genesis', $blocks[0]->event);
        $this->assertSame(0, $blocks[0]->index);
        $this->assertSame(Block::GENESIS_PREVIOUS, $blocks[0]->previous_hash);
    }

    #[Test]
    public function each_block_carries_the_hash_of_the_one_before_it(): void
    {
        $user = $this->makeUser();
        $userId = (string) $user->getKey();

        foreach ([100, 200, 300] as $amount) {
            $this->chain->append($userId, 'transaction.created', ['amount' => $amount]);
        }

        $blocks = Block::orderBy('index')->get();

        for ($i = 1; $i < $blocks->count(); $i++) {
            $this->assertSame(
                $blocks[$i - 1]->hash,
                $blocks[$i]->previous_hash,
                "Block {$i} does not link to block ".($i - 1)
            );
        }
    }

    #[Test]
    public function an_untouched_chain_verifies(): void
    {
        $user = $this->makeUser();
        $userId = (string) $user->getKey();

        $this->chain->append($userId, 'transaction.created', ['amount' => 5000]);
        $this->chain->append($userId, 'transaction.updated', ['amount' => 7500]);

        $result = $this->chain->verify($userId);

        $this->assertTrue($result['valid']);
        $this->assertSame(3, $result['length']);
        $this->assertNull($result['brokenAt']);
    }

    /**
     * The whole promise of the chain: change a past record directly in the
     * database, the way someone with access would, and verification catches it.
     */
    #[Test]
    public function editing_a_past_payload_breaks_verification(): void
    {
        $user = $this->makeUser();
        $userId = (string) $user->getKey();

        $this->chain->append($userId, 'transaction.created', ['amount' => 5000]);
        $this->chain->append($userId, 'transaction.created', ['amount' => 9000]);

        $target = Block::where('index', 1)->first();
        $target->payload = ['amount' => 999999];
        $target->save();

        $result = $this->chain->verify($userId);

        $this->assertFalse($result['valid']);
        $this->assertSame(1, $result['brokenAt']);
        $this->assertStringContainsString('altered', $result['reason']);
    }

    #[Test]
    public function rehashing_the_edited_block_still_breaks_the_chain(): void
    {
        $user = $this->makeUser();
        $userId = (string) $user->getKey();

        $this->chain->append($userId, 'transaction.created', ['amount' => 5000]);
        $this->chain->append($userId, 'transaction.created', ['amount' => 9000]);

        // A more careful attacker: edit the payload AND fix that block's own
        // hashes. The block is now internally consistent — but the block after
        // it still points at the old hash, so the chain gives it away.
        $target = Block::where('index', 1)->first();
        $target->payload = ['amount' => 999999];
        $target->payload_hash = $this->chain->hashPayload($target->payload);
        $target->hash = $target->computeHash();
        $target->save();

        $result = $this->chain->verify($userId);

        $this->assertFalse($result['valid']);
        $this->assertSame(2, $result['brokenAt']);
        $this->assertStringContainsString('does not follow', $result['reason']);
    }

    #[Test]
    public function removing_a_block_is_detected(): void
    {
        $user = $this->makeUser();
        $userId = (string) $user->getKey();

        foreach ([100, 200, 300] as $amount) {
            $this->chain->append($userId, 'transaction.created', ['amount' => $amount]);
        }

        Block::where('index', 2)->delete();

        $result = $this->chain->verify($userId);

        $this->assertFalse($result['valid']);
        $this->assertStringContainsString('missing', $result['reason']);
    }

    #[Test]
    public function payload_hashing_does_not_depend_on_key_order(): void
    {
        $a = $this->chain->hashPayload(['amount' => 100, 'type' => 'expense', 'note' => 'x']);
        $b = $this->chain->hashPayload(['note' => 'x', 'type' => 'expense', 'amount' => 100]);

        $this->assertSame($a, $b);
    }

    #[Test]
    public function chains_are_per_user_and_never_interleave(): void
    {
        $mine = $this->makeUser();
        $theirs = $this->makeUser();

        $this->chain->append((string) $mine->getKey(), 'transaction.created', ['amount' => 100]);
        $this->chain->append((string) $theirs->getKey(), 'transaction.created', ['amount' => 200]);
        $this->chain->append((string) $mine->getKey(), 'transaction.created', ['amount' => 300]);
        $this->chain->append((string) $theirs->getKey(), 'transaction.created', ['amount' => 400]);

        $this->assertSame(3, Block::ownedBy((string) $mine->getKey())->count());
        $this->assertSame(3, Block::ownedBy((string) $theirs->getKey())->count());

        // Breaking one user's chain must not invalidate anyone else's.
        Block::ownedBy((string) $theirs->getKey())->where('index', 1)->delete();

        $this->assertTrue($this->chain->verify((string) $mine->getKey())['valid']);
        $this->assertFalse($this->chain->verify((string) $theirs->getKey())['valid']);
    }

    /**
     * A known and unavoidable limit, asserted rather than left implied.
     *
     * A hash chain proves that the blocks it still holds are internally
     * consistent. It cannot prove that blocks are MISSING FROM THE END — lop
     * off the most recent block and what remains is a shorter, perfectly valid
     * chain. Detecting that needs an anchor outside the database: a head hash
     * published somewhere the attacker does not control, which is precisely
     * what publishing to a chain would buy.
     */
    #[Test]
    public function truncating_the_tip_is_not_detectable_without_an_external_anchor(): void
    {
        $user = $this->makeUser();
        $userId = (string) $user->getKey();

        foreach ([100, 200, 300] as $amount) {
            $this->chain->append($userId, 'transaction.created', ['amount' => $amount]);
        }

        $headBefore = $this->chain->headHash($userId);

        Block::ownedBy($userId)->where('index', 3)->delete();

        $result = $this->chain->verify($userId);

        $this->assertTrue($result['valid'], 'A truncated chain still verifies — this is the gap.');
        $this->assertNotSame(
            $headBefore,
            $result['head'],
            'The head hash changes, which is why anchoring it externally is what closes the gap.'
        );
    }

    /* ------------------------------------------------------------------ */
    /* Wiring into the ledger                                             */
    /* ------------------------------------------------------------------ */

    #[Test]
    public function recording_a_transaction_appends_a_block(): void
    {
        $user = $this->makeUser();
        $category = $this->makeCategory($user);

        $this->actingAs($user)->post('/transactions', [
            'type' => 'expense',
            'amount' => '250.50',
            'occurred_on' => now()->toDateString(),
            'category_id' => (string) $category->getKey(),
        ]);

        $block = Block::orderBy('index', 'desc')->first();

        $this->assertSame('transaction.created', $block->event);
        $this->assertSame(25050, $block->payload['amount']);
        $this->assertTrue($this->chain->verify((string) $user->getKey())['valid']);
    }

    #[Test]
    public function a_deletion_records_what_was_removed_before_removing_it(): void
    {
        $user = $this->makeUser();
        $entry = $this->makeTransaction($user, ['amount' => 4200, 'note' => 'Vanishing act']);

        $this->actingAs($user)->delete("/transactions/{$entry->getKey()}");

        $block = Block::where('event', 'transaction.deleted')->first();

        $this->assertNotNull($block, 'A deletion must leave a block behind.');
        $this->assertSame(4200, $block->payload['amount']);
        $this->assertSame('Vanishing act', $block->payload['note']);
        $this->assertSame(0, Transaction::count());
    }

    #[Test]
    public function editing_an_entry_appends_rather_than_rewrites(): void
    {
        $user = $this->makeUser();
        $category = $this->makeCategory($user);
        $entry = $this->makeTransaction($user, ['amount' => 1000, 'category_id' => (string) $category->getKey()]);

        $this->actingAs($user)->put("/transactions/{$entry->getKey()}", [
            'type' => 'expense',
            'amount' => '20',
            'occurred_on' => now()->toDateString(),
            'category_id' => (string) $category->getKey(),
        ]);

        $events = Block::orderBy('index')->pluck('event')->all();

        $this->assertSame(['genesis', 'transaction.updated'], $events);
        $this->assertTrue($this->chain->verify((string) $user->getKey())['valid']);
    }

    #[Test]
    public function the_chain_page_reports_its_verification_state(): void
    {
        $user = $this->makeUser();
        $this->chain->append((string) $user->getKey(), 'transaction.created', ['amount' => 100]);

        $this->actingAs($user)->get('/chain')->assertInertia(fn ($page) => $page
            ->component('Chain/Index')
            ->where('verification.valid', true)
            ->has('blocks.data', 2)
        );
    }

    #[Test]
    public function a_guest_cannot_see_the_chain(): void
    {
        $this->get('/chain')->assertRedirect('/login');
    }
}
