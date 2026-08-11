<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PageController extends Controller
{
    public function landing(Request $request): Response
    {
        return Inertia::render('Landing', [
            'isAuthenticated' => $request->user() !== null,
        ]);
    }

    /**
     * The EMI calculator is deliberately public and entirely client-side —
     * it is pure arithmetic, so putting it behind a login or a round trip
     * would add friction for nothing.
     */
    public function emi(): Response
    {
        return Inertia::render('Emi');
    }
}
