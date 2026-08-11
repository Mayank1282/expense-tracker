<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use MongoDB\Laravel\Schema\Blueprint;

/**
 * Password-reset rows are looked up by email and are worthless once expired.
 *
 * The TTL index is the useful part: MongoDB deletes each document an hour after
 * it was created, so stale bearer tokens clean themselves up without a
 * scheduled job. `App\Services\PasswordResetService::purgeExpired()` exists as
 * a manual equivalent for environments where the TTL monitor is not running.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('mongodb')->table('password_resets', function (Blueprint $collection) {
            $collection->unique('email');
            $collection->index('created_at', null, null, [
                'expireAfterSeconds' => 3600,
            ]);
        });
    }

    public function down(): void
    {
        Schema::connection('mongodb')->table('password_resets', function (Blueprint $collection) {
            $collection->dropIndex('email_1');
            $collection->dropIndex('created_at_1');
        });
    }
};
