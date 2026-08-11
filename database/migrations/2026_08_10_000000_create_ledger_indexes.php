<?php

use Illuminate\Database\Migrations\Migration;
use MongoDB\Laravel\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * MongoDB needs no table definitions, so the only schema work here is indexes.
 *
 * Every query in this application is scoped to one user, and almost every one
 * of those is then filtered or sorted by date. A compound index on
 * (user_id, occurred_on) serves both — a bare `user_id` index would still make
 * the month range a collection scan within the user's own documents.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('mongodb')->table('users', function (Blueprint $collection) {
            $collection->unique('email');
        });

        Schema::connection('mongodb')->table('transactions', function (Blueprint $collection) {
            $collection->index(['user_id' => 1, 'occurred_on' => -1]);
            $collection->index(['user_id' => 1, 'category_id' => 1]);
        });

        Schema::connection('mongodb')->table('categories', function (Blueprint $collection) {
            $collection->index(['user_id' => 1, 'type' => 1]);
        });
    }

    public function down(): void
    {
        Schema::connection('mongodb')->table('users', function (Blueprint $collection) {
            $collection->dropIndex('email_1');
        });

        Schema::connection('mongodb')->table('transactions', function (Blueprint $collection) {
            $collection->dropIndex('user_id_1_occurred_on_-1');
            $collection->dropIndex('user_id_1_category_id_1');
        });

        Schema::connection('mongodb')->table('categories', function (Blueprint $collection) {
            $collection->dropIndex('user_id_1_type_1');
        });
    }
};
