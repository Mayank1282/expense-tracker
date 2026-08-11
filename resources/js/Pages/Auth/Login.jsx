import { Link, useForm } from '@inertiajs/react';
import AuthLayout from '../../Layouts/AuthLayout';
import { Btn, Field, PasswordField } from '../../Components/Ui';

export default function Login({ canRegister }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
    });

    const submit = (event) => {
        event.preventDefault();
        post('/login');
    };

    return (
        <AuthLayout
            title="Sign in"
            eyebrow="Welcome back"
            footer={
                canRegister && (
                    <>
                        No account yet?{' '}
                        <Link href="/register" className="font-bold underline underline-offset-4">
                            Create one
                        </Link>
                    </>
                )
            }
        >
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                <Field
                    label="Email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    autoFocus
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                />

                <PasswordField
                    label="Password"
                    name="password"
                    autoComplete="current-password"
                    required
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                />

                <div className="flex justify-end">
                    <Link
                        href="/forgot-password"
                        className="text-sm font-semibold text-[var(--primary)]"
                    >
                        Forgot password?
                    </Link>
                </div>

                <Btn type="submit" disabled={processing} className="w-full">
                    {processing ? 'Signing in…' : 'Sign in'}
                </Btn>
            </form>
        </AuthLayout>
    );
}
