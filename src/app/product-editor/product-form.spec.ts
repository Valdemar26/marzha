import { TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import type { Product } from '@shared/api/products';
import { createLineGroup, createProductForm, fillProductForm, toProductInput } from './product-form';

describe('product form', () => {
  let fb: NonNullableFormBuilder;

  beforeEach(() => {
    fb = TestBed.inject(NonNullableFormBuilder);
  });

  it('converts percent fields to fractions and keeps only kind-relevant fields', () => {
    const form = createProductForm(fb);
    form.patchValue({ name: ' Свічка ', salePrice: 100, returnRate: 10, returnCost: 5 });
    const material = createLineGroup(fb);
    material.patchValue({ name: 'Віск', kind: 'material', quantity: 2, unitPrice: 3, amount: 99 });
    const fee = createLineGroup(fb);
    fee.patchValue({ name: 'Комісія', kind: 'percent', percent: 15, quantity: 7 });
    form.controls.lines.push(material);
    form.controls.lines.push(fee);

    expect(toProductInput(form.getRawValue())).toEqual({
      name: 'Свічка',
      salePrice: 100,
      returnRate: 0.1,
      returnCost: 5,
      lines: [
        { name: 'Віск', kind: 'material', quantity: 2, unitPrice: 3 },
        { name: 'Комісія', kind: 'percent', percent: 0.15 },
      ],
    });
  });

  it('treats empty numbers as 0', () => {
    const form = createProductForm(fb);
    form.controls.lines.push(createLineGroup(fb));
    form.controls.lines.at(0).patchValue({ kind: 'labor' });
    form.patchValue({ returnRate: null });

    const input = toProductInput(form.getRawValue());
    expect(input.salePrice).toBe(0);
    expect(input.returnRate).toBe(0);
    expect(input.returnCost).toBe(0);
    expect(input.lines[0]).toEqual({ name: '', kind: 'labor', hours: 0, rate: 0 });
  });

  it('rejects return rates of 100% and above', () => {
    const form = createProductForm(fb);
    form.controls.returnRate.setValue(100);
    expect(form.controls.returnRate.valid).toBe(false);
  });

  it('fills the form from a saved product, showing fractions as percents', () => {
    const product: Product = {
      id: 'id',
      name: 'Свічка',
      salePrice: 100,
      currency: 'EUR',
      returnRate: 0.07,
      returnCost: 4,
      lines: [{ name: 'Комісія', kind: 'percent', percent: 0.07 }],
      createdAt: '',
      updatedAt: '',
      result: { unitCost: 0, percentCosts: 0, profit: 0, marginPct: 0, markupPct: null },
    };
    const form = createProductForm(fb);
    form.controls.lines.push(createLineGroup(fb));
    form.controls.lines.push(createLineGroup(fb));

    fillProductForm(form, fb, product);

    expect(form.controls.returnRate.value).toBe(7);
    expect(form.controls.lines.length).toBe(1);
    expect(form.controls.lines.at(0).controls.percent.value).toBe(7);
    expect(toProductInput(form.getRawValue()).lines).toEqual(product.lines);
  });
});
