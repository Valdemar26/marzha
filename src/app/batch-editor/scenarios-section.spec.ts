import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import { analyzeScenario } from '@shared/calc';
import { createBatchForm, toBatchInput } from './batch-form';
import { ScenariosSection } from './scenarios-section';

describe('ScenariosSection', () => {
  let fixture: ComponentFixture<ScenariosSection>;
  let component: ScenariosSection;
  let form: ReturnType<typeof createBatchForm>;

  const stages = (s = 0) => toBatchInput(form.getRawValue()).scenarios[s].stages;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function render(): Promise<void> {
    const input = toBatchInput(form.getRawValue());
    const batch = { quantity: input.quantity, defectRate: 0, currency: 'UAH', costs: [] };
    fixture.componentRef.setInput(
      'analyses',
      input.scenarios.map((scenario) => analyzeScenario(batch, scenario)),
    );
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    form = createBatchForm(TestBed.inject(NonNullableFormBuilder));
    form.patchValue({ quantity: 200 });
    fixture = TestBed.createComponent(ScenariosSection);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('scenarios', form.controls.scenarios);
    fixture.componentRef.setInput('currency', 'UAH');
    fixture.componentRef.setInput('price', 100);
    await render();
  });

  it('shows units and money next to each stage', () => {
    expect(text()).toContain('200 шт');
    expect(text()).toMatch(/100[.,]00/);
  });

  it('adds a stage with a deeper discount', () => {
    component.addStage(form.controls.scenarios.at(0), 0);
    expect(stages()).toEqual([
      { share: 1, discount: 0, months: 1 },
      { share: 0, discount: 0.1, months: 1 },
    ]);
  });

  it('reorders and removes stages, keeping at least one', () => {
    const scenario = form.controls.scenarios.at(0);
    component.addStage(scenario, 0);
    component.moveStage(scenario, 0, 1, -1);
    expect(stages().map((s) => s.discount)).toEqual([0.1, 0]);
    component.moveStage(scenario, 0, 0, -1);
    expect(stages().map((s) => s.discount)).toEqual([0.1, 0]);
    component.removeStage(scenario, 0, 0);
    expect(stages()).toEqual([{ share: 1, discount: 0, months: 1 }]);
    component.removeStage(scenario, 0, 0);
    expect(stages().length).toBe(1);
  });

  it('warns when shares do not add up to 100%', async () => {
    form.controls.scenarios.at(0).controls.stages.at(0).controls.share.setValue(80);
    await render();
    expect(text()).toContain('Сума часток — 80%');
  });

  it('copies the current scenario into a new tab and removes scenarios, keeping one', () => {
    form.controls.scenarios.at(0).controls.stages.at(0).controls.months.setValue(3);
    component.addScenario();
    expect(form.controls.scenarios.length).toBe(2);
    expect(toBatchInput(form.getRawValue()).scenarios[1]).toEqual({
      name: 'Сценарій 2',
      stages: [{ share: 1, discount: 0, months: 3 }],
    });
    expect(component.selectedIndex()).toBe(1);

    component.removeScenario(1);
    expect(form.controls.scenarios.length).toBe(1);
    expect(component.selectedIndex()).toBe(0);
    component.removeScenario(0);
    expect(form.controls.scenarios.length).toBe(1);
  });
});
