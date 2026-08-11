<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Every amount in this application is an integer number of minor units.
 *
 * Project 3 shipped three separate money bugs, all of which came from doing
 * arithmetic on floats and rounding late. The rule here is simpler because the
 * domain is simpler: parse to an integer once at the edge, never convert back
 * until render time.
 */
final class Money
{
    public const SCALE = 100;

    /** Largest amount accepted: ₹10,000,000.00 — beyond personal-finance range. */
    public const MAX_MINOR = 1_000_000_000;

    /**
     * Parse user input ("1,250.50", "1250.5", 1250.5) into minor units.
     *
     * Rounds half-up on the final digit only. Anything unparseable or out of
     * range throws rather than silently becoming 0, because a silent zero in a
     * ledger is worse than a rejected form.
     */
    public static function toMinor(int|float|string $value): int
    {
        if (is_string($value)) {
            $value = trim(str_replace([',', ' ', "\u{00A0}"], '', $value));

            if ($value === '' || ! is_numeric($value)) {
                throw new InvalidArgumentException('Amount is not a number.');
            }
        }

        $minor = (int) round(((float) $value) * self::SCALE);

        if ($minor < 0) {
            throw new InvalidArgumentException('Amount cannot be negative.');
        }

        if ($minor > self::MAX_MINOR) {
            throw new InvalidArgumentException('Amount is out of range.');
        }

        return $minor;
    }

    /** Minor units back to a plain decimal string for form fields. */
    public static function toDecimalString(int $minor): string
    {
        return number_format($minor / self::SCALE, 2, '.', '');
    }

    public static function toFloat(int $minor): float
    {
        return $minor / self::SCALE;
    }

    /** Currency symbol for server-rendered output (the print sheet). */
    public static function symbol(string $currency = 'INR'): string
    {
        return match ($currency) {
            'USD' => '$',
            'EUR' => '€',
            'GBP' => '£',
            default => '₹',
        };
    }
}
