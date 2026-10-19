import { describe, expect, it } from 'vitest';
import { type Batch, type BatchCost, type Scenario, analyzeScenario, sumCosts } from './index';

const batch = (overrides: Partial<Batch> = {}): Batch => ({
  quantity: 100,
  defectRate: 0,
  currency: 'UAH',
  costs: [],
  ...overrides,
});

const single: Scenario = { stages: [{ share: 1, discount: 0, months: 1 }] };

// Q = 100, d = 10% → S = 90.
// O = 5000 + 1000, M = 600, F = 20, p = 10%.
const costs: BatchCost[] = [
  { name: 'Закупівля', kind: 'one_time', amount: 5000 },
  { name: 'Доставка', kind: 'one_time', amount: 1000 },
  { name: 'Склад', kind: 'monthly', amount: 600 },
  { name: 'Пакування', kind: 'per_sale_fixed', amount: 20 },
  { name: 'Комісія', kind: 'per_sale_percent', percent: 0.1 },
];
// 50% at full price for 2 months, 30% at -20% for 1 month, 20% at -50% for 1 month.
const staged: Scenario = {
  stages: [
    { share: 0.5, discount: 0, months: 2 },
    { share: 0.3, discount: 0.2, months: 1 },
    { share: 0.2, discount: 0.5, months: 1 },
  ],
};
// u = [45, 27, 18]; Σ u(1-δ) = 45 + 21.6 + 9 = 75.6; slope = 0.9 * 75.6 = 68.04.
// T = 4; fixed = 6000 + 600*4 + 20*90 = 10200.
const example = () => analyzeScenario(batch({ defectRate: 0.1, costs }), staged);

describe('sumCosts', () => {
  it('is all zeros with no costs', () => {
    expect(sumCosts([])).toEqual({ oneTime: 0, monthly: 0, perSaleFixed: 0, percent: 0 });
  });

  it('sums each kind separately', () => {
    expect(sumCosts(costs)).toEqual({ oneTime: 6000, monthly: 600, perSaleFixed: 20, percent: 0.1 });
  });

  it('treats missing values as 0 and ignores fields of other kinds', () => {
    const result = sumCosts([
      { name: 'a', kind: 'one_time' },
      { name: 'b', kind: 'monthly', percent: 0.5 },
      { name: 'c', kind: 'per_sale_fixed' },
      { name: 'd', kind: 'per_sale_percent', amount: 99 },
    ]);
    expect(result).toEqual({ oneTime: 0, monthly: 0, perSaleFixed: 0, percent: 0 });
  });
});

describe('analyzeScenario', () => {
  describe('quantities', () => {
    it('computes sellable units as Q * (1 - d)', () => {
      expect(example().sellableUnits).toBeCloseTo(90);
    });

    it('sums months of all stages', () => {
      expect(example().totalMonths).toBe(4);
    });

    it('computes fixed costs as O + M*T + F*S', () => {
      expect(example().fixedCosts).toBeCloseTo(10200);
    });

    it('exposes cost totals', () => {
      expect(example().costs.monthly).toBe(600);
    });
  });

  describe('validation', () => {
    it('is valid when shares sum to 100%', () => {
      const result = example();
      expect(result.sharesTotal).toBeCloseTo(1);
      expect(result.validation).toEqual({ valid: true, issues: [] });
    });

    it('tolerates float noise from percent inputs', () => {
      const scenario: Scenario = {
        stages: [0.1, 0.2, 0.7].map((share) => ({ share, discount: 0, months: 1 })),
      };
      expect(analyzeScenario(batch(), scenario).validation.valid).toBe(true);
    });

    it('reports shares below 100%', () => {
      const scenario: Scenario = { stages: [{ share: 0.6, discount: 0, months: 1 }] };
      expect(analyzeScenario(batch(), scenario).validation).toEqual({
        valid: false,
        issues: [{ code: 'shares_sum', sharesTotal: 0.6 }],
      });
    });

    it('reports shares above 100%', () => {
      const scenario: Scenario = {
        stages: [
          { share: 0.8, discount: 0, months: 1 },
          { share: 0.4, discount: 0.1, months: 1 },
        ],
      };
      const { validation } = analyzeScenario(batch(), scenario);
      expect(validation.valid).toBe(false);
      expect(validation.issues[0].sharesTotal).toBeCloseTo(1.2);
    });

    it('reports a scenario with no stages', () => {
      const result = analyzeScenario(batch(), { stages: [] });
      expect(result.validation.issues).toEqual([{ code: 'shares_sum', sharesTotal: 0 }]);
    });

    it('still computes results for an invalid scenario', () => {
      const scenario: Scenario = { stages: [{ share: 0.5, discount: 0, months: 1 }] };
      expect(analyzeScenario(batch({ costs }), scenario).breakEvenPrice).not.toBeNull();
    });
  });

  describe('profitAt', () => {
    it('computes X*(1-p)*Σu(1-δ) - F*S - O - M*T', () => {
      expect(example().profitAt(200)).toBeCloseTo(200 * 68.04 - 10200);
    });

    it('is minus the fixed costs at price 0', () => {
      expect(example().profitAt(0)).toBeCloseTo(-10200);
    });

    it('matches the sum of stage revenues minus all costs', () => {
      const result = example();
      const price = 180;
      const revenue = result.stagesAt(price).reduce((sum, stage) => sum + stage.revenue, 0);
      const costsTotal = 6000 + 600 * 4 + 20 * 90 + 0.1 * revenue;
      expect(result.profitAt(price)).toBeCloseTo(revenue - costsTotal);
    });

    it('counts monthly costs only for the scenario duration', () => {
      const monthly: BatchCost[] = [{ name: 'Склад', kind: 'monthly', amount: 100 }];
      const short = analyzeScenario(batch({ costs: monthly }), single);
      const long = analyzeScenario(batch({ costs: monthly }), { stages: [{ share: 1, discount: 0, months: 6 }] });
      expect(short.profitAt(10)).toBe(1000 - 100);
      expect(long.profitAt(10)).toBe(1000 - 600);
    });

    it('applies per-sale fixed costs to sellable units only', () => {
      const perSale: BatchCost[] = [{ name: 'p', kind: 'per_sale_fixed', amount: 2 }];
      const result = analyzeScenario(batch({ defectRate: 0.5, costs: perSale }), single);
      expect(result.profitAt(10)).toBe(50 * 10 - 50 * 2);
    });

    it('applies the percent to the discounted price', () => {
      const fee: BatchCost[] = [{ name: 'f', kind: 'per_sale_percent', percent: 0.2 }];
      const scenario: Scenario = { stages: [{ share: 1, discount: 0.5, months: 0 }] };
      expect(analyzeScenario(batch({ costs: fee }), scenario).profitAt(10)).toBeCloseTo(100 * 5 * 0.8);
    });
  });

  describe('breakEvenPrice', () => {
    it('is (O + M*T + F*S) / ((1-p) * Σu(1-δ))', () => {
      expect(example().breakEvenPrice).toBeCloseTo(10200 / 68.04);
    });

    it('yields zero profit', () => {
      const result = example();
      expect(result.profitAt(result.breakEvenPrice!)).toBeCloseTo(0);
    });

    it('is the unit cost for a single full-price stage without percent costs', () => {
      const result = analyzeScenario(batch({ costs: [{ name: 'o', kind: 'one_time', amount: 3000 }] }), single);
      expect(result.breakEvenPrice).toBe(30);
    });

    it('is 0 when there are no costs', () => {
      expect(analyzeScenario(batch(), single).breakEvenPrice).toBe(0);
    });

    it('is null when percent costs reach 100%', () => {
      const fee: BatchCost[] = [{ name: 'f', kind: 'per_sale_percent', percent: 1 }];
      expect(analyzeScenario(batch({ costs: fee }), single).breakEvenPrice).toBeNull();
    });

    it('is null when percent costs exceed 100%', () => {
      const fees: BatchCost[] = [
        { name: 'a', kind: 'per_sale_percent', percent: 0.7 },
        { name: 'b', kind: 'per_sale_percent', percent: 0.4 },
      ];
      expect(analyzeScenario(batch({ costs: fees }), single).breakEvenPrice).toBeNull();
    });

    it('is null when every unit is defective', () => {
      expect(analyzeScenario(batch({ defectRate: 1, costs }), single).breakEvenPrice).toBeNull();
    });

    it('is null when every stage gives a 100% discount', () => {
      const free: Scenario = { stages: [{ share: 1, discount: 1, months: 1 }] };
      expect(analyzeScenario(batch({ costs }), free).breakEvenPrice).toBeNull();
    });

    it('is null when there are no stages', () => {
      expect(analyzeScenario(batch({ costs }), { stages: [] }).breakEvenPrice).toBeNull();
    });

    it('rises with deeper discounts', () => {
      const discounted: Scenario = { stages: [{ share: 1, discount: 0.25, months: 1 }] };
      const base = analyzeScenario(batch({ costs }), single).breakEvenPrice!;
      expect(analyzeScenario(batch({ costs }), discounted).breakEvenPrice).toBeCloseTo(base / 0.75);
    });
  });

  describe('priceForProfit', () => {
    it('adds the target to the numerator', () => {
      expect(example().priceForProfit(5000)).toBeCloseTo(15200 / 68.04);
    });

    it('round-trips: selling at that price yields the target profit', () => {
      const result = example();
      expect(result.profitAt(result.priceForProfit(3000)!)).toBeCloseTo(3000);
    });

    it('equals breakEvenPrice for a zero target', () => {
      const result = example();
      expect(result.priceForProfit(0)).toBe(result.breakEvenPrice);
    });

    it('is null when the denominator is not positive', () => {
      const fee: BatchCost[] = [{ name: 'f', kind: 'per_sale_percent', percent: 1 }];
      expect(analyzeScenario(batch({ costs: fee }), single).priceForProfit(100)).toBeNull();
    });
  });

  describe('stagesAt', () => {
    it('returns units, unit price and revenue per stage', () => {
      const stages = example().stagesAt(100);
      expect(stages.map((s) => s.units)).toEqual([45, 27, 18].map((u) => expect.closeTo(u)));
      expect(stages.map((s) => s.unitPrice)).toEqual([100, 80, 50]);
      expect(stages.map((s) => s.revenue)).toEqual([4500, 2160, 900].map((r) => expect.closeTo(r)));
    });

    it('is empty for a scenario without stages', () => {
      expect(analyzeScenario(batch(), { stages: [] }).stagesAt(100)).toEqual([]);
    });
  });

  describe('hintsAt', () => {
    // At X = 100: stage 2 extra discount 20% → 27 * 100 * 0.2 * 0.9 = 486;
    // stage 3 extra 30% → 18 * 100 * 0.3 * 0.9 = 486. M = 600 beats both.
    it('suggests discounting when a month of holding costs more than the extra discount', () => {
      expect(example().hintsAt(100)).toEqual([
        { stageIndex: 1, discountCost: expect.closeTo(486), holdingCostPerMonth: 600 },
        { stageIndex: 2, discountCost: expect.closeTo(486), holdingCostPerMonth: 600 },
      ]);
    });

    it('stays silent when the discount costs more than holding', () => {
      // At X = 200 both discount costs are 972 > 600.
      expect(example().hintsAt(200)).toEqual([]);
    });

    it('stays silent when holding costs equal the discount cost', () => {
      const result = example();
      // 27 * X * 0.2 * 0.9 = 600 → X = 600 / 4.86 for stage 2, and the same for stage 3.
      expect(result.hintsAt(600 / 4.86 + 1e-9)).toEqual([]);
    });

    it('never hints for the first stage', () => {
      const scenario: Scenario = { stages: [{ share: 1, discount: 0.5, months: 3 }] };
      expect(analyzeScenario(batch({ costs }), scenario).hintsAt(100)).toEqual([]);
    });

    it('skips stages that are not discounted deeper than the previous one', () => {
      const scenario: Scenario = {
        stages: [
          { share: 0.5, discount: 0.3, months: 1 },
          { share: 0.3, discount: 0.3, months: 1 },
          { share: 0.2, discount: 0.1, months: 1 },
        ],
      };
      expect(analyzeScenario(batch({ costs }), scenario).hintsAt(100)).toEqual([]);
    });

    it('skips stages that sell no units', () => {
      const scenario: Scenario = {
        stages: [
          { share: 1, discount: 0, months: 1 },
          { share: 0, discount: 0.5, months: 1 },
        ],
      };
      expect(analyzeScenario(batch({ costs }), scenario).hintsAt(100)).toEqual([]);
    });

    it('never hints without monthly costs', () => {
      const noMonthly = costs.filter((cost) => cost.kind !== 'monthly');
      expect(analyzeScenario(batch({ costs: noMonthly }), staged).hintsAt(1)).toEqual([]);
    });
  });
});

describe('reference case', () => {
  // Q = 100, d = 0, O = 83000, M = 9000, no per-sale costs.
  const reference = batch({
    costs: [
      { name: 'Закупівля', kind: 'one_time', amount: 83000 },
      { name: 'Склад', kind: 'monthly', amount: 9000 },
    ],
  });

  it('scenario A: everything at full price in one month breaks even at 920', () => {
    const result = analyzeScenario(reference, { stages: [{ share: 1, discount: 0, months: 1 }] });
    expect(result.breakEvenPrice).toBeCloseTo(920, 9);
  });

  describe('scenario B: 80% full price for 3 months, then 10% at -20% and 10% at -50%', () => {
    const result = analyzeScenario(reference, {
      stages: [
        { share: 0.8, discount: 0, months: 3 },
        { share: 0.1, discount: 0.2, months: 1 },
        { share: 0.1, discount: 0.5, months: 1 },
      ],
    });

    it('breaks even at ≈ 1376.34', () => {
      expect(result.breakEvenPrice).toBeCloseTo(1376.34, 2);
    });

    it('needs ≈ 1698.92 for a 30000 profit', () => {
      expect(result.priceForProfit(30000)).toBeCloseTo(1698.92, 2);
    });

    it.each([
      ['break-even', 128000 / 93],
      ['target', 158000 / 93],
    ])('suggests discounting on both discount stages at the %s price', (_label, price) => {
      const hints = result.hintsAt(price);
      expect(hints.map((hint) => hint.stageIndex)).toEqual([1, 2]);
      expect(hints.every((hint) => hint.holdingCostPerMonth === 9000 && hint.discountCost < 9000)).toBe(true);
    });
  });
});
