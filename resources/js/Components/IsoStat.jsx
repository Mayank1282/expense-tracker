import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The 3D layer, Material 3 style.
 *
 * The brutalist version of this component was a hard extruded solid with
 * visible side faces. That reads as a toy at small sizes. This one gets its
 * dimensionality the way a physical card does:
 *
 *   - it TILTS toward the pointer (a few degrees, never more than 7)
 *   - a specular sheen tracks the cursor across the surface, so the light has
 *     a position and the card has a curvature
 *   - content sits on a raised Z plane, so it parallaxes very slightly against
 *     the surface as the card turns
 *   - elevation lifts on hover, which is M3's own language for "raised"
 *
 * The angles are deliberately small. Past about 8° text starts to shear and
 * become harder to read, and this is a surface people read numbers off — the
 * depth is not allowed to cost legibility.
 */
export function IsoSlab({
    depth = 16,
    maxTilt = 6,
    interactive = true,
    faceColor,
    tone = 'surface',
    className = '',
    children,
}) {
    const ref = useRef(null);
    const frame = useRef(0);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [sheen, setSheen] = useState({ x: 50, y: 0, on: false });
    const reduced = usePrefersReducedMotion();
    const enabled = interactive && !reduced;

    const handleMove = useCallback(
        (event) => {
            if (!enabled || !ref.current) return;

            const rect = ref.current.getBoundingClientRect();
            const px = (event.clientX - rect.left) / rect.width;
            const py = (event.clientY - rect.top) / rect.height;

            // Coalesce to one update per frame — pointermove fires far faster
            // than the compositor can use.
            cancelAnimationFrame(frame.current);
            frame.current = requestAnimationFrame(() => {
                setTilt({
                    x: (0.5 - py) * maxTilt * 2,
                    y: (px - 0.5) * maxTilt * 2,
                });
                setSheen({ x: px * 100, y: py * 100, on: true });
            });
        },
        [enabled, maxTilt]
    );

    const handleLeave = useCallback(() => {
        cancelAnimationFrame(frame.current);
        setTilt({ x: 0, y: 0 });
        setSheen((s) => ({ ...s, on: false }));
    }, []);

    useEffect(() => () => cancelAnimationFrame(frame.current), []);

    const background =
        faceColor ??
        {
            surface: 'var(--surface-container)',
            income: 'var(--primary)',
            expense: 'var(--tertiary)',
            alert: 'var(--error)',
        }[tone];

    return (
        <div
            className={className}
            style={{ perspective: '1100px' }}
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
        >
            <div
                ref={ref}
                className="relative h-full overflow-hidden rounded-[var(--radius-xl)]"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(0)`,
                    transition: reduced
                        ? 'none'
                        : 'transform 260ms var(--ease-emphasized), box-shadow 260ms var(--ease-emphasized)',
                    background,
                    border: '1px solid var(--outline-variant)',
                    boxShadow: sheen.on
                        ? '0 2px 6px rgb(0 0 0 / 0.10), 0 18px 40px -14px rgb(0 0 0 / 0.36)'
                        : '0 1px 3px rgb(0 0 0 / 0.09), 0 10px 26px -12px rgb(0 0 0 / 0.26)',
                }}
            >
                {/* Skeuomorphic top highlight — the edge catching the light. */}
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, rgb(255 255 255 / 0.5), transparent)' }}
                />

                {/* Specular sheen following the pointer. */}
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: `radial-gradient(22rem 18rem at ${sheen.x}% ${sheen.y}%, rgb(255 255 255 / 0.16), transparent 60%)`,
                        opacity: sheen.on ? 1 : 0,
                        transition: 'opacity 260ms var(--ease-standard)',
                    }}
                />

                {/* Content on a raised plane so it parallaxes against the face. */}
                <div className="relative h-full" style={{ transform: `translateZ(${depth}px)` }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

/**
 * A headline figure on a tilting card. Used for the dashboard KPIs.
 */
export function IsoStat({ eyebrow, value, sub, tone = 'surface', icon: Icon, depth = 14 }) {
    const textColor = {
        surface: 'var(--on-surface)',
        neutral: 'var(--on-surface)',
        income: 'var(--on-primary)',
        expense: 'var(--on-tertiary)',
        alert: 'var(--on-error)',
    }[tone];

    const resolvedTone = tone === 'neutral' ? 'surface' : tone;

    return (
        <IsoSlab depth={depth} tone={resolvedTone} className="h-full">
            <div className="flex h-full flex-col gap-1.5 p-5" style={{ color: textColor }}>
                <div className="flex items-center justify-between gap-2">
                    <p className="eyebrow" style={{ color: 'currentColor', opacity: 0.75 }}>
                        {eyebrow}
                    </p>

                    {Icon && (
                        <span className="relative grid size-8 shrink-0 place-items-center" aria-hidden>
                            <span
                                className="absolute inset-0 rounded-full"
                                style={{ background: 'currentColor', opacity: 0.14 }}
                            />
                            <Icon size={16} strokeWidth={2.25} className="relative" />
                        </span>
                    )}
                </div>

                <p className="tnum font-mono text-[1.6rem] font-semibold leading-tight sm:text-3xl">
                    {value}
                </p>

                {sub && (
                    <p className="mt-auto pt-1 text-xs leading-relaxed" style={{ opacity: 0.78 }}>
                        {sub}
                    </p>
                )}
            </div>
        </IsoSlab>
    );
}

export function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(() => {
        if (typeof window === 'undefined') return false;

        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handler = (event) => setReduced(event.matches);

        query.addEventListener('change', handler);

        return () => query.removeEventListener('change', handler);
    }, []);

    return reduced;
}
