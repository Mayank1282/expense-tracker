<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use MongoDB\Laravel\Eloquent\Model;

/**
 * A pending password-reset request.
 *
 * Laravel's built-in `DatabaseTokenRepository` is written against a SQL table
 * and reads `created_at` back as a string to hand to `Carbon::parse()`. Through
 * this driver that column comes back as a `UTCDateTime`, which is not a
 * `DateTimeInterface`, so the expiry check breaks in a way that fails open.
 * A small model with an explicit cast is clearer than patching around that.
 *
 * The token is stored hashed. A reset row is a bearer credential — anyone with
 * read access to the collection could otherwise take over an account.
 *
 * @property string $email
 * @property string $token  a hash, never the token itself
 * @property CarbonImmutable $created_at
 */
class PasswordReset extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'password_resets';

    protected $fillable = ['email', 'token', 'created_at'];

    public $timestamps = false;

    /** How long a link stays usable. */
    public const EXPIRY_MINUTES = 60;

    /** How long before a new link can be requested for the same address. */
    public const THROTTLE_SECONDS = 60;

    protected function casts(): array
    {
        return ['created_at' => 'immutable_datetime'];
    }

    public function isExpired(): bool
    {
        return $this->created_at->addMinutes(self::EXPIRY_MINUTES)->isPast();
    }

    public function isRecent(): bool
    {
        return $this->created_at->addSeconds(self::THROTTLE_SECONDS)->isFuture();
    }
}
