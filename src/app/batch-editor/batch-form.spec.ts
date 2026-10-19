import { TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import type { SavedBatch } from '@shared/api/batches';
import {
  createBatchForm,
  createCostGroup,
  createScenarioGroup,
  fillBatchForm,
  toBatchInput,
  toCalcInputs,
} from './batch-form';

const saved: SavedBatch = {
  id: 'id',
  name: 'Свічки',
  quantity: 100,
  currency: 'EUR',
  defectRate: 0.07,
  targetProfit: 5000,
  competitorPrice: 250,
  salesStartDate: '2026-11-01',
  costs: [
    { name: 'Закупівля', kind: 'one_time', amount: 8000 },
    { name: 'Комісія', kind: 'per_sale_percent', percent: 0.07 },
  ],
  scenarios: [
    {
      id: 's1',
      name: 'Розпродаж',
      stages: [
        { share: 0.7, discount: 0, months: 2 },
        { share: 0.3, discount: 0.15, months: 1 },
      ],
      result: {
        sellableUnits: 93,
        totalMonths: 3,
        sharesTotal: 1,
        validation: { valid: true, issues: [] },
        breakEvenPrice: 1,
        targetPrice: 2,
        stageUnits: [65.1, 27.9],
      },
    },
  ],
  createdAt: '',
  updatedAt: '',
};

describe('batch form', () => {
  let fb: NonNullableFormBuilder;

  beforeEach(() => {
    fb = TestBed.inject(NonNullableFormBuilder);
  });

  it('starts with one full-price scenario selling everything in a month', () => {
    const input = toBatchInput(createBatchForm(fb).getRawValue());
    expect(input.scenarios).toEqual([{ name: 'Базовий', stages: [{ share: 1, discount: 0, months: 1 }] }]);
    expect(input.currency).toBe('UAH');
  });

  it('converts percents to fractions and keeps only kind-relevant cost fields', () => {
    const form = createBatchForm(fb);
    form.patchValue({ name: ' Свічки ', quantity: 100, defectRate: 5, targetProfit: 1000 });
    const fee = createCostGroup(fb, { name: 'Комісія', kind: 'per_sale_percent', percent: 0.1 });
    fee.patchValue({ amount: 99 });
    const rent = createCostGroup(fb, { name: 'Склад', kind: 'monthly', amount: 300 });
    rent.patchValue({ percent: 50 });
    form.controls.costs.push(fee);
    form.controls.costs.push(rent);
    form.controls.scenarios.at(0).controls.stages.at(0).patchValue({ share: 60, discount: 12.5, months: 2 });

    expect(toBatchInput(form.getRawValue())).toEqual({
      name: 'Свічки',
      quantity: 100,
      currency: 'UAH',
      defectRate: 0.05,
      targetProfit: 1000,
      competitorPrice: null,
      salesStartDate: null,
      costs: [
        { name: 'Комісія', kind: 'per_sale_percent', percent: 0.1 },
        { name: 'Склад', kind: 'monthly', amount: 300 },
      ],
      scenarios: [{ name: 'Базовий', stages: [{ share: 0.6, discount: 0.125, months: 2 }] }],
    });
  });

  it('treats empty numbers as 0', () => {
    const form = createBatchForm(fb);
    form.controls.costs.push(createCostGroup(fb, { name: 'x', kind: 'one_time' }));
    form.controls.scenarios.at(0).controls.stages.at(0).patchValue({ share: null, discount: null, months: null });
    form.patchValue({ defectRate: null });

    const input = toBatchInput(form.getRawValue());
    expect(input.quantity).toBe(0);
    expect(input.defectRate).toBe(0);
    expect(input.targetProfit).toBe(0);
    expect(input.costs[0]).toEqual({ name: 'x', kind: 'one_time', amount: 0 });
    expect(input.scenarios[0].stages[0]).toEqual({ share: 0, discount: 0, months: 0 });
  });

  it('clamps out-of-range percents so live results stay sane', () => {
    const form = createBatchForm(fb);
    form.patchValue({ quantity: 10, defectRate: 150 });
    form.controls.scenarios.at(0).controls.stages.at(0).patchValue({ discount: -20 });
    const { batch, scenarios } = toCalcInputs(form.getRawValue());
    expect(batch.defectRate).toBe(1);
    expect(scenarios[0].stages[0].discount).toBe(0);
  });

  it('validates ranges', () => {
    const form = createBatchForm(fb);
    form.controls.quantity.setValue(0);
    form.controls.defectRate.setValue(100);
    expect(form.controls.quantity.valid).toBe(false);
    expect(form.controls.defectRate.valid).toBe(false);
    const stage = form.controls.scenarios.at(0).controls.stages.at(0);
    stage.patchValue({ share: 101, months: 121 });
    expect(stage.controls.share.valid).toBe(false);
    expect(stage.controls.months.valid).toBe(false);
  });

  it('fills the form from a saved batch and round-trips it', () => {
    const form = createBatchForm(fb);
    form.controls.scenarios.push(createScenarioGroup(fb, { name: 'зайвий', stages: [] }));

    fillBatchForm(form, fb, saved);

    expect(form.controls.defectRate.value).toBe(7);
    expect(form.controls.costs.at(1).controls.percent.value).toBe(7);
    expect(form.controls.scenarios.length).toBe(1);
    expect(form.controls.scenarios.at(0).controls.stages.at(1).controls.discount.value).toBe(15);
    expect(form.pristine).toBe(true);

    const { id: _id, createdAt: _c, updatedAt: _u, scenarios, ...rest } = saved;
    expect(toBatchInput(form.getRawValue())).toEqual({
      ...rest,
      scenarios: scenarios.map(({ name, stages }) => ({ name, stages })),
    });
  });

  it('gives a saved batch without scenarios the default one', () => {
    const form = createBatchForm(fb);
    fillBatchForm(form, fb, { ...saved, scenarios: [] });
    expect(form.controls.scenarios.length).toBe(1);
    expect(form.controls.scenarios.at(0).controls.name.value).toBe('Базовий');
  });
});
