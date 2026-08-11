import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'ledger-theme';

const ThemeContext = createContext({ theme: 'light', toggle: () => {} });

function readInitialTheme() {
    if (typeof window === 'undefined') {
        return 'light';
    }

    // The blade head script has already applied the class; read it back so the
    // provider and the DOM can never disagree on the first render.
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(readInitialTheme);

    useEffect(() => {
        const isDark = theme === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // Private browsing with storage disabled — the theme still applies
            // for this session, it just will not persist.
        }
    }, [theme]);

    const toggle = useCallback(() => {
        setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
    }, []);

    const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}
