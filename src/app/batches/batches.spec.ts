import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { SavedBatch } from '@shared/api/batches';
import { BatchesApi } from '../core/batches-api';
import { Supabase } from '../core/supabase';
import { Batches } from './batches';

const batch: SavedBatch = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Свічки, жовтень',
  quantity: 100,
  currency: 'UAH',
  defectRate: 0,
  targetProfit: 0,
  competitorPrice: null,
  salesStartDate: null,
  costs: [],
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
        breakEvenPrice: 123,
        targetPrice: 123,
        stageUnits: [100],
      },
    },
  ],
  createdAt: '2026-10-19T00:00:00Z',
  updatedAt: '2026-10-19T00:00:00Z',
};

describe('Batches', () => {
  let component: Batches;
  let fixture: ComponentFixture<Batches>;
  let signOut: ReturnType<typeof vi.fn>;
  let list: ReturnType<typeof vi.fn>;

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Batches],
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        { provide: BatchesApi, useValue: { list } },
        {
          provide: Supabase,
          useValue: { session: () => ({ user: { email: 'seller@example.com' } }), signOut },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Batches);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    signOut = vi.fn().mockResolvedValue(undefined);
    list = vi.fn().mockResolvedValue([batch]);
  });

  it('shows the signed-in user email', async () => {
    await setup();
    expect(text()).toContain('seller@example.com');
  });

  it('lists batches with their break-even price', async () => {
    await setup();
    expect(text()).toContain('Свічки, жовтень');
    expect(text()).toContain('100 шт');
    expect(text()).toMatch(/123[.,]00/);
  });

  it('shows a break-even price of 0', async () => {
    const free = structuredClone(batch);
    free.scenarios[0].result.breakEvenPrice = 0;
    list.mockResolvedValue([free]);
    await setup();
    expect(text()).toMatch(/0[.,]00/);
  });

  it('shows an empty state', async () => {
    list.mockResolvedValue([]);
    await setup();
    expect(text()).toContain('Ще немає партій');
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
