<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Ledger — reconnecting</title>

    {{--
        Deliberately self-contained: no Vite manifest, no Inertia, no session,
        no database. This page renders precisely when something the rest of the
        app depends on is unavailable, so it cannot depend on any of it.
    --}}
    <style>
        :root { color-scheme: light dark; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100dvh;
            display: grid;
            place-items: center;
            padding: 1.5rem;
            font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
            background: #f4fbf8;
            color: #161d1b;
        }
        .card {
            max-width: 30rem;
            width: 100%;
            padding: 2.5rem;
            background: #e8efec;
            border: 1px solid #bfc9c4;
            border-radius: 24px;
            box-shadow: inset 0 1px 0 rgb(255 255 255 / .55), 0 6px 18px -6px rgb(0 0 0 / .14);
        }
        .mark {
            display: grid;
            place-items: center;
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: #00695a;
            color: #fff;
            font-weight: 700;
            font-size: 1.1rem;
            box-shadow: inset 0 1px 0 rgb(255 255 255 / .4);
        }
        h1 { margin: 1.5rem 0 .5rem; font-size: 1.5rem; letter-spacing: -.02em; }
        p { margin: 0 0 .75rem; line-height: 1.6; color: #3f4945; }
        .btn {
            display: inline-flex;
            align-items: center;
            min-height: 44px;
            margin-top: 1.25rem;
            padding: 0 1.4rem;
            border-radius: 28px;
            background: #00695a;
            color: #fff;
            font-weight: 600;
            text-decoration: none;
        }
        code {
            font-family: 'IBM Plex Mono', ui-monospace, monospace;
            font-size: .8125rem;
            color: #3f4945;
        }
        @media (prefers-color-scheme: dark) {
            body { background: #0e1513; color: #dee4e1; }
            .card { background: #1a211f; border-color: #3f4945; box-shadow: inset 0 1px 0 rgb(255 255 255 / .08), 0 10px 26px -10px rgb(0 0 0 / .55); }
            p, code { color: #bfc9c4; }
            .mark, .btn { background: #5edbc0; color: #003730; }
        }
    </style>
</head>
<body>
    <main class="card">
        <span class="mark" aria-hidden="true">&#8377;</span>

        <h1>Can&rsquo;t reach the database</h1>

        <p>
            Ledger is up, but it can&rsquo;t talk to its database right now. Nothing has been
            lost &mdash; your entries are safe where they are.
        </p>

        <p>
            On the free hosting tier the database sleeps after a period of inactivity and takes
            a moment to wake. Waiting a few seconds and trying again usually does it.
        </p>

        @if (config('app.debug'))
            <p><code>{{ $reason }}</code></p>
        @endif

        <a class="btn" href="{{ url()->current() }}">Try again</a>
    </main>
</body>
</html>
