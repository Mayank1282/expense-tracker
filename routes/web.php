<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ChainController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\TransactionController;
use Illuminate\Support\Facades\Route;

/*
 * Server-driven routing: there is no API and no client router. Every entry
 * below returns an Inertia page, and the React component named in
 * `Inertia::render` receives the controller's props directly.
 */

/*
 * Temporary connectivity diagnostic.
 *
 * Render's free tier has no shell, so there is no way to inspect the container
 * when the database will not connect. This reports what the runtime actually
 * has — OpenSSL build, driver version — and tries both a raw TLS socket and a
 * driver ping, returning the real error rather than a 503 page.
 *
 * Gated behind DIAG_TOKEN and removed once the connection is fixed.
 */
Route::get('/diag', function (\Illuminate\Http\Request $request) {
    abort_unless(
        env('DIAG_TOKEN') && hash_equals((string) env('DIAG_TOKEN'), (string) $request->query('token')),
        404
    );

    $uri = (string) config('database.connections.mongodb.dsn');
    $host = 'ac-dq8q6sh-shard-00-00.kigg5ei.mongodb.net';

    $out = [
        'php' => PHP_VERSION,
        'openssl' => OPENSSL_VERSION_TEXT,
        'driver_ext' => phpversion('mongodb'),
        'uri_host' => parse_url(str_replace('mongodb+srv://', 'https://', $uri), PHP_URL_HOST),
    ];

    // Raw TLS to the shard, bypassing the driver entirely. If this succeeds the
    // network and certificates are fine and the fault is in the driver.
    $ctx = stream_context_create(['ssl' => ['peer_name' => $host, 'SNI_enabled' => true]]);
    $sock = @stream_socket_client(
        "ssl://{$host}:27017", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx
    );

    if ($sock) {
        $meta = stream_get_meta_data($sock);
        $out['raw_tls'] = 'CONNECTED';
        $out['raw_tls_protocol'] = stream_context_get_options($sock)['ssl']['protocol'] ?? 'n/a';
        fclose($sock);
    } else {
        $out['raw_tls'] = "FAILED ({$errno}): {$errstr}";
    }

    // Now the driver itself.
    try {
        $m = new \MongoDB\Driver\Manager($uri, ['serverSelectionTimeoutMS' => 15000]);
        $m->executeCommand('admin', new \MongoDB\Driver\Command(['ping' => 1]));
        $out['driver_ping'] = 'CONNECTED';
    } catch (\Throwable $e) {
        $out['driver_ping'] = 'FAILED: '.substr($e->getMessage(), 0, 500);
    }

    return response()->json($out, 200, [], JSON_PRETTY_PRINT);
});

Route::get('/', [PageController::class, 'landing'])->name('landing');
Route::get('/emi', [PageController::class, 'emi'])->name('emi');

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store']);

    Route::get('/register', [RegisteredUserController::class, 'create'])->name('register');
    Route::post('/register', [RegisteredUserController::class, 'store']);

    Route::get('/forgot-password', [PasswordResetController::class, 'requestForm'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetController::class, 'sendLink'])
        ->middleware('throttle:6,1')
        ->name('password.email');

    Route::get('/reset-password/{token}', [PasswordResetController::class, 'resetForm'])->name('password.reset');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])
        ->middleware('throttle:6,1')
        ->name('password.update');
});

Route::middleware('auth')->group(function () {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');

    Route::get('/transactions', [TransactionController::class, 'index'])->name('transactions.index');
    Route::post('/transactions', [TransactionController::class, 'store'])->name('transactions.store');
    Route::delete('/transactions', [TransactionController::class, 'destroyMany'])->name('transactions.destroyMany');
    Route::put('/transactions/{transaction}', [TransactionController::class, 'update'])->name('transactions.update');
    Route::delete('/transactions/{transaction}', [TransactionController::class, 'destroy'])->name('transactions.destroy');

    Route::get('/categories', [CategoryController::class, 'index'])->name('categories.index');
    Route::post('/categories', [CategoryController::class, 'store'])->name('categories.store');
    Route::put('/categories/{category}', [CategoryController::class, 'update'])->name('categories.update');
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->name('categories.destroy');

    Route::get('/chain', [ChainController::class, 'index'])->name('chain.index');
    Route::post('/chain/verify', [ChainController::class, 'verify'])->name('chain.verify');
    Route::post('/chain/tamper', [ChainController::class, 'tamper'])->name('chain.tamper');
    Route::delete('/chain', [ChainController::class, 'reset'])->name('chain.reset');

    Route::get('/reports/monthly', [ReportController::class, 'show'])->name('reports.monthly');
    Route::get('/reports/print', [ReportController::class, 'print'])->name('reports.print');
    Route::get('/reports/export', [ReportController::class, 'export'])->name('reports.export');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::put('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::put('/profile/password', [ProfileController::class, 'updatePassword'])->name('profile.password');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');
});
