import { describe, expect, it } from 'vitest';
import { type CalcInput, type CostLine, calculate } from './index';

const input = (overrides: Partial<CalcInput> = {}): CalcInput => ({
  salePrice: 100,
  returnRate: 0,
  returnCost: 0,
  lines: [],
  ...overrides,
});

describe('calculate', () => {
  describe('unitCost', () => {
    it('is 0 with no lines and no returns', () => {
      expect(calculate(input()).unitCost).toBe(0);
    });

    it('sums material lines as quantity * unitPrice', () => {
      const lines: CostLine[] = [
        { name: 'Wax', kind: 'material', quantity: 0.2, unitPrice: 50 },
        { name: 'Jar', kind: 'material', quantity: 1, unitPrice: 3 },
      ];
      expect(calculate(input({ lines })).unitCost).toBeCloseTo(13);
    });

    it('sums labor lines as hours * rate', () => {
      const lines: CostLine[] = [{ name: 'Pouring', kind: 'labor', hours: 0.5, rate: 20 }];
      expect(calculate(input({ lines })).unitCost).toBeCloseTo(10);
    });

    it('sums fixed lines as amount', () => {
      const lines: CostLine[] = [
        { name: 'Packaging', kind: 'fixed', amount: 2 },
        { name: 'Label', kind: 'fixed', amount: 0.5 },
      ];
      expect(calculate(input({ lines })).unitCost).toBeCloseTo(2.5);
    });

    it('excludes percent lines', () => {
      const lines: CostLine[] = [{ name: 'Fee', kind: 'percent', percent: 0.1 }];
      expect(calculate(input({ lines })).unitCost).toBe(0);
    });

    it('treats missing numeric fields as 0', () => {
      const lines: CostLine[] = [
        { name: 'm', kind: 'material', quantity: 5 },
        { name: 'm2', kind: 'material', unitPrice: 5 },
        { name: 'l', kind: 'labor', hours: 2 },
        { name: 'l2', kind: 'labor', rate: 2 },
        { name: 'f', kind: 'fixed' },
        { name: 'p', kind: 'percent' },
      ];
      const result = calculate(input({ lines }));
      expect(result.unitCost).toBe(0);
      expect(result.percentCosts).toBe(0);
    });

    it('ignores fields that do not belong to the line kind', () => {
      const lines: CostLine[] = [{ name: 'f', kind: 'fixed', amount: 1, quantity: 10, unitPrice: 10, percent: 0.5 }];
      const result = calculate(input({ lines }));
      expect(result.unitCost).toBe(1);
      expect(result.percentCosts).toBe(0);
    });

    it('adds no return cost when returnRate is 0', () => {
      expect(calculate(input({ returnRate: 0, returnCost: 10 })).unitCost).toBe(0);
    });

    it('amortizes return cost as returnCost * r / (1 - r)', () => {
      // 20% returns: per kept unit there are 0.25 returned units.
      expect(calculate(input({ returnRate: 0.2, returnCost: 8 })).unitCost).toBeCloseTo(2);
    });

    it('combines all kinds and returns', () => {
      const lines: CostLine[] = [
        { name: 'm', kind: 'material', quantity: 2, unitPrice: 5 },
        { name: 'l', kind: 'labor', hours: 1, rate: 15 },
        { name: 'f', kind: 'fixed', amount: 5 },
        { name: 'p', kind: 'percent', percent: 0.1 },
      ];
      expect(calculate(input({ lines, returnRate: 0.5, returnCost: 4 })).unitCost).toBeCloseTo(34);
    });
  });

  describe('percentCosts', () => {
    it('is salePrice * sum of percent lines', () => {
      const lines: CostLine[] = [
        { name: 'Marketplace', kind: 'percent', percent: 0.15 },
        { name: 'Payment', kind: 'percent', percent: 0.03 },
      ];
      expect(calculate(input({ salePrice: 200, lines })).percentCosts).toBeCloseTo(36);
    });

    it('is 0 when salePrice is 0', () => {
      const lines: CostLine[] = [{ name: 'Fee', kind: 'percent', percent: 0.2 }];
      expect(calculate(input({ salePrice: 0, lines })).percentCosts).toBe(0);
    });
  });

  describe('profit, margin and markup', () => {
    const lines: CostLine[] = [
      { name: 'm', kind: 'material', quantity: 1, unitPrice: 40 },
      { name: 'p', kind: 'percent', percent: 0.1 },
    ];

    it('computes profit = salePrice - unitCost - percentCosts', () => {
      expect(calculate(input({ lines })).profit).toBeCloseTo(50);
    });

    it('computes marginPct = profit / salePrice', () => {
      expect(calculate(input({ lines })).marginPct).toBeCloseTo(0.5);
    });

    it('computes markupPct = profit / unitCost', () => {
      expect(calculate(input({ lines })).markupPct).toBeCloseTo(1.25);
    });

    it('allows negative profit and margin', () => {
      const result = calculate(input({ salePrice: 30, lines }));
      expect(result.profit).toBeCloseTo(-13);
      expect(result.marginPct).toBeCloseTo(-13 / 30);
      expect(result.markupPct).toBeCloseTo(-13 / 40);
    });

    it('returns null marginPct when salePrice is 0', () => {
      const result = calculate(input({ salePrice: 0, lines }));
      expect(result.profit).toBeCloseTo(-40);
      expect(result.marginPct).toBeNull();
      expect(result.markupPct).toBeCloseTo(-1);
    });

    it('returns null markupPct when unitCost is 0', () => {
      const result = calculate(input({ lines: [] }));
      expect(result.profit).toBe(100);
      expect(result.marginPct).toBe(1);
      expect(result.markupPct).toBeNull();
    });

    it('returns null for both when price and cost are 0', () => {
      const result = calculate(input({ salePrice: 0 }));
      expect(result.profit).toBe(0);
      expect(result.marginPct).toBeNull();
      expect(result.markupPct).toBeNull();
    });
  });

  describe('priceForMargin', () => {
    const lines: CostLine[] = [
      { name: 'm', kind: 'material', quantity: 1, unitPrice: 40 },
      { name: 'p', kind: 'percent', percent: 0.1 },
    ];

    it('computes unitCost / (1 - sum percent - margin)', () => {
      expect(calculate(input({ lines })).priceForMargin(0.3)).toBeCloseTo(66.6667, 3);
    });

    it('round-trips: selling at the recommended price yields the target margin', () => {
      const price = calculate(input({ lines })).priceForMargin(0.25)!;
      expect(calculate(input({ salePrice: price, lines })).marginPct).toBeCloseTo(0.25);
    });

    it('does not depend on the current salePrice', () => {
      const a = calculate(input({ salePrice: 10, lines })).priceForMargin(0.2);
      const b = calculate(input({ salePrice: 1000, lines })).priceForMargin(0.2);
      expect(a).toBeCloseTo(b!);
    });

    it('returns unitCost for 0 margin and no percent lines', () => {
      const result = calculate(input({ lines: [{ name: 'f', kind: 'fixed', amount: 12 }] }));
      expect(result.priceForMargin(0)).toBe(12);
    });

    it('includes amortized return cost', () => {
      const result = calculate(input({ returnRate: 0.2, returnCost: 8 }));
      expect(result.priceForMargin(0.5)).toBeCloseTo(4);
    });

    it('returns null when percent costs plus margin reach 100%', () => {
      expect(calculate(input({ lines })).priceForMargin(0.9)).toBeNull();
    });

    it('returns null when percent costs plus margin exceed 100%', () => {
      expect(calculate(input({ lines })).priceForMargin(0.95)).toBeNull();
    });

    it('returns null when percent lines alone reach 100%', () => {
      const result = calculate(input({ lines: [{ name: 'p', kind: 'percent', percent: 1 }] }));
      expect(result.priceForMargin(0)).toBeNull();
    });

    it('handles a negative target margin', () => {
      expect(calculate(input({ lines })).priceForMargin(-0.1)).toBeCloseTo(40);
    });
  });

  describe('returnRate validation', () => {
    it('rejects returnRate of 1', () => {
      expect(() => calculate(input({ returnRate: 1 }))).toThrow(RangeError);
    });

    it('rejects returnRate above 1', () => {
      expect(() => calculate(input({ returnRate: 1.5 }))).toThrow(RangeError);
    });

    it('rejects negative returnRate', () => {
      expect(() => calculate(input({ returnRate: -0.1 }))).toThrow(RangeError);
    });

    it('rejects NaN returnRate', () => {
      expect(() => calculate(input({ returnRate: Number.NaN }))).toThrow(RangeError);
    });
  });
});
