import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from './supabase';

export const authGuard: CanActivateFn = () => {
  const supabase = inject(Supabase);
  const router = inject(Router);

  if (supabase.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
