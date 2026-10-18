import { ComponentFixture, TestBed } from '@angular/core/testing';
import { calculate } from '@shared/calc';
import { ResultsCard } from './results-card';

describe('ResultsCard', () => {
  let fixture: ComponentFixture<ResultsCard>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ResultsCard);
    fixture.componentRef.setInput('currency', 'EUR');
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('shows the recommended price for the target margin', async () => {
    fixture.componentRef.setInput('result', calculate({ salePrice: 100, returnRate: 0, returnCost: 0, lines: [{ name: 'f', kind: 'fixed', amount: 70 }] }));
    fixture.componentInstance.targetMargin.set(30);
    await fixture.whenStable();
    expect(fixture.componentInstance.recommendedPrice()).toBeCloseTo(100);
    expect(text()).toMatch(/100[.,]00/);
  });

  it('says when the margin is unreachable', async () => {
    fixture.componentRef.setInput('result', calculate({ salePrice: 100, returnRate: 0, returnCost: 0, lines: [{ name: 'p', kind: 'percent', percent: 0.8 }] }));
    fixture.componentInstance.targetMargin.set(30);
    await fixture.whenStable();
    expect(text()).toContain('недосяжна');
  });

  it('asks to fix the form when there is no result', async () => {
    fixture.componentRef.setInput('result', null);
    await fixture.whenStable();
    expect(text()).toContain('Виправте помилки');
  });
});
