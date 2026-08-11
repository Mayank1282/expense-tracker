import { Suspense, lazy, useEffect, useState } from 'react';

/**
 * Gatekeeper for the WebGL layer.
 *
 * The 3D is decorative, so it is allowed to cost nothing on the critical path:
 *   - lazy      — three.js lives in its own chunk (see vite.config.js) and is
 *                 never part of the initial bundle
 *   - deferred  — mounts on idle, after the page is readable and interactive
 *   - optional  — small screens, machines without WebGL, and users who asked
 *                 for reduced motion get the flat CSS fallback instead, which
 *                 is a complete design in its own right rather than a blank box
 *
 * This mirrors the guard set Project 3 used. The scene itself is a small bank
 * with rupees rising out of the doorway, physically shaded so it sits in the
 * same material language as the Material 3 surfaces around it.
 */

const BankScene = lazy(() => import('./BankScene'));

const MIN_WIDTH = 768;

function webglAvailable() {
    try {
        const canvas = document.createElement('canvas');

        return Boolean(
            window.WebGLRenderingContext &&
                (canvas.getContext('webgl2') || canvas.getContext('webgl'))
        );
    } catch {
        return false;
    }
}

export default function Ambient3D({ className = '', fallback = null }) {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        const wideEnough = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`);
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

        const decide = () => {
            if (!wideEnough.matches || reduced.matches || !webglAvailable()) {
                setEnabled(false);

                return;
            }

            // Wait for idle so first paint and hydration finish first.
            const schedule = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 400));
            schedule(() => setEnabled(true), { timeout: 2500 });
        };

        decide();

        wideEnough.addEventListener('change', decide);
        reduced.addEventListener('change', decide);

        return () => {
            wideEnough.removeEventListener('change', decide);
            reduced.removeEventListener('change', decide);
        };
    }, []);

    // The wrapper always occupies the same box whether the canvas mounts or
    // not, and the canvas gets a definite height to resolve its 100% against.
    // Handing the canvas a percentage height inside an auto-height flex parent
    // collapses it to zero — it loads, renders, and is invisible.
    return (
        <div className={`relative ${className}`}>
            {enabled ? (
                <Suspense fallback={<Centered>{fallback}</Centered>}>
                    <div className="absolute inset-0">
                        <BankScene />
                    </div>
                </Suspense>
            ) : (
                <Centered>{fallback}</Centered>
            )}
        </div>
    );
}

function Centered({ children }) {
    return <div className="absolute inset-0 flex items-center justify-center">{children}</div>;
}
