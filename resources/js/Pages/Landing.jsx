import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    Calculator,
    FileDown,
    Moon,
    PieChart,
    ShieldCheck,
    Sun,
    Target,
    TrendingUp,
    Zap,
} from 'lucide-react';
import Ambient3D from '../3d/Ambient3D';
import { IsoSlab } from '../Components/IsoStat';
import { useTheme } from '../theme';

export default function Landing({ isAuthenticated }) {
    const { theme, toggle } = useTheme();

    return (
        <div className="min-h-dvh">
            <Head title="Ledger — Personal Expense Tracker" />

            <header className="surface-glass sticky top-0 z-30 border-b border-[var(--outline-variant)]">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <Mark />
                        <span className="text-lg font-bold tracking-tight">Ledger</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={toggle}
                            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                            className="state grid size-11 place-items-center rounded-full text-[var(--on-surface-variant)]"
                        >
                            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
                        </button>

                        <Link href="/emi" className="btn btn-text hidden sm:inline-flex">
                            EMI tool
                        </Link>

                        <Link href={isAuthenticated ? '/dashboard' : '/login'} className="btn btn-primary">
                            {isAuthenticated ? 'Open ledger' : 'Sign in'}
                        </Link>
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-20">
                {/* -------------------- Hero -------------------- */}
                <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
                    <div>
                        <span className="tag mb-5 rounded-full">
                            <TrendingUp size={13} />
                            Personal finance · single user
                        </span>

                        {/* `display` gives the descenders room — a tight line-height
                            on a 60px heading clips the tail of the 'p' in rupee. */}
                        <h1 className="display text-[2.75rem] font-bold tracking-tight sm:text-6xl">
                            Every rupee,
                            <br />
                            <span className="text-[var(--primary)]">on the record.</span>
                        </h1>

                        <p className="mt-6 max-w-md text-base leading-relaxed text-[var(--on-surface-variant)]">
                            A plain, fast expense tracker. Log income and spending, watch the monthly
                            balance, and work out an EMI before you commit to it — nothing else.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link href={isAuthenticated ? '/dashboard' : '/register'} className="btn btn-primary">
                                {isAuthenticated ? 'Go to dashboard' : 'Start tracking'}
                                <ArrowRight size={17} />
                            </Link>

                            <Link href="/emi" className="btn btn-tonal">
                                <Calculator size={17} />
                                EMI calculator
                            </Link>
                        </div>
                    </div>

                    {/* The WebGL layer. `min-h` on the wrapper is what stops the
                        fallback collapsing to nothing when the canvas is skipped. */}
                    <Ambient3D
                        className="h-[340px] w-full sm:h-[440px]"
                        fallback={<HeroCard />}
                    />
                </section>

                {/* -------------------- What it does for you -------------------- */}
                <section className="mt-24">
                    <h2 className="display text-3xl font-bold tracking-tight sm:text-4xl">
                        Everything you need. Nothing you don't.
                    </h2>
                    <p className="mt-3 max-w-lg text-[var(--on-surface-variant)]">
                        Built for one person keeping an honest record of their own money.
                    </p>

                    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        <Feature
                            icon={Zap}
                            title="Log it in seconds"
                            body="Amount, date, category, a short note. Income or expense in the same two taps, with the date already filled in."
                        />
                        <Feature
                            icon={PieChart}
                            title="See where it actually goes"
                            body="A monthly breakdown by category, ranked biggest first, so the surprises show up while you can still do something about them."
                        />
                        <Feature
                            icon={Target}
                            title="Set a budget, watch the bar"
                            body="Give any spending category a monthly limit. The dashboard shows how close you are, and turns red before you find out the hard way."
                        />
                        <Feature
                            icon={Calculator}
                            title="Know before you borrow"
                            body="Work out an EMI as you type, with the full month-by-month schedule and exactly how much of it is interest."
                        />
                        <Feature
                            icon={FileDown}
                            title="Take your records with you"
                            body="Print a clean monthly statement, or export the month to CSV that opens correctly in any spreadsheet."
                        />
                        <Feature
                            icon={ShieldCheck}
                            title="A record you can trust"
                            body="Every change is written to an append-only audit chain. Alter a past entry and verification tells you exactly where."
                        />
                    </div>
                </section>

                {/* -------------------- Close -------------------- */}
                <section className="blk mt-20 p-8 text-center sm:p-12">
                    <h2 className="display text-2xl font-bold tracking-tight sm:text-3xl">
                        Start with this month.
                    </h2>
                    <p className="mx-auto mt-3 max-w-md text-[var(--on-surface-variant)]">
                        No bank connection, no card, no setup. Add your first entry and the numbers
                        start telling you something.
                    </p>

                    <Link
                        href={isAuthenticated ? '/dashboard' : '/register'}
                        className="btn btn-primary mt-7"
                    >
                        {isAuthenticated ? 'Go to dashboard' : 'Create a free account'}
                        <ArrowRight size={17} />
                    </Link>
                </section>
            </main>

            <footer className="mt-12 border-t border-[var(--outline-variant)] px-4 py-8 text-center">
                <p className="text-sm text-[var(--on-surface-variant)]">
                    Ledger — track income, spending, budgets and EMIs. Your records, your device,
                    nobody else's business.
                </p>
            </footer>
        </div>
    );
}

function Mark() {
    return (
        <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--on-primary)]"
            style={{
                background:
                    'linear-gradient(160deg, color-mix(in oklab, #fff 26%, transparent), transparent 55%), var(--primary)',
                boxShadow:
                    'inset 0 1px 0 rgb(255 255 255 / 0.4), 0 4px 12px -4px color-mix(in oklab, var(--primary) 60%, transparent)',
            }}
        >
            <span className="font-mono text-base font-bold">₹</span>
        </span>
    );
}

function Feature({ icon: Icon, title, body }) {
    return (
        <div className="blk p-6">
            <div
                className="mb-4 grid size-12 place-items-center rounded-[var(--radius-md)]"
                style={{ background: 'var(--primary-container)', color: 'var(--on-primary-container)' }}
            >
                <Icon size={21} />
            </div>
            <h3 className="mb-2 text-lg font-bold tracking-tight">{title}</h3>
            <p className="text-sm leading-relaxed text-[var(--on-surface-variant)]">{body}</p>
        </div>
    );
}

/**
 * Shown wherever WebGL is unavailable, the viewport is small, or motion is
 * reduced. It is a finished composition in its own right — most phones will
 * only ever see this, so it cannot look like something failed to load.
 */
function HeroCard() {
    const rows = [
        { label: 'Rent', value: '28,000.00', pct: 56, color: 'var(--tertiary)' },
        { label: 'Groceries', value: '11,293.98', pct: 23, color: 'var(--primary)' },
        { label: 'Eating out', value: '5,726.77', pct: 11, color: 'var(--secondary)' },
    ];

    return (
        <IsoSlab depth={22} maxTilt={7} className="w-full max-w-md">
            <div className="p-6">
                <p className="eyebrow">Net this month</p>

                <p className="tnum mt-1 font-mono text-4xl font-semibold text-[var(--primary)]">
                    ₹81,682.75
                </p>

                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                    Income ₹1,31,947 · Spent ₹50,264
                </p>

                <div className="mt-6 flex flex-col gap-4">
                    {rows.map((row) => (
                        <div key={row.label}>
                            <div className="mb-1.5 flex items-baseline justify-between gap-3">
                                <span className="text-sm font-semibold">{row.label}</span>
                                <span className="tnum font-mono text-sm text-[var(--on-surface-variant)]">
                                    ₹{row.value}
                                </span>
                            </div>

                            <div className="track">
                                <span style={{ width: `${row.pct}%`, background: row.color }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </IsoSlab>
    );
}
