<?php

namespace App\Services;

use App\Models\PasswordReset;
use App\Models\User;
use App\Notifications\ResetPasswordLink;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Issues and redeems password-reset tokens.
 *
 * Deliberate properties:
 *   - the token is emailed in the clear but only ever STORED hashed
 *   - one live token per address; issuing a new one invalidates the old
 *   - redeeming is single-use — the row is deleted inside the same call
 *   - comparison is hash-based, so a timing side channel does not leak the token
 */
class PasswordResetService
{
    /**
     * @return string|null the plain token to email, or null if throttled
     */
    public function issue(User $user): ?string
    {
        $email = Str::lower($user->email);
        $existing = PasswordReset::where('email', $email)->first();

        // Someone hammering "send link" should not be able to use this app as a
        // mail relay, and Brevo's free tier has a daily cap worth protecting.
        if ($existing && $existing->isRecent()) {
            return null;
        }

        $existing?->delete();

        $token = Str::random(64);

        PasswordReset::create([
            'email' => $email,
            'token' => Hash::make($token),
            'created_at' => CarbonImmutable::now(),
        ]);

        $user->notify(new ResetPasswordLink($token, $email));

        return $token;
    }

    /**
     * Verify a token and, if it holds, apply the new password.
     *
     * @return string|null an error message, or null on success
     */
    public function redeem(string $email, string $token, string $newPassword): ?string
    {
        $email = Str::lower($email);
        $record = PasswordReset::where('email', $email)->first();

        // One message for every failure mode. Distinguishing "no such request"
        // from "wrong token" would turn this form into an account oracle.
        $invalid = 'This reset link is invalid or has expired.';

        if (! $record || ! Hash::check($token, $record->token)) {
            return $invalid;
        }

        if ($record->isExpired()) {
            $record->delete();

            return $invalid;
        }

        $user = User::where('email', $email)->first();

        if (! $user) {
            $record->delete();

            return $invalid;
        }

        $user->update(['password' => $newPassword]);

        // Single use: the request is spent whether or not it is used again.
        $record->delete();

        /*
         * KNOWN LIMIT — a reset does not sign out other devices.
         *
         * Sessions live in the file store keyed by session id, and nothing here
         * touches them, so anyone already signed in elsewhere stays signed in.
         * Rotating `remember_token` used to sit here and was removed: it only
         * ever invalidated "remember me" cookies, and that feature is gone, so
         * the line was dead code wearing a comment that claimed more than it did.
         *
         * Closing this properly means enabling Laravel's `AuthenticateSession`
         * middleware and calling `logoutOtherDevices()` with the new password.
         * That is a deliberate next step rather than an oversight.
         */

        return null;
    }

    public function purgeExpired(): int
    {
        return PasswordReset::where(
            'created_at',
            '<',
            CarbonImmutable::now()->subMinutes(PasswordReset::EXPIRY_MINUTES)
        )->delete();
    }
}
