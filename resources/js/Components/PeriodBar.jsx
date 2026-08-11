import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Month stepper, shared by the dashboard and the monthly report.
 *
 * It lives here rather than in Dashboard.jsx on purpose: importing it from a
 * page component makes that entire page — and everything it pulls in, Recharts
 * included — a dependency of whichever other page borrows it.
 */
export default function PeriodBar({ period, basePath }) {
    return (
        <div className="blk-flat flex items-center justify-between gap-2 p-2">
            <Link
                href={`${basePath}?year=${period.prev.year}&month=${period.prev.month}`}
                className="btn btn-ghost"
                aria-label="Previous month"
                preserveScroll
            >
                <ChevronLeft size={16} strokeWidth={3} />
                <span className="hidden sm:inline">Prev</span>
            </Link>

            <div className="text-center">
                <p className="eyebrow">Period</p>
                <p className="text-base font-bold tracking-tight sm:text-lg">{period.label}</p>
            </div>

            <Link
                href={`${basePath}?year=${period.next.year}&month=${period.next.month}`}
                className="btn btn-ghost"
                aria-label="Next month"
                preserveScroll
            >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight size={16} strokeWidth={3} />
            </Link>
        </div>
    );
}
