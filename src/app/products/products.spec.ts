import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Supabase } from '../core/supabase';
import { Products } from './products';

describe('Products', () => {
  let component: Products;
  let fixture: ComponentFixture<Products>;
  let signOut: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    signOut = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [Products],
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
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
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the signed-in user email', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('seller@example.com');
  });

  it('signs out', async () => {
    await component.signOut();
    expect(signOut).toHaveBeenCalled();
  });
});
