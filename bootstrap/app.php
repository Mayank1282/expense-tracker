<?php

use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use MongoDB\Driver\Exception\ConnectionException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        /*
         * Render terminates TLS at its load balancer and forwards plain HTTP to
         * the container. Without this, Laravel believes the request was insecure
         * and generates http:// asset URLs on an https:// page — the browser
         * blocks them as mixed content and the app renders as a blank screen.
         *
         * `at: '*'` trusts any proxy, which is correct here: the container is
         * only reachable through Render's balancer, so there is no untrusted
         * path by which a forged X-Forwarded-Proto could arrive.
         */
        $middleware->trustProxies(at: '*');

        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->redirectGuestsTo('/login');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        /*
         * An unreachable database is an expected condition here, not a bug.
         *
         * MongoDB Atlas' free tier sleeps after inactivity, and the driver
         * surfaces that as a raw ConnectionTimeoutException — which Laravel
         * renders as a 500 stack trace naming the host and port. That is a poor
         * first impression on a demo and leaks infrastructure detail besides.
         *
         * 503 (not 500) is the honest status: the service is temporarily
         * unavailable and the client should retry.
         */
        $exceptions->render(function (ConnectionException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'The database is unavailable. Please try again in a moment.',
                ], 503);
            }

            return response()->view('errors.database', [
                'reason' => $e->getMessage(),
            ], 503);
        });
    })->create();
