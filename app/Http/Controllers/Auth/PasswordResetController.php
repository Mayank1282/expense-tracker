<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\PasswordResetService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetController extends Controller
{
    public function __construct(private readonly PasswordResetService $resets)
    {
    }

    public function requestForm(): Response
    {
        return Inertia::render('Auth/ForgotPassword');
    }

    public function sendLink(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:190'],
        ]);

        $user = User::where('email', Str::lower($validated['email']))->first();

        if ($user) {
            $this->resets->issue($user);
        }

        // The response is identical whether or not the address exists. Saying
        // "no account with that email" would turn this form into a way to
        // enumerate who has an account here.
        return back()->with(
            'success',
            'If that email has an account, a reset link is on its way.'
        );
    }

    public function resetForm(Request $request, string $token): Response
    {
        return Inertia::render('Auth/ResetPassword', [
            'token' => $token,
            'email' => (string) $request->query('email', ''),
        ]);
    }

    public function reset(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $error = $this->resets->redeem(
            $validated['email'],
            $validated['token'],
            $validated['password']
        );

        if ($error) {
            return back()->withErrors(['email' => $error]);
        }

        return redirect('/login')->with('success', 'Password changed. Sign in with it now.');
    }
}
