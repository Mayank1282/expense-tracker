import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './theme';
import { ToastProvider } from './Components/Toast';

const appName = import.meta.env.VITE_APP_NAME || 'Ledger';

createInertiaApp({
    title: (title) => (title ? `${title} — ${appName}` : appName),

    // Lazy, not eager. With an eager glob every page — and therefore Recharts —
    // would be in the bundle the login screen downloads. Each page now arrives
    // as its own chunk when it is first visited.
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.jsx');
        const page = pages[`./Pages/${name}.jsx`];

        if (!page) {
            throw new Error(`Inertia page not found: ./Pages/${name}.jsx`);
        }

        return page();
    },

    setup({ el, App, props }) {
        createRoot(el).render(
            <ThemeProvider>
                <ToastProvider>
                    <App {...props} />
                </ToastProvider>
            </ThemeProvider>
        );
    },

    progress: {
        color: '#6D28D9',
        showSpinner: false,
    },
});
