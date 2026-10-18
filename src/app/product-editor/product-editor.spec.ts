import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Product } from '@shared/api/products';
import { ProductsApi } from '../core/products-api';
import { ProductEditor } from './product-editor';

const saved: Product = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Свічка',
  salePrice: 100,
  currency: 'EUR',
  returnRate: 0,
  returnCost: 0,
  lines: [{ name: 'Віск', kind: 'material', quantity: 1, unitPrice: 40 }],
  createdAt: '',
  updatedAt: '',
  result: { unitCost: 40, percentCosts: 0, profit: 60, marginPct: 0.6, markupPct: 1.5 },
};

describe('ProductEditor', () => {
  let fixture: ComponentFixture<ProductEditor>;
  let component: ProductEditor;
  let api: { [K in keyof ProductsApi]: ReturnType<typeof vi.fn> };

  async function setup(id: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProductEditor],
      providers: [
        provideRouter([{ path: 'products', children: [] }, { path: 'products/:id', children: [] }]),
        { provide: ProductsApi, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductEditor);
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

  it('starts empty for a new product', async () => {
    await setup('new');
    expect(api.get).not.toHaveBeenCalled();
    expect(component.isNew()).toBe(true);
    expect(component.status()).toBe('ready');
  });

  it('loads an existing product and computes results', async () => {
    await setup(saved.id);
    expect(component.form.controls.name.value).toBe('Свічка');
    expect(component.result()?.marginPct).toBeCloseTo(0.6);
  });

  it('recalculates live as the form changes', async () => {
    await setup(saved.id);
    component.addLine();
    component.form.controls.lines.at(1).patchValue({ name: 'Пакування', kind: 'fixed', amount: 10 });
    expect(component.result()?.unitCost).toBeCloseTo(50);

    component.removeLine(0);
    expect(component.result()?.unitCost).toBeCloseTo(10);
  });

  it('shows not-found for a missing product', async () => {
    api.get.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    await setup(saved.id);
    expect(component.status()).toBe('not-found');
  });

  it('does not save an invalid form', async () => {
    await setup('new');
    await component.save();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('creates a new product and navigates to it', async () => {
    await setup('new');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    component.form.patchValue({ name: 'Свічка', salePrice: 100 });

    await component.save();

    expect(api.create).toHaveBeenCalledWith({ name: 'Свічка', salePrice: 100, returnRate: 0, returnCost: 0, lines: [] });
    expect(navigate).toHaveBeenCalledWith(['/products', saved.id], { replaceUrl: true });
    expect(component.isNew()).toBe(false);
  });

  it('updates an existing product', async () => {
    await setup(saved.id);
    component.form.controls.salePrice.setValue(120);
    await component.save();
    expect(api.update).toHaveBeenCalledWith(saved.id, expect.objectContaining({ salePrice: 120 }));
  });

  it('deletes and returns to the list', async () => {
    await setup(saved.id);
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    await component.delete();
    expect(api.delete).toHaveBeenCalledWith(saved.id);
    expect(navigateByUrl).toHaveBeenCalledWith('/products');
  });
});
