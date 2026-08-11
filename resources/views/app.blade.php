<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#F4F4F0" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#0C0C0C" media="(prefers-color-scheme: dark)">
    <title inertia>{{ config('app.name', 'Ledger') }}</title>

    {{-- Runs before first paint so the dark theme never flashes white. --}}
    <script>
        (function () {
            try {
                var stored = localStorage.getItem('ledger-theme');
                var dark = stored ? stored === 'dark'
                    : window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.toggle('dark', dark);
                document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
            } catch (e) {}
        })();
    </script>

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    @inertiaHead
</head>
<body class="antialiased">
    @inertia
</body>
</html>
