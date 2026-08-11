<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Ledger — {{ $period['label'] }}</title>

    {{--
        A standalone print document, not the app page with a print stylesheet.

        Printing the live page meant fighting the layout: hiding navigation,
        neutralising tonal surfaces that waste ink, and hoping page breaks fell
        somewhere sensible. A separate view starts from paper instead — black on
        white, one column, explicit break rules — and is far easier to keep
        correct than a second personality bolted onto the screen design.
    --}}
    <style>
        @page { size: A4; margin: 14mm 12mm; }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #111;
            background: #fff;
        }

        .sheet { max-width: 190mm; margin: 0 auto; padding: 8mm 0; }

        /* ---- Masthead ---- */
        header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            padding-bottom: 10px;
            border-bottom: 2px solid #111;
        }

        .brand { display: flex; align-items: center; gap: 10px; }
        .brand svg { display: block; }
        .brand-name { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
        .brand-sub {
            margin-top: 3px;
            font-size: 9px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #555;
        }

        .meta { text-align: right; font-size: 10px; color: #444; }
        .meta strong { display: block; font-size: 13px; color: #111; }

        h2 {
            margin: 18px 0 8px;
            font-size: 12px;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #444;
        }

        /* ---- Summary ---- */
        .summary { display: flex; gap: 10px; margin-top: 14px; }
        .summary div {
            flex: 1;
            padding: 9px 11px;
            border: 1px solid #bbb;
        }
        .summary span {
            display: block;
            font-size: 9px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #555;
        }
        .summary b {
            font-family: 'IBM Plex Mono', ui-monospace, monospace;
            font-size: 15px;
            font-variant-numeric: tabular-nums;
        }

        /* ---- Tables ---- */
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 5px 7px; text-align: left; }
        thead th {
            border-bottom: 1.5px solid #111;
            font-size: 9px;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            color: #444;
        }
        tbody td { border-bottom: 0.5px solid #ddd; }
        tfoot td { border-top: 1.5px solid #111; font-weight: 700; }
        .num {
            text-align: right;
            font-family: 'IBM Plex Mono', ui-monospace, monospace;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
        }

        /* Repeat the header on every printed page of a long ledger. */
        thead { display: table-header-group; }
        tr { break-inside: avoid; }

        .cols { display: flex; gap: 18px; }
        .cols > section { flex: 1; }

        .swatch {
            display: inline-block;
            width: 7px;
            height: 7px;
            margin-right: 6px;
            border: 0.5px solid #999;
            border-radius: 50%;
            vertical-align: middle;
        }

        footer {
            margin-top: 20px;
            padding-top: 8px;
            border-top: 0.5px solid #bbb;
            font-size: 9px;
            color: #666;
            display: flex;
            justify-content: space-between;
        }

        .empty { padding: 10px 0; color: #666; font-style: italic; }

        @media screen {
            body { background: #f2f2f2; padding: 20px; }
            .sheet { background: #fff; padding: 14mm; box-shadow: 0 2px 14px rgba(0,0,0,.16); }
        }
    </style>
</head>
<body>
    <div class="sheet">
        <header>
            <div class="brand">
                {{-- Inline so the mark prints without needing a build asset. --}}
                <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
                    <rect x="0.75" y="0.75" width="32.5" height="32.5" rx="8" fill="#00695A"/>
                    <text x="17" y="24" text-anchor="middle" font-family="'Space Grotesk', sans-serif"
                          font-size="20" font-weight="700" fill="#ffffff">&#8377;</text>
                </svg>

                <div>
                    <div class="brand-name">Ledger</div>
                    <div class="brand-sub">Personal expense tracker</div>
                </div>
            </div>

            <div class="meta">
                <strong>{{ $period['label'] }}</strong>
                {{ $user->name }}<br>
                {{ $user->email }}<br>
                Generated {{ $generatedAt }}
            </div>
        </header>

        <div class="summary">
            <div>
                <span>Income</span>
                <b>{{ $fmt($totals['income']) }}</b>
            </div>
            <div>
                <span>Spent</span>
                <b>{{ $fmt($totals['expense']) }}</b>
            </div>
            <div>
                <span>Net</span>
                <b>{{ $fmt($totals['net']) }}</b>
            </div>
        </div>

        <div class="cols">
            <section>
                <h2>Spending by category</h2>
                @if (count($expenseBreakdown))
                    <table>
                        <tbody>
                        @foreach ($expenseBreakdown as $row)
                            <tr>
                                <td>
                                    <span class="swatch" style="background: {{ $row['color'] }}"></span>
                                    {{ $row['name'] }}
                                </td>
                                <td class="num">{{ $fmt($row['amount']) }}</td>
                                <td class="num">{{ $row['share'] }}%</td>
                            </tr>
                        @endforeach
                        </tbody>
                    </table>
                @else
                    <p class="empty">No spending recorded.</p>
                @endif
            </section>

            <section>
                <h2>Income by category</h2>
                @if (count($incomeBreakdown))
                    <table>
                        <tbody>
                        @foreach ($incomeBreakdown as $row)
                            <tr>
                                <td>
                                    <span class="swatch" style="background: {{ $row['color'] }}"></span>
                                    {{ $row['name'] }}
                                </td>
                                <td class="num">{{ $fmt($row['amount']) }}</td>
                                <td class="num">{{ $row['share'] }}%</td>
                            </tr>
                        @endforeach
                        </tbody>
                    </table>
                @else
                    <p class="empty">No income recorded.</p>
                @endif
            </section>
        </div>

        <h2>Every entry — {{ count($entries) }} {{ Str::plural('entry', count($entries)) }}</h2>

        @if (count($entries))
            <table>
                <thead>
                    <tr>
                        <th style="width: 20%">Date</th>
                        <th style="width: 22%">Category</th>
                        <th>Note</th>
                        <th class="num" style="width: 16%">Income</th>
                        <th class="num" style="width: 16%">Expense</th>
                    </tr>
                </thead>
                <tbody>
                @foreach ($entries as $entry)
                    <tr>
                        <td>{{ $entry['date'] }}</td>
                        <td>{{ $entry['category'] }}</td>
                        <td>{{ $entry['note'] ?: '—' }}</td>
                        <td class="num">{{ $entry['type'] === 'income' ? $fmt($entry['amount']) : '' }}</td>
                        <td class="num">{{ $entry['type'] === 'expense' ? $fmt($entry['amount']) : '' }}</td>
                    </tr>
                @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3">Totals</td>
                        <td class="num">{{ $fmt($totals['income']) }}</td>
                        <td class="num">{{ $fmt($totals['expense']) }}</td>
                    </tr>
                </tfoot>
            </table>
        @else
            <p class="empty">Nothing recorded in this month.</p>
        @endif

        <footer>
            <span>Ledger — {{ $period['label'] }}</span>
            <span>{{ $user->email }}</span>
        </footer>
    </div>

    <script>
        // Opened from the Print button, so go straight to the dialog. Guarded by
        // ?autoprint=1 so the page can also just be read on screen.
        if (new URLSearchParams(location.search).get('autoprint') === '1') {
            window.addEventListener('load', () => window.print());
        }
    </script>
</body>
</html>
