<?php

namespace App\Http\Requests;

use App\Models\Category;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class TransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'in:income,expense'],
            // `min:0.01`, not `gt:0`. A sub-paisa amount clears `gt:0` and then
            // rounds to zero on the way into storage, leaving a ₹0.00 line in
            // the ledger that contributes nothing but still counts as an entry.
            'amount' => ['required', 'numeric', 'min:0.01', 'max:10000000'],
            // NOT `before_or_equal:today`. The server runs in UTC while the date
            // picker sends the browser's local calendar date, so anyone east of
            // UTC recording an expense after midnight has their real "today"
            // rejected as a future date — at 03:31 IST the server still thinks
            // it is yesterday. The latest date that is "today" somewhere on
            // earth is UTC+14, so that is the bound.
            'occurred_on' => ['required', 'date', 'before_or_equal:'.$this->latestSaneDate()],
            'category_id' => ['nullable', 'string'],
            'note' => ['nullable', 'string', 'max:240'],
        ];
    }

    /**
     * The last calendar date that is still "today" in the most advanced
     * timezone on earth (UTC+14, Kiritimati).
     */
    private function latestSaneDate(): string
    {
        return CarbonImmutable::now('UTC')->addHours(14)->toDateString();
    }

    public function messages(): array
    {
        return [
            'amount.min' => 'The smallest amount you can record is 0.01.',
            'occurred_on.before_or_equal' => 'A ledger records what happened, not what will.',
        ];
    }

    /**
     * The category must exist, belong to this user, and match the entry's
     * direction — filing salary under "Groceries" would quietly corrupt every
     * breakdown on the dashboard.
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $categoryId = $this->input('category_id');

                if (! $categoryId) {
                    return;
                }

                $category = Category::ownedBy((string) $this->user()->getKey())
                    ->where('_id', $categoryId)
                    ->first();

                if (! $category) {
                    $validator->errors()->add('category_id', 'That category does not exist.');

                    return;
                }

                if ($category->type !== $this->input('type')) {
                    $validator->errors()->add(
                        'category_id',
                        "\"{$category->name}\" is a {$category->type} category."
                    );
                }
            },
        ];
    }

    /**
     * @return array{user_id:string,type:string,amount:int,occurred_on:string,category_id:string|null,note:string|null}
     */
    public function toAttributes(): array
    {
        return [
            'user_id' => (string) $this->user()->getKey(),
            'type' => $this->string('type')->toString(),
            'amount' => Money::toMinor($this->input('amount')),
            'occurred_on' => $this->date('occurred_on')->startOfDay(),
            'category_id' => $this->input('category_id') ?: null,
            'note' => $this->input('note') ?: null,
        ];
    }
}
