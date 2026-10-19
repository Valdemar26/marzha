import { ComponentFixture, TestBed } from '@angular/core/testing';
import { type BatchCost, type Scenario, analyzeScenario } from '@shared/calc';
import { ResultsCard } from './results-card';

// S = 100, O = 5000, M = 600, one stage of 1 month at full price → break-even 56.
const costs: BatchCost[] = [
  { name: 'Закупівля', kind: 'one_time', amount: 5000 },
  { name: 'Склад', kind: 'monthly', amount: 600 },
];
const analyze = (scenario: Scenario, batchCosts = costs) =>
  analyzeScenario({ quantity: 100, defectRate: 0, currency: 'UAH', costs: batchCosts }, scenario);
const single: Scenario = { stages: [{ share: 1, discount: 0, months: 1 }] };

describe('ResultsCard', () => {
  let fixture: ComponentFixture<ResultsCard>;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function render(inputs: Record<string, unknown>): Promise<void> {
    fixture = TestBed.createComponent(ResultsCard);
    fixture.componentRef.setInput('currency', 'UAH');
    fixture.componentRef.setInput('targetProfit', 0);
    fixture.componentRef.setInput('price', 100);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    await fixture.whenStable();
  }

  it('shows break-even and target prices', async () => {
    await render({ analysis: analyze(single), targetProfit: 1000 });
    expect(text()).toMatch(/56[.,]00/);
    expect(fixture.componentInstance.targetPrice()).toBeCloseTo(66);
    expect(text()).toMatch(/66[.,]00/);
  });

  it('shows the profit at the chosen price live', async () => {
    await render({ analysis: analyze(single) });
    expect(fixture.componentInstance.profit()).toBeCloseTo(4400);
    fixture.componentInstance.setPrice(50);
    await fixture.whenStable();
    expect(fixture.componentInstance.profit()).toBeCloseTo(-600);
    expect(text()).toContain('Збиток');
  });

  it('ignores invalid typed prices', async () => {
    await render({ analysis: analyze(single) });
    fixture.componentInstance.setPrice(Number.NaN);
    fixture.componentInstance.setPrice(-5);
    expect(fixture.componentInstance.price()).toBe(100);
  });

  it('says when no price can break even', async () => {
    await render({ analysis: analyze(single, [{ name: 'f', kind: 'per_sale_percent', percent: 1 }]) });
    expect(text()).toContain('недосяжна');
    expect(text()).toContain('Жодна ціна');
  });

  it('compares with the competitor price', async () => {
    await render({ analysis: analyze(single), competitorPrice: 80 });
    expect(text()).toMatch(/на \D*20[.,]00/);
    expect(text()).toContain('вища');
    expect(text()).toMatch(/заробите \D*2\D?400/);
  });

  it('warns when even the break-even price is above the competitor', async () => {
    await render({ analysis: analyze(single), competitorPrice: 50 });
    expect(text()).toContain('Навіть ціна в нуль вища');
  });

  it('shows the discount-vs-holding hint with both numbers', async () => {
    const staged: Scenario = {
      stages: [
        { share: 0.9, discount: 0, months: 3 },
        { share: 0.1, discount: 0.2, months: 1 },
      ],
    };
    // Stage 2: 10 units * 100 * 0.2 = 200 < 600 a month.
    await render({ analysis: analyze(staged) });
    expect(text()).toContain('вигідніше продати зі знижкою, ніж ще місяць тримати на складі');
    expect(text()).toMatch(/200[.,]00/);
    expect(text()).toMatch(/600[.,]00/);
  });

  it('scales the slider around the interesting prices', async () => {
    await render({ analysis: analyze(single), competitorPrice: 80, price: 10 });
    expect(fixture.componentInstance.sliderMax()).toBe(200);
    expect(fixture.componentInstance.sliderStep()).toBe(1);
    fixture.componentRef.setInput('price', 750);
    expect(fixture.componentInstance.sliderMax()).toBe(750);
  });

  it('asks for a scenario when there is none', async () => {
    await render({ analysis: null });
    expect(text()).toContain('Додайте сценарій');
  });
});
