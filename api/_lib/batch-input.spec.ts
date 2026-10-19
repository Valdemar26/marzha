import { describe, expect, it } from 'vitest';
import { parseBatchInput } from './batch-input';

const valid = () => ({
  name: ' Свічки ',
  quantity: 100,
  defectRate: 0.05,
  targetProfit: 5000,
  competitorPrice: 250,
  salesStartDate: '2026-11-01',
  costs: [
    { name: 'Закупівля', kind: 'one_time', amount: 8000, percent: 0.3 },
    { name: 'Комісія', kind: 'per_sale_percent', percent: 0.1, amount: 5 },
  ],
  scenarios: [{ name: 'Базовий', stages: [{ share: 1, discount: 0, months: 2 }] }],
});

describe('parseBatchInput', () => {
  it('normalizes a valid body, keeping only kind-relevant cost fields', () => {
    expect(parseBatchInput(valid())).toEqual({
      ...valid(),
      name: 'Свічки',
      costs: [
        { name: 'Закупівля', kind: 'one_time', amount: 8000 },
        { name: 'Комісія', kind: 'per_sale_percent', percent: 0.1 },
      ],
    });
  });

  it('defaults optional nullable fields to null', () => {
    const { competitorPrice: _c, salesStartDate: _s, ...body } = valid();
    expect(parseBatchInput(body)).toMatchObject({ competitorPrice: null, salesStartDate: null });
  });

  it('passes a valid currency through', () => {
    expect(parseBatchInput({ ...valid(), currency: 'EUR' })).toMatchObject({ currency: 'EUR' });
  });

  it.each([
    ['a non-object body', null, 'Body must be an object'],
    ['an empty name', { name: '  ' }, 'name'],
    ['zero quantity', { quantity: 0 }, 'quantity'],
    ['a lowercase currency', { currency: 'uah' }, 'currency'],
    ['a defect rate of 100%', { defectRate: 1 }, 'defectRate'],
    ['a negative target profit', { targetProfit: -1 }, 'targetProfit'],
    ['a string competitor price', { competitorPrice: '10' }, 'competitorPrice'],
    ['a non-existent date', { salesStartDate: '2026-02-30' }, 'salesStartDate'],
    ['a malformed date', { salesStartDate: '01.11.2026' }, 'salesStartDate'],
    ['an out-of-range month', { salesStartDate: '2026-13-01' }, 'salesStartDate'],
    ['missing costs', { costs: undefined }, 'costs must be an array'],
    ['an unknown cost kind', { costs: [{ name: 'x', kind: 'material', amount: 1 }] }, 'costs[0]: kind'],
    ['a cost without amount', { costs: [{ name: 'x', kind: 'monthly' }] }, 'costs[0]: amount'],
    ['a percent above 1', { costs: [{ name: 'x', kind: 'per_sale_percent', percent: 15 }] }, 'costs[0]: percent'],
    ['a non-object cost', { costs: [1] }, 'costs[0]: must be an object'],
    ['a scenario without name', { scenarios: [{ stages: [] }] }, 'scenarios[0]: name'],
    ['a non-object scenario', { scenarios: ['x'] }, 'scenarios[0]: must be an object'],
    ['a share above 1', { scenarios: [{ name: 's', stages: [{ share: 50, discount: 0, months: 1 }] }] }, 'share'],
    ['a negative discount', { scenarios: [{ name: 's', stages: [{ share: 1, discount: -0.1, months: 1 }] }] }, 'discount'],
    ['too many months', { scenarios: [{ name: 's', stages: [{ share: 1, discount: 0, months: 121 }] }] }, 'months'],
    ['a non-object stage', { scenarios: [{ name: 's', stages: [null] }] }, 'stages[0]: must be an object'],
  ])('rejects %s', (_label, patch, message) => {
    const body = patch === null ? null : { ...valid(), ...patch };
    expect(parseBatchInput(body)).toEqual(expect.stringContaining(message));
  });

  it('accepts shares that do not sum to 100% (reported as validation, not rejected)', () => {
    const body = { ...valid(), scenarios: [{ name: 's', stages: [{ share: 0.4, discount: 0, months: 1 }] }] };
    expect(typeof parseBatchInput(body)).toBe('object');
  });
});
