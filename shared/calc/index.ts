export type CostLineKind = 'material' | 'labor' | 'fixed' | 'percent';

export const COST_LINE_KINDS: readonly CostLineKind[] = ['material', 'labor', 'fixed', 'percent'];

export interface CostLine {
  name: string;
  kind: CostLineKind;
  quantity?: number;
  unitPrice?: number;
  hours?: number;
  rate?: number;
  amount?: number;
  /** Fraction of the sale price, 0..1. */
  percent?: number;
}

export interface CalcInput {
  salePrice: number;
  /** Share of sold units that come back, 0 <= returnRate < 1. */
  returnRate: number;
  /** Cost of handling one return. */
  returnCost: number;
  lines: CostLine[];
}

export interface CalcResult {
  unitCost: number;
  percentCosts: number;
  profit: number;
  /** profit / salePrice; null when salePrice is 0. */
  marginPct: number | null;
  /** profit / unitCost; null when unitCost is 0. */
  markupPct: number | null;
  /** Sale price that yields the target margin (0..1); null when the margin is unreachable. */
  priceForMargin(targetMargin: number): number | null;
}

export function calculate(input: CalcInput): CalcResult {
  const { salePrice, returnRate, returnCost, lines } = input;

  if (!(returnRate >= 0 && returnRate < 1)) {
    throw new RangeError(`returnRate must be in [0, 1), got ${returnRate}`);
  }

  let directCost = 0;
  let percentSum = 0;
  for (const line of lines) {
    switch (line.kind) {
      case 'material':
        directCost += (line.quantity ?? 0) * (line.unitPrice ?? 0);
        break;
      case 'labor':
        directCost += (line.hours ?? 0) * (line.rate ?? 0);
        break;
      case 'fixed':
        directCost += line.amount ?? 0;
        break;
      case 'percent':
        percentSum += line.percent ?? 0;
        break;
    }
  }

  const unitCost = directCost + (returnCost * returnRate) / (1 - returnRate);
  const percentCosts = salePrice * percentSum;
  const profit = salePrice - unitCost - percentCosts;

  return {
    unitCost,
    percentCosts,
    profit,
    marginPct: salePrice === 0 ? null : profit / salePrice,
    markupPct: unitCost === 0 ? null : profit / unitCost,
    priceForMargin(targetMargin: number): number | null {
      const denominator = 1 - percentSum - targetMargin;
      return denominator <= 0 ? null : unitCost / denominator;
    },
  };
}
