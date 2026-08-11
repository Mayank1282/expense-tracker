import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, X } from 'lucide-react';

/* ---------------------------------------------------------------------------
   The shared vocabulary of the app.
   Every visual rule lives in app.css; these components only compose it, so a
   palette, elevation or radius change happens in exactly one place.
--------------------------------------------------------------------------- */

export function Block({ as: Tag = 'div', flat = false, className = '', children, ...props }) {
    return (
        <Tag className={`${flat ? 'blk-flat' : 'blk'} ${className}`} {...props}>
            {children}
        </Tag>
    );
}

export function SectionTitle({ eyebrow, title, action }) {
    return (
        <div className="mb-3 flex items-end justify-between gap-3">
            <div>
                {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
                <h2 className="display text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
            </div>
            {action}
        </div>
    );
}

export function Btn({ variant = 'primary', as: Tag = 'button', className = '', children, ...props }) {
    return (
        <Tag className={`btn btn-${variant} ${className}`} {...props}>
            {children}
        </Tag>
    );
}

export function Field({ label, error, hint, className = '', children, id: providedId, ...props }) {
    const generatedId = useId();
    const id = providedId ?? generatedId;
    const errorId = `${id}-error`;

    return (
        <div className={className}>
            {label && (
                <label className="label" htmlFor={id}>
                    {label}
                </label>
            )}

            {children ? (
                children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? errorId : undefined })
            ) : (
                <input
                    id={id}
                    className="field"
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? errorId : undefined}
                    {...props}
                />
            )}

            {error ? (
                <p id={errorId} className="mt-1.5 text-xs font-semibold text-[var(--error)]">
                    {error}
                </p>
            ) : hint ? (
                <p className="mt-1.5 text-xs text-[var(--on-surface-variant)]">{hint}</p>
            ) : null}
        </div>
    );
}

export function Tag_({ children, color, className = '', style }) {
    return (
        <span
            className={`tag ${className}`}
            style={{ backgroundColor: color ?? 'transparent', ...style }}
        >
            {children}
        </span>
    );
}

/** A category chip: colour swatch plus name. */
export function CategoryChip({ category, className = '' }) {
    if (!category) {
        return (
            <span className={`tag text-[var(--on-surface-variant)] ${className}`}>Uncategorised</span>
        );
    }

    return (
        <span className={`tag ${className}`}>
            <span
                aria-hidden
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: category.color }}
            />
            {category.name}
        </span>
    );
}

export function EmptyState({ icon: Icon, title, body, action }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            {Icon && (
                <div
                    className="grid size-16 place-items-center rounded-full"
                    style={{ background: 'var(--surface-highest)', color: 'var(--on-surface-variant)' }}
                >
                    <Icon size={26} strokeWidth={2} />
                </div>
            )}
            <h3 className="text-lg font-bold">{title}</h3>
            {body && <p className="max-w-sm text-sm text-[var(--on-surface-variant)]">{body}</p>}
            {action}
        </div>
    );
}

/** Skeleton rows used while an Inertia partial reload is in flight. */
export function LoadingRows({ rows = 4 }) {
    return (
        <div className="flex flex-col gap-2 p-3" aria-busy="true" aria-label="Loading">
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    key={i}
                    className="h-11 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-highest)]"
                />
            ))}
        </div>
    );
}

/**
 * Modal built on <dialog> so focus trapping, Escape, and inertness on the rest
 * of the page come from the platform rather than a hand-rolled focus manager.
 */
export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
    const ref = useRef(null);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;

        if (open && !dialog.open) {
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;

        // Escape fires `cancel`; route it through the same handler as the close
        // button so parent state never drifts out of sync with the dialog.
        const handleCancel = (event) => {
            event.preventDefault();
            onClose();
        };

        dialog.addEventListener('cancel', handleCancel);

        return () => dialog.removeEventListener('cancel', handleCancel);
    }, [onClose]);

    return (
        <dialog
            ref={ref}
            className={`m-auto w-[calc(100vw-1.5rem)] ${width} overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--outline-variant)] bg-[var(--surface-high)] p-0 text-[var(--on-surface)] shadow-2xl backdrop:bg-black/45`}
            aria-label={title}
        >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--outline-variant)] px-5 py-4">
                <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="state grid size-10 place-items-center rounded-full text-[var(--on-surface-variant)]"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        </dialog>
    );
}

/**
 * A destructive confirmation, as a modal.
 *
 * This used to be a bar appended below the table. On a full page of entries it
 * rendered off-screen — you pressed the bin icon and nothing appeared to
 * happen. A dialog cannot be missed, takes focus, and closes on Escape.
 *
 * The destructive button is NOT autofocused: the default action of a dialog
 * asking "are you sure" should never be the irreversible one.
 */
export function ConfirmDialog({
    open,
    title = 'Are you sure?',
    message,
    detail,
    confirmLabel = 'Delete',
    onConfirm,
    onCancel,
    busy,
}) {
    return (
        <Modal open={open} onClose={onCancel} title={title} width="max-w-md">
            <p className="text-sm leading-relaxed text-[var(--on-surface-variant)]">{message}</p>

            {detail && (
                <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--surface-low)] p-3">
                    {detail}
                </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
                <Btn variant="ghost" type="button" onClick={onCancel} disabled={busy}>
                    Cancel
                </Btn>
                <Btn variant="danger" type="button" onClick={onConfirm} disabled={busy}>
                    {busy ? 'Working…' : confirmLabel}
                </Btn>
            </div>
        </Modal>
    );
}

/**
 * A number input with its own up/down stepper.
 *
 * Native spinners are tiny, only appear on hover in some engines, and look like
 * a different product in each one. This one is always visible, is a real 44px
 * touch target split in two, and uses the same state layer as every other
 * control.
 *
 * Steps are applied in fixed-point rather than by adding floats: 9.5 + 0.05 in
 * binary is 9.550000000000001, which would show up in the field.
 */
export function NumberField({
    label,
    value,
    onChange,
    step = 1,
    min,
    max,
    error,
    hint,
    id: providedId,
    ...props
}) {
    const generatedId = useId();
    const id = providedId ?? generatedId;
    const errorId = `${id}-error`;

    const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;

    const nudge = (direction) => {
        const current = Number(value);
        const base = Number.isFinite(current) ? current : Number(min) || 0;

        let next = base + direction * Number(step);

        if (min !== undefined && next < Number(min)) next = Number(min);
        if (max !== undefined && next > Number(max)) next = Number(max);

        onChange(next.toFixed(decimals));
    };

    const atMin = min !== undefined && Number(value) <= Number(min);
    const atMax = max !== undefined && Number(value) >= Number(max);

    return (
        <div>
            {label && (
                <label className="label" htmlFor={id}>
                    {label}
                </label>
            )}

            <div className="relative">
                <input
                    id={id}
                    type="number"
                    className="field pr-11"
                    step={step}
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? errorId : undefined}
                    {...props}
                />

                {/* Bare arrows, no container. A bordered box here reads as a
                    second control sitting inside the field; the field already
                    provides the edge. */}
                <div className="absolute inset-y-1 right-2 flex w-6 flex-col justify-center">
                    <StepButton label={`Increase ${label ?? 'value'}`} onClick={() => nudge(1)} disabled={atMax}>
                        <ChevronUp size={15} strokeWidth={2.75} />
                    </StepButton>

                    <StepButton label={`Decrease ${label ?? 'value'}`} onClick={() => nudge(-1)} disabled={atMin}>
                        <ChevronDown size={15} strokeWidth={2.75} />
                    </StepButton>
                </div>
            </div>

            {error ? (
                <p id={errorId} className="mt-1.5 text-xs font-semibold text-[var(--error)]">
                    {error}
                </p>
            ) : hint ? (
                <p className="mt-1.5 text-xs text-[var(--on-surface-variant)]">{hint}</p>
            ) : null}
        </div>
    );
}

function StepButton({ children, label, onClick, disabled }) {
    return (
        <button
            type="button"
            tabIndex={-1}
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className="state grid flex-1 place-items-center rounded-[var(--radius-xs)] text-[var(--on-surface-variant)] transition-colors hover:text-[var(--primary)] disabled:opacity-25 disabled:hover:text-[var(--on-surface-variant)]"
        >
            {children}
        </button>
    );
}

/**
 * A password field with a reveal toggle.
 *
 * Typing a password blind is the single most common cause of a failed sign-in,
 * and on a phone keyboard it is worse. The toggle is a button rather than a
 * checkbox so it sits inside the field, and it is `tabIndex={-1}` so tabbing
 * runs straight from the password to the submit button — someone using the
 * keyboard is not trying to look at what they typed.
 *
 * The input keeps `type="password"` until revealed, so password managers and
 * autofill still recognise it.
 */
export function PasswordField({ label, error, hint, id: providedId, ...props }) {
    const generatedId = useId();
    const id = providedId ?? generatedId;
    const errorId = `${id}-error`;
    const [visible, setVisible] = useState(false);

    return (
        <div>
            {label && (
                <label className="label" htmlFor={id}>
                    {label}
                </label>
            )}

            <div className="relative">
                <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    className="field pr-11"
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? errorId : undefined}
                    {...props}
                />

                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    aria-pressed={visible}
                    className="state absolute inset-y-1 right-1.5 grid w-9 place-items-center rounded-[var(--radius-sm)] text-[var(--on-surface-variant)] transition-colors hover:text-[var(--primary)]"
                >
                    {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
            </div>

            {error ? (
                <p id={errorId} className="mt-1.5 text-xs font-semibold text-[var(--error)]">
                    {error}
                </p>
            ) : hint ? (
                <p className="mt-1.5 text-xs text-[var(--on-surface-variant)]">{hint}</p>
            ) : null}
        </div>
    );
}
