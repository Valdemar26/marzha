import { Routes } from '@angular/router';
import { authGuard } from './core/auth-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./login/login').then((m) => m.Login) },
  {
    path: 'products',
    canActivate: [authGuard],
    loadComponent: () => import('./products/products').then((m) => m.Products),
  },
  { path: '**', redirectTo: 'login' },
];
