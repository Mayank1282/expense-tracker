import { Link, useForm } from '@inertiajs/react';
import AuthLayout from '../../Layouts/AuthLayout';
import { Btn, Field, PasswordField } from '../../Components/Ui';

const CURRENCIES = [
    { code: 'INR', label: '₹ Indian Rupee' },
    { code: 'USD', label: '$ US Dollar' },
    { code: 'EUR', label: '€ Euro' },
    { code: 'GBP', label: '£ Pound Sterling' },
];

export default function Register() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        currency: 'INR',
    });

    const submit = (event) => {
        event.preventDefault();
        post('/register');
    };

    return (
        <AuthLayout
            title="Create account"
            eyebrow="Open a ledger"
            footer={
                <>
                    Already have one?{' '}
                    <Link href="/login" className="font-bold underline underline-offset-4">
                        Sign in
                    </Link>
                </>
            }
        >
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                <Field
                    label="Name"
                    name="name"
                    autoComplete="name"
                    required
                    autoFocus
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    error={errors.name}
                />

                <Field
                    label="Email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                />

                <Field label="Currency" error={errors.currency}>
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

                <PasswordField
                    label="Password"
                    name="password"
                    autoComplete="new-password"
                    required
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    hint="At least 8 characters."
                />

                <PasswordField
                    label="Confirm password"
                    name="password_confirmation"
                    autoComplete="new-password"
                    required
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                />

                <Btn type="submit" disabled={processing} className="w-full">
                    {processing ? 'Creating…' : 'Create account'}
                </Btn>

                <p className="font-mono text-xs text-[var(--on-surface-variant)]">
                    A starter set of categories is created with your account. Rename or delete any of them.
                </p>
            </form>
        </AuthLayout>
    );
}
