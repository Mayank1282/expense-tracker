<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * What a visitor sees when the database is unreachable.
 *
 * This is not a hypothetical: MongoDB Atlas' free tier sleeps after inactivity,
 * so the first person to open the deployed demo after a quiet spell hits exactly
 * this path. Left unhandled the driver's ConnectionTimeoutException renders as a
 * 500 stack trace naming the host and port.
 *
 * These tests deliberately do NOT extend LedgerTestCase — its setUp truncates
 * collections, which cannot work when the point of the test is that there is no
 * reachable database.
 */
class DatabaseDownTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Port 59999 has nothing listening; a short timeout keeps the suite fast.
        config([
            'database.connections.mongodb.dsn' => 'mongodb://127.0.0.1:59999',
            'database.connections.mongodb.options.serverSelectionTimeoutMS' => 400,
        ]);

        DB::purge('mongodb');
    }

    protected function tearDown(): void
    {
        DB::purge('mongodb');

        parent::tearDown();
    }

    #[Test]
    public function a_browser_gets_a_readable_page_rather_than_a_stack_trace(): void
    {
        $response = $this->post('/login', [
            'email' => 'demo@example.test',
            'password' => 'password',
        ]);

        // 503, not 500: the service is temporarily unavailable and retrying is
        // the right thing for the client to do.
        $response->assertStatus(503);
        $response->assertViewIs('errors.database');
        $response->assertSee('reach the database', false);
    }

    #[Test]
    public function the_page_does_not_leak_the_host_and_port(): void
    {
        config(['app.debug' => false]);

        $response = $this->post('/login', [
            'email' => 'demo@example.test',
            'password' => 'password',
        ]);

        $response->assertDontSee('59999');
        $response->assertDontSee('ConnectionTimeoutException');
    }

    #[Test]
    public function an_api_style_request_gets_json_not_html(): void
    {
        $response = $this->postJson('/login', [
            'email' => 'demo@example.test',
            'password' => 'password',
        ]);

        $response->assertStatus(503);
        $response->assertJson(['message' => 'The database is unavailable. Please try again in a moment.']);
    }

    /**
     * The error page has to render with nothing available — no Vite manifest,
     * no Inertia, no session-backed user lookup. If it ever grows a dependency
     * on any of those it will fail at precisely the moment it is needed.
     */
    #[Test]
    public function the_error_page_stands_alone(): void
    {
        $html = view('errors.database', ['reason' => 'test'])->render();

        $this->assertStringNotContainsString('/build/', $html, 'Must not depend on the Vite manifest.');
        $this->assertStringNotContainsString('data-page', $html, 'Must not depend on Inertia.');
        $this->assertStringContainsString('reach the database', $html);
    }
}
