<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Auth/Login', [
            'canRegister' => true,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $throttleKey = Str::transliterate(
            Str::lower($credentials['email']).'|'.$request->ip()
        );

        // Five attempts a minute per email+IP. Without this, a single-user app
        // with a guessable demo login is a free credential-stuffing target.
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            throw ValidationException::withMessages([
                'email' => 'Too many attempts. Try again in '
                    .RateLimiter::availableIn($throttleKey).' seconds.',
            ]);
        }

        // No "remember me": sessions last SESSION_LIFETIME and no longer. A
        // long-lived remember token on a personal finance app is a bigger
        // liability than the convenience is worth.
        $attempted = Auth::attempt([
            'email' => Str::lower($credentials['email']),
            'password' => $credentials['password'],
        ]);

        if (! $attempted) {
            RateLimiter::hit($throttleKey);

            throw ValidationException::withMessages([
                'email' => 'Those credentials do not match our records.',
            ]);
        }

        RateLimiter::clear($throttleKey);
        $request->session()->regenerate();

        return redirect()->intended('/dashboard');
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/')->with('success', 'Signed out.');
    }
}
