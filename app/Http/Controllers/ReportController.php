<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Transaction;
use App\Services\LedgerService;
use App\Support\Money;
use App\Support\TransactionPresenter;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(private readonly LedgerService $ledger)
    {
    }

    public function show(Request $request): Response
    {
        $userId = (string) $request->user()->getKey();
        $now = CarbonImmutable::now();

        $month = max(1, min(12, (int) $request->integer('month', $now->month)));
        $year = max(2000, min((int) $now->year + 1, (int) $request->integer('year', $now->year)));
        $cursor = CarbonImmutable::create($year, $month, 1);

        $rows = Transaction::ownedBy($userId)
            ->inMonth($year, $month)
            ->orderBy('occurred_on')
            ->get();

        $categories = Category::ownedBy($userId)->get()->keyBy(fn ($c) => (string) $c->getKey());

        return Inertia::render('Reports/Monthly', [
            'period' => [
                'year' => $year,
                'month' => $month,
                'label' => $cursor->format('F Y'),
                'prev' => ['year' => (int) $cursor->subMonth()->year, 'month' => (int) $cursor->subMonth()->month],
                'next' => ['year' => (int) $cursor->addMonth()->year, 'month' => (int) $cursor->addMonth()->month],
            ],
            'totals' => $this->ledger->totalsFrom($rows),
            'expenseBreakdown' => $this->ledger->categoryBreakdown($userId, $year, $month, 'expense'),
            'incomeBreakdown' => $this->ledger->categoryBreakdown($userId, $year, $month, 'income'),
            'entries' => TransactionPresenter::collection($rows, $categories),
            'generatedAt' => $now->toDayDateTimeString(),
        ]);
    }

    /**
     * A standalone print document.
     *
     * Rendered as plain Blade rather than the Inertia page, so printing does not
     * mean hiding navigation and neutralising tonal surfaces with a print
     * stylesheet. The paper version starts from paper.
     */
    public function print(Request $request): \Illuminate\View\View
    {
        $userId = (string) $request->user()->getKey();
        $now = CarbonImmutable::now();

        $month = max(1, min(12, (int) $request->integer('month', $now->month)));
        $year = max(2000, min((int) $now->year + 1, (int) $request->integer('year', $now->year)));
        $cursor = CarbonImmutable::create($year, $month, 1);

        $rows = Transaction::ownedBy($userId)
            ->inMonth($year, $month)
            ->orderBy('occurred_on')
            ->get();

        $categories = Category::ownedBy($userId)->get()->keyBy(fn ($c) => (string) $c->getKey());
        $currency = $request->user()->currency ?? 'INR';

        return view('reports.print', [
            'user' => $request->user(),
            'period' => [
                'year' => $year,
                'month' => $month,
                'label' => $cursor->format('F Y'),
            ],
            'totals' => $this->ledger->totalsFrom($rows),
            'expenseBreakdown' => $this->ledger->categoryBreakdown($userId, $year, $month, 'expense'),
            'incomeBreakdown' => $this->ledger->categoryBreakdown($userId, $year, $month, 'income'),
            'entries' => $rows->map(fn (Transaction $t) => [
                'date' => $t->occurred_on?->format('d M Y'),
                'category' => $categories->get((string) $t->category_id)?->name ?? 'Uncategorised',
                'note' => $t->note,
                'type' => $t->type,
                'amount' => (int) $t->amount,
            ])->values()->all(),
            'generatedAt' => $now->format('d M Y, H:i'),
            // Formatting money in the view keeps the template free of maths.
            'fmt' => fn (int $minor) => Money::symbol($currency).' '.number_format($minor / 100, 2),
        ]);
    }

    /**
     * CSV export of one month, streamed so a long history never buffers in
     * memory. Amounts are written as plain decimals because a spreadsheet is
     * the consumer here, not this application.
     */
    public function export(Request $request): StreamedResponse
    {
        $userId = (string) $request->user()->getKey();
        $now = CarbonImmutable::now();

        $month = max(1, min(12, (int) $request->integer('month', $now->month)));
        $year = max(2000, min((int) $now->year + 1, (int) $request->integer('year', $now->year)));

        $categories = Category::ownedBy($userId)->get()->keyBy(fn ($c) => (string) $c->getKey());
        $filename = sprintf('ledger-%04d-%02d.csv', $year, $month);

        return response()->streamDownload(function () use ($userId, $year, $month, $categories) {
            $handle = fopen('php://output', 'wb');

            // BOM so Excel opens UTF-8 category names correctly.
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Date', 'Type', 'Category', 'Amount', 'Note']);

            Transaction::ownedBy($userId)
                ->inMonth($year, $month)
                ->orderBy('occurred_on')
                ->chunk(500, function ($chunk) use ($handle, $categories) {
                    foreach ($chunk as $entry) {
                        fputcsv($handle, [
                            $entry->occurred_on?->format('Y-m-d'),
                            $entry->type,
                            self::safeCsv($categories->get((string) $entry->category_id)?->name ?? 'Uncategorised'),
                            Money::toDecimalString((int) $entry->amount),
                            self::safeCsv($entry->note ?? ''),
                        ]);
                    }
                });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * Neutralise CSV formula injection.
     *
     * Quoting is not enough: Excel, LibreOffice and Google Sheets all evaluate a
     * cell beginning with = + - @ or a control character as a formula, even when
     * that cell came from a quoted CSV field. A note of `=1+1` is harmless, but
     * `=HYPERLINK(...)` or a DDE payload in the same position is not — and the
     * text came from user input, so it must be assumed hostile.
     *
     * Prefixing with an apostrophe is the standard mitigation: spreadsheets read
     * it as "treat the rest as literal text" and do not display it.
     */
    private static function safeCsv(string $value): string
    {
        if ($value === '') {
            return $value;
        }

        return str_contains("=+-@\t\r", $value[0]) ? "'".$value : $value;
    }
}
