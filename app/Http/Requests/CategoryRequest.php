<?php

namespace App\Http\Requests;

use App\Models\Category;
use App\Support\Money;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:40'],
            'type' => ['required', 'in:income,expense'],
            'color' => ['required', 'string', Rule::in(Category::PALETTE)],
            'monthly_budget' => ['nullable', 'numeric', 'gte:0', 'max:10000000'],
        ];
    }

    /**
     * @return array{user_id:string,name:string,type:string,color:string,monthly_budget:int}
     */
    public function toAttributes(): array
    {
        $budget = $this->input('monthly_budget');

        return [
            'user_id' => (string) $this->user()->getKey(),
            'name' => trim($this->string('name')->toString()),
            'type' => $this->string('type')->toString(),
            'color' => $this->string('color')->toString(),
            // Only expense categories carry a budget; storing one on an income
            // category would render a meaningless progress bar.
            'monthly_budget' => $this->input('type') === 'expense' && $budget !== null && $budget !== ''
                ? Money::toMinor($budget)
                : 0,
        ];
    }
}
