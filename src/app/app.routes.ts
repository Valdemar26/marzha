import { Routes } from '@angular/router';
import { authGuard } from './core/auth-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./login/login').then((m) => m.Login) },
  {
    path: 'batches',
    canActivate: [authGuard],
    loadComponent: () => import('./batches/batches').then((m) => m.Batches),
  },
  {
    path: 'batches/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./batch-editor/batch-editor').then((m) => m.BatchEditor),
  },
  { path: '**', redirectTo: 'login' },
];
