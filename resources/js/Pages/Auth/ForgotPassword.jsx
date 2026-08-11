import { Link, useForm, usePage } from '@inertiajs/react';
import AuthLayout from '../../Layouts/AuthLayout';
import { Btn, Field } from '../../Components/Ui';

export default function ForgotPassword() {
    const { flash } = usePage().props;
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    const submit = (event) => {
        event.preventDefault();
        post('/forgot-password');
    };

    return (
        <AuthLayout
            title="Reset password"
            eyebrow="Locked out"
            footer={
                <Link href="/login" className="font-bold underline underline-offset-4">
                    Back to sign in
                </Link>
            }
        >
            {flash?.success ? (
                <div className="blk-flat border-[var(--primary)] bg-[var(--primary)] p-3 text-[var(--on-primary)]">
                    <p className="text-sm font-bold">{flash.success}</p>
                    <p className="mt-1 font-mono text-xs">
                        Check spam if it has not arrived in a minute. The link is good for 60 minutes.
                    </p>
                </div>
            ) : (
                <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                    <p className="text-sm leading-relaxed text-[var(--on-surface-variant)]">
                        Enter the address on the account and we will send a link to choose a new
                        password.
                    </p>

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

                    <Btn type="submit" disabled={processing} className="w-full">
                        {processing ? 'Sending…' : 'Send reset link'}
                    </Btn>
                </form>
            )}
        </AuthLayout>
    );
}
