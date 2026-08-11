import { Link, useForm } from '@inertiajs/react';
import AuthLayout from '../../Layouts/AuthLayout';
import { Btn, Field, PasswordField } from '../../Components/Ui';

export default function ResetPassword({ token, email }) {
    const { data, setData, post, processing, errors } = useForm({
        token,
        email: email ?? '',
        password: '',
        password_confirmation: '',
    });

    const submit = (event) => {
        event.preventDefault();
        post('/reset-password');
    };

    return (
        <AuthLayout
            title="New password"
            eyebrow="Almost there"
            footer={
                <Link href="/login" className="font-bold underline underline-offset-4">
                    Back to sign in
                </Link>
            }
        >
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
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

                <PasswordField
                    label="New password"
                    name="password"
                    autoComplete="new-password"
                    required
                    autoFocus
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    hint="At least 8 characters."
                />

                <PasswordField
                    label="Confirm new password"
                    name="password_confirmation"
                    autoComplete="new-password"
                    required
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                />

                <Btn type="submit" disabled={processing} className="w-full">
                    {processing ? 'Saving…' : 'Set new password'}
                </Btn>
            </form>
        </AuthLayout>
    );
}
