import { useEffect, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { compactMoney, money } from '../lib/format';

/**
 * Recharts, restyled to Material.
 *
 * Solid tonal fills, softly rounded bar caps, hairline axes in the outline
 * colour, and a horizontal-only grid — the chart should read as part of the
 * same surface system as the cards around it, not as a separate widget.
 * Colours come from the theme tokens rather than hex literals, so the chart
 * follows the light/dark switch with the rest of the UI.
 */
export default function TrendChart({ data, currency = 'INR' }) {
    const tokens = useThemeTokens();

    const hasAnything = data.some((row) => row.income > 0 || row.expense > 0);

    if (!hasAnything) {
        return (
            <div className="blk-sunken grid h-56 place-items-center px-4 text-center">
                <p className="font-mono text-xs text-[var(--on-surface-variant)]">
                    Six months of history will chart here once there are entries.
                </p>
            </div>
        );
    }

    // Recharts works in major units; the integers stay authoritative and are
    // only divided at the boundary of the chart.
    const series = data.map((row) => ({
        label: row.label,
        Income: row.income / 100,
        Spent: row.expense / 100,
        netMinor: row.net,
    }));

    return (
        <div className="h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barGap={2}>
                    <CartesianGrid stroke={tokens.outline} strokeOpacity={0.6} vertical={false} />

                    <XAxis
                        dataKey="label"
                        stroke={tokens.outline}
                        tickLine={false}
                        tick={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fill: tokens.muted }}
                    />

                    <YAxis
                        stroke={tokens.outline}
                        tickLine={false}
                        width={58}
                        tick={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: tokens.muted }}
                        tickFormatter={(value) => compactMoney(value * 100, currency)}
                    />

                    <Tooltip
                        cursor={{ fill: tokens.ink, fillOpacity: 0.05, radius: 8 }}
                        content={<HardTooltip currency={currency} />}
                    />

                    <Legend
                        wrapperStyle={{
                            fontFamily: 'IBM Plex Mono',
                            fontSize: 11,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                        }}
                    />

                    <Bar dataKey="Income" fill={tokens.accent} radius={[6, 6, 0, 0]} maxBarSize={38} />

                    <Bar dataKey="Spent" fill={tokens.violet} radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

function HardTooltip({ active, payload, label, currency }) {
    if (!active || !payload?.length) {
        return null;
    }

    const net = payload[0]?.payload?.netMinor ?? 0;

    return (
        <div className="blk p-2.5">
            <p className="eyebrow mb-1.5">{label}</p>

            {payload.map((entry) => (
                <p key={entry.dataKey} className="tnum flex items-center gap-2 font-mono text-xs">
                    <span
                        aria-hidden
                        className="inline-block size-2.5 rounded-full"
                        style={{ background: entry.color }}
                    />
                    {entry.dataKey}: {money(Math.round(entry.value * 100), currency)}
                </p>
            ))}

            <p className="tnum mt-1.5 border-t border-[var(--outline-variant)] pt-1.5 font-mono text-xs font-semibold">
                Net: {money(net, currency)}
            </p>
        </div>
    );
}

/**
 * Recharts needs literal colour values, not CSS variables, so the current token
 * values are read off the document once per theme change.
 */
export function useThemeTokens() {
    const [tokens, setTokens] = useState(readTokens);

    useEffect(() => {
        const observer = new MutationObserver(() => setTokens(readTokens()));

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    return tokens;
}

function readTokens() {
    if (typeof window === 'undefined') {
        return { ink: '#161D1B', muted: '#3F4945', accent: '#00695A', violet: '#6750A4', alert: '#BA1A1A' };
    }

    const styles = getComputedStyle(document.documentElement);
    const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;

    return {
        ink: read('--on-surface', '#161D1B'),
        muted: read('--on-surface-variant', '#3F4945'),
        accent: read('--primary', '#00695A'),
        violet: read('--tertiary', '#6750A4'),
        alert: read('--error', '#BA1A1A'),
        outline: read('--outline-variant', '#BFC9C4'),
    };
}
