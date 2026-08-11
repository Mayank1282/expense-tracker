<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\Test;
use Tests\LedgerTestCase;

class ProfileTest extends LedgerTestCase
{
    /**
     * The unique rule has to ignore the user's own document. If the ignore-id
     * does not resolve against an ObjectId, saving the form without touching
     * the email field fails with "email already taken" — the user is blocked
     * from changing their own name.
     */
    #[Test]
    public function saving_the_profile_without_changing_the_email_is_allowed(): void
    {
        $user = $this->makeUser(['email' => 'me@example.test', 'name' => 'Old Name']);

        $this->actingAs($user)->put('/profile', [
            'name' => 'New Name',
            'email' => 'me@example.test',
            'currency' => 'INR',
        ])->assertSessionHasNoErrors();

        $this->assertSame('New Name', $user->fresh()->name);
    }

    #[Test]
    public function an_email_already_used_by_someone_else_is_rejected(): void
    {
        $this->makeUser(['email' => 'taken@example.test']);
        $user = $this->makeUser(['email' => 'me@example.test']);

        $this->actingAs($user)->put('/profile', [
            'name' => 'Me',
            'email' => 'taken@example.test',
            'currency' => 'INR',
        ])->assertSessionHasErrors('email');

        $this->assertSame('me@example.test', $user->fresh()->email);
    }

    #[Test]
    public function the_currency_must_be_one_we_can_format(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->put('/profile', [
            'name' => 'Me',
            'email' => $user->email,
            'currency' => 'XYZ',
        ])->assertSessionHasErrors('currency');
    }

    #[Test]
    public function changing_the_password_requires_the_current_one(): void
    {
        $user = $this->makeUser(['password' => 'correct-horse-battery']);

        $this->actingAs($user)->put('/profile/password', [
            'current_password' => 'wrong',
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertSessionHasErrors('current_password');

        $this->assertTrue(Hash::check('correct-horse-battery', $user->fresh()->password));
    }

    #[Test]
    public function a_changed_password_is_hashed_and_actually_works(): void
    {
        $user = $this->makeUser(['password' => 'correct-horse-battery']);

        $this->actingAs($user)->put('/profile/password', [
            'current_password' => 'correct-horse-battery',
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check('a-brand-new-password', $user->fresh()->password));
    }
}
