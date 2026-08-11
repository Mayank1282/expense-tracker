<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\CategorySeeder;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Auth/Register');
    }

    public function store(Request $request, CategorySeeder $categories): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            // Uniqueness is checked against the Mongo collection, not a SQL
            // table — the `unique` rule works because the default connection
            // is the mongodb one.
            'email' => ['required', 'string', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'currency' => ['nullable', 'string', 'in:INR,USD,EUR,GBP'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => $validated['password'],
            'currency' => $validated['currency'] ?? 'INR',
        ]);

        // An empty tracker is useless on day one, so every new account starts
        // with a sensible starter set of categories they can rename or delete.
        $categories->seedDefaults($user);

        event(new Registered($user));

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->intended('/dashboard')
            ->with('success', 'Account created. Your ledger is open.');
    }
}
