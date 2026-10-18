import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Product } from '@shared/api/products';
import { ProductsApi } from '../core/products-api';
import { Supabase } from '../core/supabase';
import { Products } from './products';

const product: Product = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Свічка',
  salePrice: 100,
  currency: 'EUR',
  returnRate: 0,
  returnCost: 0,
  lines: [],
  createdAt: '2026-10-18T00:00:00Z',
  updatedAt: '2026-10-18T00:00:00Z',
  result: { unitCost: 60, percentCosts: 0, profit: 40, marginPct: 0.4, markupPct: 0.6667 },
};

describe('Products', () => {
  let component: Products;
  let fixture: ComponentFixture<Products>;
  let signOut: ReturnType<typeof vi.fn>;
  let list: ReturnType<typeof vi.fn>;

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Products],
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        { provide: ProductsApi, useValue: { list } },
        {
          provide: Supabase,
          useValue: {
            session: () => ({ user: { email: 'seller@example.com' } }),
            signOut,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Products);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(() => {
    signOut = vi.fn().mockResolvedValue(undefined);
    list = vi.fn().mockResolvedValue([product]);
  });

  it('shows the signed-in user email', async () => {
    await setup();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('seller@example.com');
  });

  it('lists products with their margin', async () => {
    await setup();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Свічка');
    expect(text).toContain('40');
    expect(text).toContain('%');
  });

  it('shows an empty state', async () => {
    list.mockResolvedValue([]);
    await setup();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ще немає товарів');
  });

  it('shows an error when loading fails', async () => {
    list.mockRejectedValue(new Error('boom'));
    await setup();
    expect(component.status()).toBe('error');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
  });

  it('signs out', async () => {
    await setup();
    await component.signOut();
    expect(signOut).toHaveBeenCalled();
  });
});
