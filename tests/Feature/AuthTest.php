<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use PHPUnit\Framework\Attributes\Test;
use Tests\LedgerTestCase;

class AuthTest extends LedgerTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        RateLimiter::clear('user@example.test|127.0.0.1');
    }

    #[Test]
    public function registering_creates_the_account_and_its_starter_categories(): void
    {
        $this->post('/register', [
            'name' => 'Asha',
            'email' => 'Asha@Example.Test',
            'password' => 'correct-horse-battery',
            'password_confirmation' => 'correct-horse-battery',
        ])->assertRedirect('/dashboard');

        $user = User::first();

        $this->assertSame('asha@example.test', $user->email, 'Email is normalised to lower case.');
        $this->assertSame('INR', $user->currency);
        $this->assertGreaterThan(0, Category::ownedBy((string) $user->getKey())->count());
        $this->assertAuthenticated();
    }

    #[Test]
    public function the_stored_password_is_hashed(): void
    {
        $this->post('/register', [
            'name' => 'Asha',
            'email' => 'asha@example.test',
            'password' => 'correct-horse-battery',
            'password_confirmation' => 'correct-horse-battery',
        ]);

        $this->assertNotSame('correct-horse-battery', User::first()->password);
    }

    #[Test]
    public function a_duplicate_email_is_rejected(): void
    {
        $this->makeUser(['email' => 'taken@example.test']);

        $this->post('/register', [
            'name' => 'Someone',
            'email' => 'taken@example.test',
            'password' => 'correct-horse-battery',
            'password_confirmation' => 'correct-horse-battery',
        ])->assertSessionHasErrors('email');

        $this->assertSame(1, User::count());
    }

    #[Test]
    public function a_wrong_password_does_not_sign_anyone_in(): void
    {
        $this->makeUser(['email' => 'user@example.test']);

        $this->post('/login', [
            'email' => 'user@example.test',
            'password' => 'not-the-password',
        ])->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    /**
     * A portfolio app with a published demo login is a standing invitation to
     * credential stuffing, so the throttle is part of the feature, not a nicety.
     */
    #[Test]
    public function repeated_failures_are_throttled(): void
    {
        $this->makeUser(['email' => 'user@example.test']);

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->post('/login', ['email' => 'user@example.test', 'password' => 'wrong']);
        }

        $response = $this->post('/login', [
            'email' => 'user@example.test',
            'password' => 'wrong',
        ]);

        $response->assertSessionHasErrors('email');
        $this->assertStringContainsString(
            'Too many attempts',
            session('errors')->first('email')
        );
    }

    #[Test]
    public function deleting_the_account_erases_the_whole_ledger(): void
    {
        $user = $this->makeUser(['password' => 'correct-horse-battery']);
        $category = $this->makeCategory($user);
        $this->makeTransaction($user, ['category_id' => (string) $category->getKey()]);

        $this->actingAs($user)
            ->delete('/profile', ['password' => 'correct-horse-battery'])
            ->assertRedirect('/');

        $this->assertSame(0, User::count());
        $this->assertSame(0, Category::count());
        $this->assertSame(0, Transaction::count());
        $this->assertGuest();
    }

    #[Test]
    public function the_account_is_not_deleted_without_the_right_password(): void
    {
        $user = $this->makeUser(['password' => 'correct-horse-battery']);
        $this->makeTransaction($user);

        $this->actingAs($user)
            ->delete('/profile', ['password' => 'guessing'])
            ->assertSessionHasErrors('password');

        $this->assertSame(1, User::count());
        $this->assertSame(1, Transaction::count());
    }
}
