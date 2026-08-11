<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Transaction;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $userId = (string) $request->user()->getKey();

        return Inertia::render('Profile', [
            'stats' => [
                'transactions' => Transaction::ownedBy($userId)->count(),
                'categories' => Category::ownedBy($userId)->count(),
                'since' => $request->user()->created_at?->format('M Y'),
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email,'.$user->getKey().',_id'],
            'currency' => ['required', 'in:INR,USD,EUR,GBP'],
        ]);

        $user->update([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'currency' => $validated['currency'],
        ]);

        return back()->with('success', 'Profile updated.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $request->user()->update(['password' => $validated['password']]);

        return back()->with('success', 'Password changed.');
    }

    /**
     * Deleting the account takes the ledger with it. There is no shared
     * financial record here the way Project 3 had bookings between two
     * parties, so a hard delete is correct — nothing else references this data.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();
        $userId = (string) $user->getKey();

        Transaction::ownedBy($userId)->delete();
        Category::ownedBy($userId)->delete();

        Auth::logout();
        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/')->with('success', 'Account and ledger erased.');
    }
}
