import type { AlertRuleCondition, ConditionOperator } from '@inventech/shared-types'

// ─────────────────────────────────────────
// Avalia se um conjunto de condições é satisfeito
// pelos dados do evento (lógica AND entre condições)
// ─────────────────────────────────────────
export function evaluateConditions(
    conditions: AlertRuleCondition[],
    data: Record<string, any>,
): boolean {
    if (conditions.length === 0) return true

    return conditions.every((condition) => evaluateCondition(condition, data))
}

function evaluateCondition(
    condition: AlertRuleCondition,
    data: Record<string, any>,
): boolean {
    const actual = getNestedValue(data, condition.field)
    const expected = condition.value

    switch (condition.operator as ConditionOperator) {
        case 'eq':
            return looslyEqual(actual, expected)

        case 'neq':
            return !looslyEqual(actual, expected)

        case 'gt':
            return toNumber(actual) > toNumber(expected)

        case 'gte':
            return toNumber(actual) >= toNumber(expected)

        case 'lt':
            return toNumber(actual) < toNumber(expected)

        case 'lte':
            return toNumber(actual) <= toNumber(expected)

        case 'contains':
            return String(actual ?? '').toLowerCase().includes(String(expected).toLowerCase())

        case 'in':
            if (!Array.isArray(expected)) return false
            return expected.map(String).includes(String(actual ?? ''))

        default:
            return false
    }
}

// ─────────────────────────────────────────
// Acessa campos aninhados com dot-notation
// ex: "serviceOrder.priority" → data.serviceOrder.priority
// ─────────────────────────────────────────
function getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
}

function looslyEqual(a: any, b: any): boolean {
    return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()
}

function toNumber(value: any): number {
    const n = Number(value)
    return isNaN(n) ? 0 : n
}
