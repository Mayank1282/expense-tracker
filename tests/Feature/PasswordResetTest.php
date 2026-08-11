<?php

namespace Tests\Feature;

use App\Models\PasswordReset;
use App\Models\User;
use App\Notifications\ResetPasswordLink;
use App\Services\PasswordResetService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use PHPUnit\Framework\Attributes\Test;
use Tests\LedgerTestCase;

class PasswordResetTest extends LedgerTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        PasswordReset::truncate();
    }

    #[Test]
    public function requesting_a_link_sends_a_notification(): void
    {
        Notification::fake();
        $user = $this->makeUser(['email' => 'me@example.test']);

        $this->post('/forgot-password', ['email' => 'me@example.test'])
            ->assertSessionHas('success');

        Notification::assertSentTo($user, ResetPasswordLink::class);
        $this->assertSame(1, PasswordReset::count());
    }

    /**
     * The response must be identical for a known and an unknown address, or the
     * form becomes a way to find out who has an account here.
     */
    #[Test]
    public function an_unknown_address_gets_the_same_response_and_sends_nothing(): void
    {
        Notification::fake();

        $known = $this->post('/forgot-password', ['email' => 'nobody@example.test']);

        $known->assertSessionHas('success');
        $known->assertSessionHasNoErrors();
        Notification::assertNothingSent();
        $this->assertSame(0, PasswordReset::count());
    }

    #[Test]
    public function the_token_is_never_stored_in_the_clear(): void
    {
        Notification::fake();
        $user = $this->makeUser();

        $token = app(PasswordResetService::class)->issue($user);

        $stored = PasswordReset::first()->token;

        $this->assertNotSame($token, $stored);
        $this->assertTrue(Hash::check($token, $stored));
    }

    #[Test]
    public function a_valid_token_changes_the_password_and_is_then_spent(): void
    {
        Notification::fake();
        $user = $this->makeUser(['email' => 'me@example.test', 'password' => 'old-password-here']);

        $token = app(PasswordResetService::class)->issue($user);

        $this->post('/reset-password', [
            'token' => $token,
            'email' => 'me@example.test',
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertRedirect('/login');

        $this->assertTrue(Hash::check('a-brand-new-password', $user->fresh()->password));
        $this->assertSame(0, PasswordReset::count(), 'The token must be single-use.');
    }

    #[Test]
    public function the_same_token_cannot_be_used_twice(): void
    {
        Notification::fake();
        $user = $this->makeUser(['email' => 'me@example.test']);
        $token = app(PasswordResetService::class)->issue($user);

        $payload = [
            'token' => $token,
            'email' => 'me@example.test',
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ];

        $this->post('/reset-password', $payload)->assertRedirect('/login');
        $this->post('/reset-password', $payload)->assertSessionHasErrors('email');
    }

    #[Test]
    public function a_wrong_token_is_refused(): void
    {
        Notification::fake();
        $user = $this->makeUser(['email' => 'me@example.test', 'password' => 'old-password-here']);
        app(PasswordResetService::class)->issue($user);

        $this->post('/reset-password', [
            'token' => str_repeat('a', 64),
            'email' => 'me@example.test',
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertSessionHasErrors('email');

        $this->assertTrue(Hash::check('old-password-here', $user->fresh()->password));
    }

    #[Test]
    public function an_expired_token_is_refused_and_cleaned_up(): void
    {
        Notification::fake();
        $user = $this->makeUser(['email' => 'me@example.test', 'password' => 'old-password-here']);
        $token = app(PasswordResetService::class)->issue($user);

        // Age the request past the expiry window.
        PasswordReset::first()->update([
            'created_at' => CarbonImmutable::now()->subMinutes(PasswordReset::EXPIRY_MINUTES + 1),
        ]);

        $this->post('/reset-password', [
            'token' => $token,
            'email' => 'me@example.test',
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertSessionHasErrors('email');

        $this->assertTrue(Hash::check('old-password-here', $user->fresh()->password));
        $this->assertSame(0, PasswordReset::count());
    }

    #[Test]
    public function a_token_cannot_be_redeemed_against_a_different_account(): void
    {
        Notification::fake();
        $victim = $this->makeUser(['email' => 'victim@example.test', 'password' => 'old-password-here']);
        $attacker = $this->makeUser(['email' => 'attacker@example.test']);

        $attackerToken = app(PasswordResetService::class)->issue($attacker);

        $this->post('/reset-password', [
            'token' => $attackerToken,
            'email' => 'victim@example.test',
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertSessionHasErrors('email');

        $this->assertTrue(Hash::check('old-password-here', $victim->fresh()->password));
    }

    #[Test]
    public function requesting_twice_in_quick_succession_is_throttled(): void
    {
        Notification::fake();
        $user = $this->makeUser();
        $service = app(PasswordResetService::class);

        $this->assertNotNull($service->issue($user));
        $this->assertNull($service->issue($user), 'A second link inside the window must not be sent.');

        Notification::assertSentToTimes($user, ResetPasswordLink::class, 1);
    }

    #[Test]
    public function issuing_a_fresh_link_invalidates_the_previous_one(): void
    {
        Notification::fake();
        $user = $this->makeUser(['email' => 'me@example.test']);
        $service = app(PasswordResetService::class);

        $firstToken = $service->issue($user);

        // Step past the throttle without waiting.
        PasswordReset::first()->update([
            'created_at' => CarbonImmutable::now()->subMinutes(5),
        ]);

        $service->issue($user);

        $this->assertSame(1, PasswordReset::count(), 'Only one live request per address.');
        $this->assertSame(
            'This reset link is invalid or has expired.',
            $service->redeem('me@example.test', $firstToken, 'a-brand-new-password')
        );
    }

    #[Test]
    public function the_reset_form_renders_with_the_token_and_email(): void
    {
        $this->get('/reset-password/some-token?email=me%40example.test')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Auth/ResetPassword')
                ->where('token', 'some-token')
                ->where('email', 'me@example.test')
            );
    }

    #[Test]
    public function a_signed_in_user_is_kept_away_from_the_reset_pages(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->get('/forgot-password')->assertRedirect();
        $this->actingAs($user)->get('/reset-password/token')->assertRedirect();
    }

    #[Test]
    public function purging_removes_only_expired_requests(): void
    {
        Notification::fake();
        $fresh = $this->makeUser(['email' => 'fresh@example.test']);
        $stale = $this->makeUser(['email' => 'stale@example.test']);

        $service = app(PasswordResetService::class);
        $service->issue($fresh);
        $service->issue($stale);

        PasswordReset::where('email', 'stale@example.test')->update([
            'created_at' => CarbonImmutable::now()->subMinutes(PasswordReset::EXPIRY_MINUTES + 30),
        ]);

        $service->purgeExpired();

        $this->assertSame(1, PasswordReset::count());
        $this->assertSame('fresh@example.test', PasswordReset::first()->email);
    }
}
