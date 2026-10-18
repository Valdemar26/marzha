import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { Supabase } from './supabase';

/** Attaches the current Supabase access token to /api requests. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) {
    return next(request);
  }

  const supabase = inject(Supabase);

  // getSession() refreshes an expired token, so prefer it over the cached session signal.
  return from(supabase.client.auth.getSession()).pipe(
    switchMap(({ data }) => {
      const token = data.session?.access_token;
      return next(token ? request.clone({ setHeaders: { authorization: `Bearer ${token}` } }) : request);
    }),
  );
};
