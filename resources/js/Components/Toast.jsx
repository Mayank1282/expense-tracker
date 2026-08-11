import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, X, AlertTriangle } from 'lucide-react';

const ToastContext = createContext({ push: () => {} });

let nextId = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());

    const dismiss = useCallback((id) => {
        setToasts((current) => current.filter((t) => t.id !== id));

        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
    }, []);

    const push = useCallback(
        (message, tone = 'success') => {
            if (!message) return;

            const id = ++nextId;
            setToasts((current) => [...current, { id, message, tone }]);
            timers.current.set(id, setTimeout(() => dismiss(id), 4200));
        },
        [dismiss]
    );

    // Clear pending timers on unmount so a navigation mid-toast cannot fire a
    // setState against a torn-down tree.
    useEffect(() => {
        const pending = timers.current;

        return () => {
            pending.forEach(clearTimeout);
            pending.clear();
        };
    }, []);

    const value = useMemo(() => ({ push }), [push]);

    return (
        <ToastContext.Provider value={value}>
            {children}

            <div
                className="no-print fixed bottom-20 right-3 z-[60] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-2 sm:bottom-4 sm:right-4"
                role="status"
                aria-live="polite"
            >
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className="flex items-start gap-2.5 rounded-[var(--radius-md)] p-4 shadow-xl"
                        style={{
                            backgroundColor:
                                toast.tone === 'error' ? 'var(--error-container)' : 'var(--surface-highest)',
                            color:
                                toast.tone === 'error'
                                    ? 'var(--on-error-container)'
                                    : 'var(--on-surface)',
                        }}
                    >
                        {toast.tone === 'error' ? (
                            <AlertTriangle size={18} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                        ) : (
                            <CheckCircle2 size={18} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                        )}

                        <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>

                        <button
                            type="button"
                            onClick={() => dismiss(toast.id)}
                            aria-label="Dismiss"
                            className="state shrink-0 rounded-full p-1"
                        >
                            <X size={16} strokeWidth={3} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    return useContext(ToastContext);
}
