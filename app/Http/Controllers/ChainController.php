<?php

namespace App\Http\Controllers;

use App\Models\Block;
use App\Services\LedgerChain;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ChainController extends Controller
{
    public function __construct(private readonly LedgerChain $chain)
    {
    }

    public function index(Request $request): Response
    {
        $userId = (string) $request->user()->getKey();

        $blocks = Block::ownedBy($userId)
            ->orderBy('index', 'desc')
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('Chain/Index', [
            'blocks' => [
                'data' => $blocks->getCollection()->map(fn (Block $block) => [
                    'index' => (int) $block->index,
                    'event' => $block->event,
                    'payload' => $block->payload,
                    'hash' => $block->hash,
                    'short_hash' => $block->shortHash(),
                    'previous_hash' => $block->previous_hash,
                    'short_previous' => substr((string) $block->previous_hash, 0, 12),
                    'created_at' => $block->created_at?->toDayDateTimeString(),
                ])->values()->all(),
                'meta' => [
                    'current_page' => $blocks->currentPage(),
                    'last_page' => $blocks->lastPage(),
                    'total' => $blocks->total(),
                ],
                'links' => $blocks->linkCollection()->toArray(),
            ],
            'verification' => $this->chain->verify($userId),
            // The tamper demo rewrites a real block, so it is only ever offered
            // outside production.
            'canDemo' => ! app()->environment('production'),
        ]);
    }

    /**
     * Re-run verification on demand.
     */
    public function verify(Request $request): RedirectResponse
    {
        $result = $this->chain->verify((string) $request->user()->getKey());

        return back()->with(
            $result['valid'] ? 'success' : 'error',
            $result['valid']
                ? "Chain intact — {$result['length']} blocks verified."
                : "Chain broken at block #{$result['brokenAt']}: {$result['reason']}"
        );
    }

    /**
     * Demo only: quietly rewrite the amount inside a past block, the way an
     * attacker with database access would. Verification should then fail at
     * that block and every block after it, which is the whole point of the
     * chain — and is far more convincing to show than to describe.
     */
    public function tamper(Request $request): RedirectResponse
    {
        abort_if(app()->environment('production'), 404);

        $userId = (string) $request->user()->getKey();

        $target = Block::ownedBy($userId)
            ->where('event', '!=', 'genesis')
            ->orderBy('index')
            ->first();

        if (! $target) {
            return back()->with('error', 'Record a transaction first — there is nothing to tamper with yet.');
        }

        $payload = $target->payload;
        $payload['amount'] = (int) ($payload['amount'] ?? 0) + 100000;

        // Note what is NOT updated: payload_hash and hash are left alone,
        // exactly as an attacker editing the collection directly would leave
        // them. That mismatch is what verification catches.
        $target->payload = $payload;
        $target->save();

        return back()->with('error', "Block #{$target->index} was altered. Run verification.");
    }

    /**
     * Demo only: wipe the chain so it can be rebuilt from a clean state.
     */
    public function reset(Request $request): RedirectResponse
    {
        abort_if(app()->environment('production'), 404);

        Block::ownedBy((string) $request->user()->getKey())->delete();

        return back()->with('success', 'Chain cleared. The next ledger change starts a new one.');
    }
}
