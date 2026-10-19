import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import type { SavedBatch } from '@shared/api/batches';
import { BatchesApi } from '../core/batches-api';
import { BatchEditor } from './batch-editor';
import { createCostGroup, createScenarioGroup } from './batch-form';

const saved: SavedBatch = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Свічки',
  quantity: 100,
  currency: 'UAH',
  defectRate: 0,
  targetProfit: 1000,
  competitorPrice: null,
  salesStartDate: null,
  costs: [{ name: 'Закупівля', kind: 'one_time', amount: 5000 }],
  scenarios: [
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Базовий',
      stages: [{ share: 1, discount: 0, months: 1 }],
      result: {
        sellableUnits: 100,
        totalMonths: 1,
        sharesTotal: 1,
        validation: { valid: true, issues: [] },
        breakEvenPrice: 50,
        targetPrice: 60,
        stageUnits: [100],
      },
    },
  ],
  createdAt: '',
  updatedAt: '',
};

describe('BatchEditor', () => {
  let fixture: ComponentFixture<BatchEditor>;
  let component: BatchEditor;
  let api: { [K in keyof BatchesApi]: ReturnType<typeof vi.fn> };

  async function setup(id: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [BatchEditor],
      providers: [
        provideRouter([{ path: 'batches', children: [] }, { path: 'batches/:id', children: [] }]),
        { provide: BatchesApi, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BatchEditor);
    fixture.componentRef.setInput('id', id);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(() => {
    api = {
      list: vi.fn(),
      get: vi.fn().mockResolvedValue(saved),
      create: vi.fn().mockResolvedValue(saved),
      update: vi.fn().mockResolvedValue(saved),
      delete: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('starts empty for a new batch', async () => {
    await setup('new');
    expect(api.get).not.toHaveBeenCalled();
    expect(component.isNew()).toBe(true);
    expect(component.status()).toBe('ready');
    expect(component.analyses().length).toBe(1);
  });

  it('loads a batch and computes results live', async () => {
    await setup(saved.id);
    expect(component.form.controls.name.value).toBe('Свічки');
    expect(component.selectedAnalysis()?.breakEvenPrice).toBeCloseTo(50);

    component.form.controls.costs.push(
      createCostGroup(TestBed.inject(NonNullableFormBuilder), { name: 'Склад', kind: 'monthly', amount: 1000 }),
    );
    expect(component.selectedAnalysis()?.breakEvenPrice).toBeCloseTo(60);
  });

  it('suggests the target price until the user picks one', async () => {
    await setup(saved.id);
    expect(component.price()).toBe(60);
    component.form.controls.targetProfit.setValue(2000);
    expect(component.price()).toBe(70);
    component.setPrice(55);
    component.form.controls.targetProfit.setValue(3000);
    expect(component.price()).toBe(55);
  });

  it('compares every scenario at the same price', async () => {
    await setup(saved.id);
    const fb = TestBed.inject(NonNullableFormBuilder);
    component.form.controls.scenarios.push(
      createScenarioGroup(fb, { name: 'Довгий', stages: [{ share: 1, discount: 0, months: 6 }] }),
    );
    await fixture.whenStable();
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('app-comparison-table tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[1].textContent).toContain('Довгий');
  });

  it('shows not-found for a missing batch', async () => {
    api.get.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    await setup(saved.id);
    expect(component.status()).toBe('not-found');
  });

  it('shows an error when loading fails', async () => {
    api.get.mockRejectedValue(new HttpErrorResponse({ status: 500 }));
    await setup(saved.id);
    expect(component.status()).toBe('error');
  });

  it('does not save an invalid form', async () => {
    await setup('new');
    await component.save();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('creates a new batch and navigates to it', async () => {
    await setup('new');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    component.form.patchValue({ name: 'Свічки', quantity: 100 });

    await component.save();

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Свічки', quantity: 100, costs: [] }));
    expect(navigate).toHaveBeenCalledWith(['/batches', saved.id], { replaceUrl: true });
    expect(component.isNew()).toBe(false);
  });

  it('updates an existing batch', async () => {
    await setup(saved.id);
    component.form.controls.quantity.setValue(120);
    await component.save();
    expect(api.update).toHaveBeenCalledWith(saved.id, expect.objectContaining({ quantity: 120 }));
  });

  it('keeps editing when saving fails', async () => {
    api.update.mockRejectedValue(new Error('boom'));
    await setup(saved.id);
    await component.save();
    expect(component.saving()).toBe(false);
  });

  it('deletes and returns to the list', async () => {
    await setup(saved.id);
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    await component.delete();
    expect(api.delete).toHaveBeenCalledWith(saved.id);
    expect(navigateByUrl).toHaveBeenCalledWith('/batches');
  });
});
