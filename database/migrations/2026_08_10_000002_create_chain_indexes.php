<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use MongoDB\Laravel\Schema\Blueprint;

/**
 * The chain is always read in order, scoped to one user, and the index must be
 * unique per user — two blocks claiming the same position would let someone
 * splice history without the hashes noticing a gap.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('mongodb')->table('blocks', function (Blueprint $collection) {
            $collection->unique(['user_id' => 1, 'index' => 1]);
            $collection->index(['user_id' => 1, 'index' => -1]);
        });
    }

    public function down(): void
    {
        Schema::connection('mongodb')->table('blocks', function (Blueprint $collection) {
            $collection->dropIndex('user_id_1_index_1');
            $collection->dropIndex('user_id_1_index_-1');
        });
    }
};
