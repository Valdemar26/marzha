import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Supabase } from './supabase';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => authGuard(...guardParameters));

  it('allows access when authenticated', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: Supabase, useValue: { isAuthenticated: () => true } }],
    });

    expect(executeGuard({} as never, {} as never)).toBe(true);
  });

  it('redirects to /login when not authenticated', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: Supabase, useValue: { isAuthenticated: () => false } }],
    });

    const result = executeGuard({} as never, {} as never);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });
});
