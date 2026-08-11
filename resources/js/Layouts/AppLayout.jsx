import { useEffect, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    LayoutDashboard,
    ArrowLeftRight,
    Tags,
    FileBarChart,
    Calculator,
    Blocks,
    Moon,
    Sun,
    LogOut,
    User,
    Menu,
    X,
} from 'lucide-react';
import { useTheme } from '../theme';
import { useToast } from '../Components/Toast';

const NAV = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/transactions', label: 'Ledger', icon: ArrowLeftRight },
    { href: '/categories', label: 'Categories', icon: Tags },
    { href: '/reports/monthly', label: 'Report', icon: FileBarChart },
    { href: '/chain', label: 'Chain', icon: Blocks },
    { href: '/emi', label: 'EMI', icon: Calculator },
];

export default function AppLayout({ title, children, actions }) {
    const { auth, flash } = usePage().props;
    const { url } = usePage();
    const { theme, toggle } = useTheme();
    const { push } = useToast();
    const [menuOpen, setMenuOpen] = useState(false);

    // Laravel's flash bag is the single source of feedback; the client never
    // invents a success message it did not receive from the server.
    useEffect(() => {
        if (flash?.success) push(flash.success, 'success');
        if (flash?.error) push(flash.error, 'error');
    }, [flash, push]);

    // Any navigation closes the drawer, including browser back.
    useEffect(() => router.on('navigate', () => setMenuOpen(false)), []);

    const isActive = (href) => url === href || url.startsWith(`${href}?`);

    // The EMI calculator is reachable without an account, so this layout has to
    // render for a guest too. It drops to a plain header rather than showing a
    // sidebar of links that would all bounce off the auth middleware.
    if (!auth.user) {
        return (
            <GuestShell title={title} theme={theme} onToggleTheme={toggle}>
                {children}
            </GuestShell>
        );
    }

    return (
        <div className="min-h-dvh">
            <Head title={title} />

            {/* ---------------- Desktop sidebar ---------------- */}
            <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--outline-variant)] bg-[var(--surface-low)] lg:flex">
                <Brand />

                <nav className="flex flex-1 flex-col gap-2 p-3" aria-label="Main">
                    {NAV.map((item) => (
                        <NavItem key={item.href} item={item} active={isActive(item.href)} />
                    ))}
                </nav>

                <div className="border-t border-[var(--outline-variant)] p-3">
                    <AccountBlock user={auth.user} theme={theme} onToggleTheme={toggle} />
                </div>
            </aside>

            {/* ---------------- Mobile top bar ---------------- */}
            <header className="no-print surface-glass sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-[var(--outline-variant)] px-3 lg:hidden">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <Mark />
                    <span className="text-base font-bold tracking-tight">LEDGER</span>
                </Link>

                <div className="flex items-center gap-2">
                    <IconButton
                        onClick={toggle}
                        label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                    >
                        {theme === 'dark' ? <Sun size={18} strokeWidth={2.5} /> : <Moon size={18} strokeWidth={2.5} />}
                    </IconButton>

                    <IconButton onClick={() => setMenuOpen((v) => !v)} label="Account menu" expanded={menuOpen}>
                        {menuOpen ? <X size={18} strokeWidth={3} /> : <Menu size={18} strokeWidth={3} />}
                    </IconButton>
                </div>
            </header>

            {menuOpen && (
                <div className="no-print surface-glass fixed inset-x-0 top-16 z-40 border-b border-[var(--outline-variant)] p-3 lg:hidden">
                    <AccountBlock user={auth.user} theme={theme} onToggleTheme={toggle} showThemeToggle={false} />
                </div>
            )}

            {/* ---------------- Page ---------------- */}
            <div className="lg:pl-64">
                <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 sm:px-5 sm:pt-6 lg:pb-10">
                    {(title || actions) && (
                        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                            <h1 className="display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
                            {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
                        </div>
                    )}

                    {children}
                </div>
            </div>

            {/* ---------------- Mobile bottom nav ---------------- */}
            <nav
                className="no-print surface-glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-[var(--outline-variant)] lg:hidden"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                aria-label="Main"
            >
                {NAV.map((item) => {
                    const active = isActive(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            className="flex min-h-[58px] flex-col items-center justify-center gap-1 pt-1.5"
                            style={{ color: active ? 'var(--on-secondary-container)' : 'var(--on-surface-variant)' }}
                        >
                            <span
                                className="grid h-7 w-14 place-items-center rounded-full transition-colors"
                                style={{ background: active ? 'var(--secondary-container)' : 'transparent' }}
                            >
                                <item.icon size={19} strokeWidth={active ? 2.4 : 2} aria-hidden />
                            </span>
                            <span className="text-[0.625rem] font-semibold tracking-wide">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

function GuestShell({ title, theme, onToggleTheme, children }) {
    return (
        <div className="min-h-dvh">
            <Head title={title} />

            <header className="surface-glass sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-[var(--outline-variant)] px-4 py-3">
                <Link href="/" className="flex items-center gap-2">
                    <Mark />
                    <span className="text-lg font-bold tracking-tight">LEDGER</span>
                </Link>

                <div className="flex items-center gap-2">
                    <IconButton
                        onClick={onToggleTheme}
                        label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                    >
                        {theme === 'dark' ? <Sun size={18} strokeWidth={2.5} /> : <Moon size={18} strokeWidth={2.5} />}
                    </IconButton>

                    <Link href="/login" className="btn btn-primary">
                        Sign in
                    </Link>
                </div>
            </header>

            <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-5">
                <h1 className="mb-5 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
                {children}
            </div>
        </div>
    );
}

function Brand() {
    return (
        <div className="flex items-center gap-2.5 px-5 py-5">
            <Mark />
            <div>
                <p className="text-lg font-bold leading-none tracking-tight">LEDGER</p>
                <p className="eyebrow mt-1">Expense Tracker</p>
            </div>
        </div>
    );
}

/** The mark is the app's shape language in miniature: an extruded block. */
function Mark() {
    return (
        <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--on-primary)]"
            style={{
                background:
                    'linear-gradient(160deg, color-mix(in oklab, #fff 26%, transparent), transparent 55%), var(--primary)',
                boxShadow:
                    'inset 0 1px 0 rgb(255 255 255 / 0.4), 0 3px 10px -3px color-mix(in oklab, var(--primary) 60%, transparent)',
            }}
        >
            <span className="font-mono text-sm font-bold">₹</span>
        </span>
    );
}

function NavItem({ item, active }) {
    return (
        <Link
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className="state flex min-h-[48px] items-center gap-3 rounded-full px-4 text-sm font-semibold transition-colors"
            style={{
                background: active ? 'var(--secondary-container)' : 'transparent',
                color: active ? 'var(--on-secondary-container)' : 'var(--on-surface-variant)',
            }}
        >
            <item.icon size={17} strokeWidth={2.5} aria-hidden />
            {item.label}
        </Link>
    );
}

function AccountBlock({ user, theme, onToggleTheme, showThemeToggle = true }) {
    return (
        <div className="flex flex-col gap-2">
            <Link
                href="/profile"
                className="state flex min-h-[52px] items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-container)] px-3"
            >
                <User size={16} strokeWidth={2.5} aria-hidden />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold leading-tight">{user?.name}</span>
                    <span className="block truncate font-mono text-[0.625rem] text-[var(--on-surface-variant)]">
                        {user?.email}
                    </span>
                </span>
            </Link>

            <div className="flex gap-2">
                {showThemeToggle && (
                    <button
                        type="button"
                        onClick={onToggleTheme}
                        className="btn btn-ghost flex-1"
                        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                    >
                        {theme === 'dark' ? <Sun size={16} strokeWidth={2.5} /> : <Moon size={16} strokeWidth={2.5} />}
                    </button>
                )}

                <Link
                    href="/logout"
                    method="post"
                    as="button"
                    className="btn btn-ghost flex-1"
                    aria-label="Sign out"
                >
                    <LogOut size={16} strokeWidth={2.5} />
                </Link>
            </div>
        </div>
    );
}

function IconButton({ children, label, expanded, ...props }) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-expanded={expanded}
            className="state grid size-11 place-items-center rounded-full text-[var(--on-surface-variant)]"
            {...props}
        >
            {children}
        </button>
    );
}
