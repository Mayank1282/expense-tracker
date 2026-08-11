import { useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import AppLayout from '../Layouts/AppLayout';
import { Block, Btn, Field, PasswordField, SectionTitle } from '../Components/Ui';

const CURRENCIES = [
    { code: 'INR', label: '₹ Indian Rupee' },
    { code: 'USD', label: '$ US Dollar' },
    { code: 'EUR', label: '€ Euro' },
    { code: 'GBP', label: '£ Pound Sterling' },
];

export default function Profile({ stats }) {
    const { auth } = usePage().props;

    return (
        <AppLayout title="Profile">
            <div className="grid gap-3 sm:grid-cols-3">
                <StatTile label="Entries" value={stats.transactions} />
                <StatTile label="Categories" value={stats.categories} />
                <StatTile label="Tracking since" value={stats.since ?? '—'} />
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <DetailsForm user={auth.user} />
                <PasswordForm />
            </div>

            <DangerZone />
        </AppLayout>
    );
}

function StatTile({ label, value }) {
    return (
        <div className="blk p-4">
            <p className="eyebrow">{label}</p>
            <p className="tnum mt-1 font-mono text-2xl font-semibold">{value}</p>
        </div>
    );
}

function DetailsForm({ user }) {
    const { data, setData, put, processing, errors } = useForm({
        name: user.name,
        email: user.email,
        currency: user.currency,
    });

    const submit = (event) => {
        event.preventDefault();
        put('/profile', { preserveScroll: true });
    };

    return (
        <Block className="p-4 sm:p-5">
            <SectionTitle eyebrow="Account" title="Details" />

            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                <Field
                    label="Name"
                    required
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    error={errors.name}
                />

                <Field
                    label="Email"
                    type="email"
                    required
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                />

                <Field label="Currency" error={errors.currency} hint="Changes how every amount is displayed. Stored values are untouched.">
                    {(props) => (
                        <select
                            {...props}
                            className="field"
                            value={data.currency}
                            onChange={(e) => setData('currency', e.target.value)}
                        >
                            {CURRENCIES.map((currency) => (
                                <option key={currency.code} value={currency.code}>
                                    {currency.label}
                                </option>
                            ))}
                        </select>
                    )}
                </Field>

                <Btn type="submit" disabled={processing} className="self-start">
                    {processing ? 'Saving…' : 'Save details'}
                </Btn>
            </form>
        </Block>
    );
}

function PasswordForm() {
    const { data, setData, put, processing, errors, reset } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (event) => {
        event.preventDefault();

        put('/profile/password', {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <Block className="p-4 sm:p-5">
            <SectionTitle eyebrow="Security" title="Password" />

            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                <PasswordField
                    label="Current password"
                    autoComplete="current-password"
                    required
                    value={data.current_password}
                    onChange={(e) => setData('current_password', e.target.value)}
                    error={errors.current_password}
                />

                <PasswordField
                    label="New password"
                    autoComplete="new-password"
                    required
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    hint="At least 8 characters."
                />

                <PasswordField
                    label="Confirm new password"
                    autoComplete="new-password"
                    required
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                />

                <Btn type="submit" disabled={processing} className="self-start">
                    {processing ? 'Updating…' : 'Change password'}
                </Btn>
            </form>
        </Block>
    );
}

function DangerZone() {
    const [confirming, setConfirming] = useState(false);

    const { data, setData, delete: destroy, processing, errors, reset } = useForm({ password: '' });

    const submit = (event) => {
        event.preventDefault();
        destroy('/profile');
    };

    return (
        <Block className="mt-5 border-[var(--error)] p-4 sm:p-5">
            <SectionTitle eyebrow="Irreversible" title="Delete account" />

            <p className="mb-4 max-w-xl text-sm text-[var(--on-surface-variant)]">
                This erases your account, every transaction, and every category. Unlike a booking
                platform there is no counterparty holding a copy — once it is gone, it is gone.
            </p>

            {!confirming ? (
                <Btn variant="danger" onClick={() => setConfirming(true)}>
                    Delete my account
                </Btn>
            ) : (
                <form onSubmit={submit} className="flex flex-col gap-3 sm:max-w-sm" noValidate>
                    <PasswordField
                        label="Confirm with your password"
                        autoComplete="current-password"
                        required
                        autoFocus
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        error={errors.password}
                    />

                    <div className="flex gap-2">
                        <Btn
                            variant="ghost"
                            type="button"
                            className="flex-1"
                            onClick={() => {
                                reset();
                                setConfirming(false);
                            }}
                        >
                            Cancel
                        </Btn>
                        <Btn variant="danger" type="submit" disabled={processing} className="flex-1">
                            {processing ? 'Erasing…' : 'Erase everything'}
                        </Btn>
                    </div>
                </form>
            )}
        </Block>
    );
}
