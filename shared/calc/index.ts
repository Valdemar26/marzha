// Batch pricing: at what base price X does a batch break even (or earn a target profit),
// given its costs and a staged sales scenario. Framework-free, used by src/ and api/.

export type CostKind = 'one_time' | 'monthly' | 'per_sale_fixed' | 'per_sale_percent';

export const COST_KINDS: readonly CostKind[] = ['one_time', 'monthly', 'per_sale_fixed', 'per_sale_percent'];

export interface BatchCost {
  name: string;
  kind: CostKind;
  /** Money: once (one_time), per month while stock remains (monthly), per unit sold (per_sale_fixed). */
  amount?: number;
  /** Fraction of the actual sale price, 0..1 (per_sale_percent). */
  percent?: number;
}

export interface Batch {
  /** Units bought/produced, Q. */
  quantity: number;
  /** Share of units that can't be sold, 0..1. */
  defectRate: number;
  currency: string;
  costs: BatchCost[];
}

export interface Stage {
  /** Share of sellable units sold in this stage, 0..1. */
  share: number;
  /** Discount off the base price, 0..1: unit price = X * (1 - discount). */
  discount: number;
  /** Duration; stages run one after another. */
  months: number;
}

export interface Scenario {
  stages: Stage[];
}

export interface CostTotals {
  /** O: sum of one_time amounts. */
  oneTime: number;
  /** M: sum of monthly amounts. */
  monthly: number;
  /** F: sum of per_sale_fixed amounts. */
  perSaleFixed: number;
  /** p: sum of per_sale_percent fractions. */
  percent: number;
}

export type ValidationIssue = { code: 'shares_sum'; sharesTotal: number };

export interface Validation {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface StageResult {
  units: number;
  /** X * (1 - discount). */
  unitPrice: number;
  /** units * unitPrice, before per-sale costs. */
  revenue: number;
}

/** Stage i (> 0) where one more month of holding costs more than its extra discount. */
export interface StageHint {
  stageIndex: number;
  /** u_i * X * (δ_i - δ_{i-1}) * (1 - p). */
  discountCost: number;
  /** M. */
  holdingCostPerMonth: number;
}

export interface ScenarioAnalysis {
  /** S = Q * (1 - d). */
  sellableUnits: number;
  /** T = Σ m_i up to and including the last stage with share > 0; later stages hold no stock. */
  totalMonths: number;
  /** Σ s_i, as a fraction. */
  sharesTotal: number;
  costs: CostTotals;
  validation: Validation;
  /** Price-independent costs: O + M*T + F*S. */
  fixedCosts: number;
  /** Price at which profit is 0; null when no price can break even. */
  breakEvenPrice: number | null;
  /** Price at which profit equals `target`; null when unreachable. */
  priceForProfit(target: number): number | null;
  profitAt(price: number): number;
  stagesAt(price: number): StageResult[];
  hintsAt(price: number): StageHint[];
}

/** Tolerance for shares summing to 100% (float noise from percent inputs). */
const SHARES_EPSILON = 1e-6;

export function sumCosts(costs: readonly BatchCost[]): CostTotals {
  const totals: CostTotals = { oneTime: 0, monthly: 0, perSaleFixed: 0, percent: 0 };
  for (const cost of costs) {
    switch (cost.kind) {
      case 'one_time':
        totals.oneTime += cost.amount ?? 0;
        break;
      case 'monthly':
        totals.monthly += cost.amount ?? 0;
        break;
      case 'per_sale_fixed':
        totals.perSaleFixed += cost.amount ?? 0;
        break;
      case 'per_sale_percent':
        totals.percent += cost.percent ?? 0;
        break;
    }
  }
  return totals;
}

export function analyzeScenario(batch: Batch, scenario: Scenario): ScenarioAnalysis {
  const costs = sumCosts(batch.costs);
  const sellableUnits = batch.quantity * (1 - batch.defectRate);
  const units = scenario.stages.map((stage) => sellableUnits * stage.share);
  // Monthly costs accrue only while stock remains, i.e. until the last stage that sells anything.
  let totalMonths = 0;
  let monthsSoFar = 0;
  for (const stage of scenario.stages) {
    monthsSoFar += stage.months;
    if (stage.share > 0) totalMonths = monthsSoFar;
  }
  const sharesTotal = scenario.stages.reduce((sum, stage) => sum + stage.share, 0);
  const issues: ValidationIssue[] =
    Math.abs(sharesTotal - 1) > SHARES_EPSILON ? [{ code: 'shares_sum', sharesTotal }] : [];

  // profit(X) = X * slope - fixedCosts
  const discountedUnits = scenario.stages.reduce((sum, stage, i) => sum + units[i] * (1 - stage.discount), 0);
  const slope = (1 - costs.percent) * discountedUnits;
  const fixedCosts = costs.oneTime + costs.monthly * totalMonths + costs.perSaleFixed * sellableUnits;

  const priceForProfit = (target: number): number | null =>
    slope <= 0 ? null : (fixedCosts + target) / slope;

  return {
    sellableUnits,
    totalMonths,
    sharesTotal,
    costs,
    validation: { valid: issues.length === 0, issues },
    fixedCosts,
    breakEvenPrice: priceForProfit(0),
    priceForProfit,
    profitAt: (price) => price * slope - fixedCosts,
    stagesAt: (price) =>
      scenario.stages.map((stage, i) => {
        const unitPrice = price * (1 - stage.discount);
        return { units: units[i], unitPrice, revenue: units[i] * unitPrice };
      }),
    hintsAt: (price) => {
      const hints: StageHint[] = [];
      for (let i = 1; i < scenario.stages.length; i++) {
        const extraDiscount = scenario.stages[i].discount - scenario.stages[i - 1].discount;
        // A stage that isn't cheaper than the previous one, or sells nothing, has no discount to weigh against holding.
        if (extraDiscount <= 0 || units[i] === 0) continue;
        const discountCost = units[i] * price * extraDiscount * (1 - costs.percent);
        if (costs.monthly > discountCost) {
          hints.push({ stageIndex: i, discountCost, holdingCostPerMonth: costs.monthly });
        }
      }
      return hints;
    },
  };
}
