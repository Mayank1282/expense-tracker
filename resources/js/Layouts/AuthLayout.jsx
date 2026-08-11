import { Head, Link } from '@inertiajs/react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme';

export default function AuthLayout({ title, eyebrow, children, footer }) {
    const { theme, toggle } = useTheme();

    // An even split left the form marooned in a wide empty half. The poster is
    // now the minor column and the form column is wider, so the two sides carry
    // comparable visual weight.
    return (
        <div className="grid min-h-dvh lg:grid-cols-[42fr_58fr] xl:grid-cols-[38fr_62fr]">
            <Head title={title} />

            {/* Poster panel. Hidden below lg — on a phone the form is the page. */}
            <aside className="relative hidden flex-col justify-between gap-10 p-10 text-[var(--on-primary-container)] lg:flex xl:p-12"
                style={{
                    background:
                        'radial-gradient(40rem 30rem at 20% 10%, color-mix(in oklab, var(--primary) 40%, transparent), transparent 60%), var(--primary-container)',
                }}>
                <Link href="/" className="flex items-center gap-2">
                    <span className="grid size-10 place-items-center rounded-[var(--radius-md)] border border-current/40">
                        <span className="font-mono text-base font-bold">₹</span>
                    </span>
                    <span className="text-lg font-bold tracking-tight">LEDGER</span>
                </Link>

                <div>
                    <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] opacity-70">
                        Personal finance
                    </p>
                    <p className="display mt-4 max-w-sm text-4xl font-bold tracking-tight">
                        Write it down and the month stops being a mystery.
                    </p>
                </div>

                {/* A month, drawn. The sentence above made literal: every day
                    shaded by what was spent, so the shape of the month is
                    readable at a glance. A bare "less → more" key said nothing;
                    real figures and the days of the week say what it is. */}
                <div className="rounded-[var(--radius-xl)] border border-current/15 bg-current/5 p-6 backdrop-blur-sm">
                    <div className="mb-4 flex items-baseline justify-between gap-3">
                        <p className="text-sm font-bold">March, at a glance</p>
                        <p className="font-mono text-xs opacity-70">30 days · 68 entries</p>
                    </div>

                    <MonthGrid />

                    <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-current/15 pt-4">
                        {[
                            ['Earned', '₹1,31,947'],
                            ['Spent', '₹50,264'],
                            ['Kept', '₹81,682'],
                        ].map(([label, value]) => (
                            <div key={label}>
                                <dt className="font-mono text-[0.625rem] uppercase tracking-[0.14em] opacity-65">
                                    {label}
                                </dt>
                                <dd className="tnum mt-1 font-mono text-sm font-semibold">{value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </aside>

            <main className="flex items-center justify-center px-4 py-10">
                <div className="w-full max-w-md">
                    <div className="mb-6 flex items-start justify-between gap-3">
                        <div>
                            {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
                            <h1 className="display text-3xl font-bold tracking-tight">{title}</h1>
                        </div>

                        <button
                            type="button"
                            onClick={toggle}
                            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                            className="state grid size-11 shrink-0 place-items-center rounded-full text-[var(--on-surface-variant)]"
                        >
                            {theme === 'dark' ? <Sun size={18} strokeWidth={2.5} /> : <Moon size={18} strokeWidth={2.5} />}
                        </button>
                    </div>

                    <div className="blk p-6 sm:p-8">{children}</div>

                    {footer && <div className="mt-5 text-center text-sm">{footer}</div>}
                </div>
            </main>
        </div>
    );
}

/**
 * A month of spending as a heat grid.
 *
 * The pattern is fixed rather than random so the panel looks the same on every
 * visit — a login screen that reshuffles itself on each render reads as noise,
 * not as data. Weekends run hotter and the 1st carries rent, which is what
 * makes the shape recognisable as a real month rather than static.
 */
function MonthGrid() {
    const days = Array.from({ length: 35 }, (_, i) => {
        const day = i - 2; // month starts mid-week
        if (day < 1 || day > 30) return null;

        const weekday = (i % 7 + 7) % 7;
        const weekend = weekday === 5 || weekday === 6;

        let weight = 0.16 + ((day * 37) % 11) / 26;
        if (weekend) weight += 0.3;
        if (day === 1) weight = 1; // rent

        return { day, weight: Math.min(weight, 1) };
    });

    return (
        <div aria-hidden>
            <div className="mb-1.5 grid grid-cols-7 gap-1.5">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <span
                        key={i}
                        className="text-center font-mono text-[0.625rem] font-semibold opacity-55"
                    >
                        {d}
                    </span>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
                {days.map((cell, i) =>
                    cell ? (
                        <span
                            key={i}
                            className="aspect-square rounded-[6px] bg-current"
                            style={{ opacity: 0.14 + cell.weight * 0.78 }}
                        />
                    ) : (
                        <span key={i} className="aspect-square" />
                    )
                )}
            </div>
        </div>
    );
}
