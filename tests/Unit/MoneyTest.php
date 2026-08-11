<?php

namespace Tests\Unit;

use App\Support\Money;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Project 3 shipped three money bugs, every one of them a float that rounded at
 * the wrong moment. These cases are the awkward inputs that would have caught
 * them: values that do not survive a round trip through binary floating point.
 */
class MoneyTest extends TestCase
{
    public static function amounts(): array
    {
        return [
            'plain integer' => ['1250', 125000],
            'two decimals' => ['1250.50', 125050],
            'one decimal' => ['1250.5', 125050],
            'grouped input' => ['1,25,000.75', 12500075],
            'smallest unit' => ['0.01', 1],
            'classic float trap' => ['799.99', 79999],
            'repeating third' => ['3333.33', 333333],
            'rounds half up' => ['0.005', 1],
            'rounds down below half' => ['0.004', 0],
            'float type' => [1250.5, 125050],
            'int type' => [1250, 125000],
        ];
    }

    #[Test]
    #[DataProvider('amounts')]
    public function it_parses_input_to_exact_minor_units(int|float|string $input, int $expected): void
    {
        $this->assertSame($expected, Money::toMinor($input));
    }

    #[Test]
    public function a_parsed_amount_survives_a_round_trip(): void
    {
        foreach (['799.99', '0.01', '3333.33', '1250.50', '99999.95'] as $input) {
            $minor = Money::toMinor($input);

            $this->assertSame(
                number_format((float) $input, 2, '.', ''),
                Money::toDecimalString($minor),
                "Round trip changed the value of {$input}"
            );
        }
    }

    #[Test]
    public function summing_minor_units_never_drifts(): void
    {
        // The same addition in floats gives 0.30000000000000004 and, once
        // multiplied up and truncated, a total one paisa short.
        $total = Money::toMinor('0.10') + Money::toMinor('0.20');

        $this->assertSame(30, $total);
        $this->assertSame('0.30', Money::toDecimalString($total));
    }

    #[Test]
    public function it_rejects_a_negative_amount(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Money::toMinor('-1');
    }

    #[Test]
    public function it_rejects_a_non_numeric_amount(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Money::toMinor('twelve rupees');
    }

    #[Test]
    public function it_rejects_an_amount_beyond_the_supported_range(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Money::toMinor('10000000.01');
    }
}
